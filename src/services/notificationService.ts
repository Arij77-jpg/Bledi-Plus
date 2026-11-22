/**
 * Regional Push & Local Notification Service (`src/services/notificationService.ts`)
 *
 * Implements:
 * 1. Device registration & Expo Push Token generation for municipal staff & admins.
 * 2. Token persistence to Firestore (`/users/{userId}`) with `assignedRegion`.
 * 3. Foreground notification handler for real-time visual & audio alerts.
 * 4. Local incident alert scheduler (`scheduleLocalIncidentAlert`) triggered when a new
 *    unresolved report arrives in the admin's assigned municipal jurisdiction.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { CivicReport, MunicipalNotification } from '../types/report';
import { USERS_COLLECTION } from './reports';
import { localStaffStore } from './adminProvisioning';

// In-memory notifications store for demo/offline preview mode
let localNotificationsStore: Record<string, MunicipalNotification[]> = {};
type NotificationListener = (notifs: MunicipalNotification[]) => void;
let notificationListeners: Record<string, NotificationListener[]> = {};

function notifyLocalNotificationSubscribers(userId: string) {
  const list = localNotificationsStore[userId] || [];
  const subs = notificationListeners[userId] || [];
  subs.forEach((cb) => cb([...list]));
}

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Registers device for push notifications, sets up Android channels,
 * and saves the Expo Push Token to the authenticated user's profile in Firestore.
 */
export async function registerForPushNotificationsAsync(
  userId?: string | null,
  assignedRegion?: string | null
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  // Setup Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('civic_regional_alerts', {
      name: 'Alertes Régionales Bledi+',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });
  }

  if (!Constants.isDevice) {
    console.log('[NotificationService] Running on simulator/emulator; push tokens require physical device.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Push notification permissions not granted.');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    // Synchronize token to Firestore if user is signed in and Firebase is live
    if (userId && isFirebaseConfigured) {
      try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const patch: Record<string, any> = {
          pushToken: token,
          expoPushToken: token,
          updatedAt: serverTimestamp(),
        };
        if (assignedRegion) {
          patch.assignedRegion = assignedRegion;
        }
        await updateDoc(userRef, patch);
      } catch (err: any) {
        console.warn('[NotificationService] Could not persist push token to user profile:', err.message);
      }
    }

    return token;
  } catch (error: any) {
    console.warn('[NotificationService] Failed to retrieve push token:', error.message);
    return null;
  }
}

/**
 * Dispatches an immediate high-priority local audio & banner notification
 * to the municipal worker/admin when an incident is logged in their jurisdiction.
 */
export async function scheduleLocalIncidentAlert(report: CivicReport): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 Bledi+ Alerte : ${report.region || 'Municipalité'}`,
        body: `${report.title} (${report.category.toUpperCase()}) - ${report.location.address}`,
        data: {
          reportId: report.id,
          region: report.region,
          category: report.category,
        },
        sound: 'default',
      },
      trigger: null, // null means trigger immediately
    });
  } catch (err: any) {
    console.warn('[NotificationService] Could not schedule local incident alert:', err.message);
  }
}

/**
 * Sends a push notification payload via the Expo Push API.
 */
async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, any>
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'civic_regional_alerts',
      }),
    });
  } catch (err: any) {
    console.warn('[NotificationService] Failed to deliver Expo push message:', err.message);
  }
}

/**
 * TARGETED REGIONAL PUSH & IN-APP NOTIFICATIONS
 * =============================================
 * Triggered whenever a citizen publishes a new report in `/reports` with status: "pending".
 * 1. Reads report.region (Délégation / Mo3tamdiya, e.g. "Sousse Médina").
 * 2. Queries active Admins: where("role", "==", "admin") and where("isActive", "==", true).
 * 3. Queries active Regional Employees: where("role", "==", "employee"), where("assignedRegion", "==", report.region), and where("isActive", "==", true).
 * 4. Deduplicates tokens and delivers Push Notifications via Expo Push API:
 *    - Title: "🚨 Nouveau Signalement - [report.region]"
 *    - Body: "[report.category] : [report.title]. Appuyez pour consulter."
 *    - Data payload: { type: "NEW_REPORT", reportId: reportId, region: report.region }
 * 5. Persists notification record to `/users/{userId}/notifications` for each Admin and Employee.
 */
export async function dispatchRegionalNewReportNotification(report: CivicReport): Promise<void> {
  const notifRegion = report.region || 'Municipalité';
  const notifTitle = `🚨 Nouveau Signalement - ${notifRegion}`;
  const categoryLabel = (report.category || 'SIGNALEMENT').toUpperCase();
  const notifBody = `${categoryLabel} : ${report.title}. Appuyez pour consulter.`;
  const notifData = {
    type: 'NEW_REPORT',
    reportId: report.id,
    region: report.region,
  };

  // ---------------------------------------------------------------------------
  // Demo / Offline Mode (uses in-memory localStaffStore and localNotificationsStore)
  // ---------------------------------------------------------------------------
  if (!isFirebaseConfigured) {
    // 1. Gather active Admins + Employees assigned to this region (or global 'ALL')
    const targetStaff = localStaffStore.filter((s) => {
      if (s.isActive === false) return false;
      if (s.role === 'admin') return true;
      if (s.role === 'employee' && (s.assignedRegion === report.region || s.assignedRegion === 'ALL')) {
        return true;
      }
      return false;
    });

    // Deduplicate by UID
    const seenUids = new Set<string>();
    targetStaff.forEach((staff) => {
      if (seenUids.has(staff.uid)) return;
      seenUids.add(staff.uid);

      const notifItem: MunicipalNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'NEW_REPORT',
        reportId: report.id,
        title: notifTitle,
        body: notifBody,
        region: report.region,
        createdAt: new Date().toISOString(),
        read: false,
      };

      if (!localNotificationsStore[staff.uid]) {
        localNotificationsStore[staff.uid] = [];
      }
      localNotificationsStore[staff.uid] = [notifItem, ...localNotificationsStore[staff.uid]];
      notifyLocalNotificationSubscribers(staff.uid);
    });

    // Local device alert on mobile
    if (Platform.OS !== 'web') {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notifTitle,
            body: notifBody,
            data: notifData,
            sound: 'default',
          },
          trigger: null,
        });
      } catch (err: any) {
        console.warn('[NotificationService] Local push alert failed:', err.message);
      }
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // Live Firebase Mode (Queries Firestore `/users`)
  // ---------------------------------------------------------------------------
  try {
    // Query 1: Active Admins
    const adminQuery = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'admin'),
      where('isActive', '==', true)
    );

    // Query 2: Regional Employees assigned to report.region
    const employeeQuery = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', 'employee'),
      where('assignedRegion', '==', report.region),
      where('isActive', '==', true)
    );

    const [adminSnap, employeeSnap] = await Promise.all([
      getDocs(adminQuery),
      getDocs(employeeQuery),
    ]);

    // Map user ID to push token (deduplicating recipients)
    const targetRecipients = new Map<string, string | null>();

    adminSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const token = data.pushToken || data.expoPushToken || null;
      targetRecipients.set(docSnap.id, token);
    });

    employeeSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const token = data.pushToken || data.expoPushToken || null;
      targetRecipients.set(docSnap.id, token);
    });

    // Deduplicate push tokens to prevent multi-device / multi-role duplicate push alerts
    const uniqueTokens = new Set<string>();
    targetRecipients.forEach((token) => {
      if (token && typeof token === 'string' && token.trim().length > 0) {
        uniqueTokens.add(token.trim());
      }
    });

    // 1. Dispatch push notifications to all unique device tokens
    const pushPromises = Array.from(uniqueTokens).map((pushToken) =>
      sendExpoPushNotification(pushToken, notifTitle, notifBody, notifData)
    );

    // 2. Persist notification log inside `/users/{userId}/notifications` for each Admin & Employee
    const firestorePromises = Array.from(targetRecipients.keys()).map(async (userId) => {
      const notifDocRef = doc(collection(db, `${USERS_COLLECTION}/${userId}/notifications`));
      return setDoc(notifDocRef, {
        id: notifDocRef.id,
        type: 'NEW_REPORT',
        reportId: report.id,
        title: notifTitle,
        body: notifBody,
        region: report.region,
        createdAt: serverTimestamp(),
        read: false,
      });
    });

    await Promise.all([...pushPromises, ...firestorePromises]);
  } catch (err: any) {
    console.warn('[NotificationService] Failed to dispatch regional notifications:', err.message);
  }
}

/**
 * Real-time listener for user notifications (Admin or Employee).
 */
export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: MunicipalNotification[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const list = localNotificationsStore[userId] || [];
    onUpdate([...list]);
    const cb: NotificationListener = (items) => onUpdate(items);
    if (!notificationListeners[userId]) {
      notificationListeners[userId] = [];
    }
    notificationListeners[userId].push(cb);
    return () => {
      notificationListeners[userId] = (notificationListeners[userId] || []).filter(
        (fn) => fn !== cb
      );
    };
  }

  try {
    const notifsRef = collection(db, `${USERS_COLLECTION}/${userId}/notifications`);
    const q = query(notifsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const notifs: MunicipalNotification[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            type: data.type || 'NEW_REPORT',
            reportId: data.reportId || '',
            title: data.title || '',
            body: data.body || '',
            region: data.region || '',
            createdAt: data.createdAt,
            read: Boolean(data.read),
          };
        });
        onUpdate(notifs);
      },
      (error) => {
        onError?.(error);
      }
    );
  } catch (err: any) {
    onError?.(err);
    return () => {};
  }
}

/**
 * Backward compatibility alias for subscribeToEmployeeNotifications
 */
export const subscribeToEmployeeNotifications = subscribeToUserNotifications;

/**
 * Real-time listener specifically for unread notification count.
 */
export function subscribeToUnreadCount(
  userId: string,
  onUpdate: (unreadCount: number) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeToUserNotifications(
    userId,
    (notifications) => {
      const count = notifications.filter((n) => !n.read).length;
      onUpdate(count);
    },
    onError
  );
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(
  userId: string,
  notifId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = localNotificationsStore[userId] || [];
    const idx = list.findIndex((n) => n.id === notifId);
    if (idx !== -1) {
      list[idx].read = true;
      notifyLocalNotificationSubscribers(userId);
    }
    return;
  }

  try {
    const notifRef = doc(db, `${USERS_COLLECTION}/${userId}/notifications`, notifId);
    await updateDoc(notifRef, {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    console.warn('[NotificationService] Could not mark notification as read:', err.message);
  }
}

/**
 * Marks all notifications as read for a given user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = localNotificationsStore[userId] || [];
    list.forEach((n) => {
      n.read = true;
    });
    notifyLocalNotificationSubscribers(userId);
    return;
  }

  try {
    const notifsRef = collection(db, `${USERS_COLLECTION}/${userId}/notifications`);
    const q = query(notifsRef, where('read', '==', false));
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map((d) =>
      updateDoc(d.ref, {
        read: true,
        updatedAt: serverTimestamp(),
      })
    );
    await Promise.all(updates);
  } catch (err: any) {
    console.warn('[NotificationService] Could not mark all notifications as read:', err.message);
  }
}
