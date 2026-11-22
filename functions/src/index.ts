import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function Trigger: onReportCreated
 * =======================================
 * Triggered automatically when a new document is written to /reports/{reportId}.
 * 1. Verifies that the report status is "pending".
 * 2. Queries active Admins: where("role", "==", "admin") and where("isActive", "==", true).
 * 3. Queries active Regional Employees: where("role", "==", "employee"), where("assignedRegion", "==", report.region), and where("isActive", "==", true).
 * 4. Deduplicates Expo Push Tokens & delivers push notifications via Expo Push API.
 * 5. Commits notification audit log docs to /users/{userId}/notifications for every recipient.
 */
export const onReportCreated = onDocumentCreated(
  "reports/{reportId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const report = snap.data();
    const reportId = event.params.reportId;

    if (!report || report.status !== "pending") {
      return;
    }

    const reportRegion = report.region || "Municipalité";
    const notifTitle = `🚨 Nouveau Signalement - ${reportRegion}`;
    const categoryLabel = (report.category || "SIGNALEMENT").toUpperCase();
    const notifBody = `${categoryLabel} : ${report.title}. Appuyez pour consulter.`;
    const notifData = {
      type: "NEW_REPORT",
      reportId: reportId,
      region: reportRegion,
    };

    try {
      // 1. Gather all active municipal administrators
      const adminsSnap = await db
        .collection("users")
        .where("role", "==", "admin")
        .where("isActive", "==", true)
        .get();

      // 2. Gather active municipal field workers assigned to this specific region
      const employeesSnap = await db
        .collection("users")
        .where("role", "==", "employee")
        .where("assignedRegion", "==", reportRegion)
        .where("isActive", "==", true)
        .get();

      // Deduplicate target recipients by user ID
      const targetRecipients = new Map<string, string | null>();

      adminsSnap.forEach((doc) => {
        const data = doc.data();
        const token = data.pushToken || data.expoPushToken || null;
        targetRecipients.set(doc.id, token);
      });

      employeesSnap.forEach((doc) => {
        const data = doc.data();
        const token = data.pushToken || data.expoPushToken || null;
        targetRecipients.set(doc.id, token);
      });

      // Gather unique push tokens
      const uniqueTokens = new Set<string>();
      targetRecipients.forEach((token) => {
        if (token && typeof token === "string" && token.trim().length > 0) {
          uniqueTokens.add(token.trim());
        }
      });

      // 3. Dispatch Push Notifications via Expo Push Service
      if (uniqueTokens.size > 0) {
        const pushMessages = Array.from(uniqueTokens).map((token) => ({
          to: token,
          sound: "default",
          title: notifTitle,
          body: notifBody,
          data: notifData,
          priority: "high",
          channelId: "civic_regional_alerts",
        }));

        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushMessages),
        });
      }

      // 4. Batch write in-app notifications to each recipient's subcollection
      const batch = db.batch();
      targetRecipients.forEach((_, userId) => {
        const notifRef = db
          .collection("users")
          .doc(userId)
          .collection("notifications")
          .doc();

        batch.set(notifRef, {
          id: notifRef.id,
          type: "NEW_REPORT",
          reportId: reportId,
          title: notifTitle,
          body: notifBody,
          region: reportRegion,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      });

      await batch.commit();
      console.log(`[onReportCreated] Successfully notified ${targetRecipients.size} staff members for report ${reportId}`);
    } catch (err: any) {
      console.error("[onReportCreated] Failed to dispatch notifications:", err);
    }
  }
);
