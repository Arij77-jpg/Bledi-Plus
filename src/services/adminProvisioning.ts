/**
 * Super-Admin & Municipal Staff Provisioning Service (`src/services/adminProvisioning.ts`)
 *
 * Security & Zero-Trust Guarantees:
 * 1. Secondary Firebase App Pattern: When provisioning a new employee, creates an isolated
 *    ephemeral Firebase App instance (`initializeApp(firebaseConfig, 'SecondaryStaffApp_...')`).
 *    This allows the Admin to register employee credentials in Firebase Auth WITHOUT terminating
 *    or mutating the primary Admin's signed-in session (`auth.currentUser`).
 * 2. Immutable Role Defaulting: Staff accounts created by this service are strictly registered
 *    with `role: 'employee'` and assigned to a verified Mo3tamdiya (`assignedRegion`).
 * 3. Immediate Revocation (`isActive: false`): Revoked/suspended staff accounts immediately fail
 *    RBAC route guards and firestore security rules.
 * 4. Zero Offline Leakage: In live mode (`isFirebaseConfigured === true`), all mutations commit
 *    directly to Firestore `/users/{uid}` and require authentic Admin privileges.
 */

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as secondarySignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseConfig, isFirebaseConfigured } from './firebase';
import { StaffMember } from '../types/report';
import { AppSecurityError, normalizeSecurityError } from '../utils/errors';

// Seeded local staff members for demo/evaluation mode
export let localStaffStore: StaffMember[] = [
  {
    uid: 'staff_chiheb_001',
    displayName: 'Chiheb (Agent Municipal)',
    email: 'chiheb@bledi.employee.tn',
    role: 'employee',
    assignedRegion: 'Sousse Médina',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
  },
  {
    uid: 'staff_mohamed_002',
    displayName: 'Mohamed Salah',
    email: 'm.salah@bledi.employee.tn',
    role: 'employee',
    assignedRegion: 'Hammam Sousse',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    uid: 'staff_leila_003',
    displayName: 'Leila Ben Ali',
    email: 'l.benali@bledi.employee.tn',
    role: 'employee',
    assignedRegion: 'Msaken',
    isActive: false, // Pre-configured suspended account for testing
    createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
];

type StaffListener = (staff: StaffMember[]) => void;
let staffListeners: StaffListener[] = [];

function notifyStaffListeners() {
  const snapshot = [...localStaffStore];
  staffListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (e) {
      console.warn('[StaffStore] Listener failure:', e);
    }
  });
}

/**
 * Real-time subscription to municipal staff roster
 */
export function subscribeToStaffMembers(
  onUpdate: (staff: StaffMember[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    onUpdate([...localStaffStore]);
    const listener: StaffListener = (updated) => onUpdate(updated);
    staffListeners.push(listener);
    return () => {
      staffListeners = staffListeners.filter((l) => l !== listener);
    };
  }

  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'employee')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const staffList: StaffMember[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            uid: docSnap.id,
            displayName: data.displayName || 'Agent Municipal',
            email: data.email || '',
            role: 'employee',
            assignedRegion: data.assignedRegion || 'Sousse Médina',
            isActive: data.isActive !== false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        onUpdate(staffList);
      },
      (err) => {
        onError?.(normalizeSecurityError(err, 'Impossible de charger la liste du personnel.'));
      }
    );
  } catch (err) {
    onError?.(normalizeSecurityError(err, 'Erreur lors de la connexion au répertoire du personnel.'));
    return () => {};
  }
}

/**
 * Register a new municipal worker without logging out the active Admin.
 * Uses secondary Firebase App pattern to isolate credential creation.
 */
export async function createEmployeeAccount(params: {
  displayName: string;
  email: string;
  password: string;
  assignedRegion: string;
}): Promise<{ uid: string; email: string }> {
  const trimmedName = params.displayName.trim();
  const trimmedEmail = params.email.trim().toLowerCase();
  const trimmedPass = params.password.trim();
  const trimmedRegion = params.assignedRegion.trim();

  if (trimmedName.length < 2) {
    throw new AppSecurityError('invalid-argument', 'Le nom complet doit contenir au moins 2 caractères.');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new AppSecurityError('invalid-argument', 'Adresse email officielle invalide.');
  }
  if (trimmedPass.length < 6) {
    throw new AppSecurityError('invalid-argument', 'Le mot de passe temporaire doit comporter au moins 6 caractères.');
  }
  if (!trimmedRegion) {
    throw new AppSecurityError('invalid-argument', 'Veuillez sélectionner une Délégation / Mo3tamdiya.');
  }

  // DEMO MODE: register locally and notify subscribers
  if (!isFirebaseConfigured) {
    const existing = localStaffStore.find((s) => s.email === trimmedEmail);
    if (existing) {
      throw new AppSecurityError('already-exists', `Un agent avec l'adresse ${trimmedEmail} existe déjà.`);
    }

    const newUid = `emp_${Date.now()}`;
    const newStaff: StaffMember = {
      uid: newUid,
      displayName: trimmedName,
      email: trimmedEmail,
      role: 'employee',
      assignedRegion: trimmedRegion,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStaffStore = [newStaff, ...localStaffStore];
    notifyStaffListeners();
    return { uid: newUid, email: trimmedEmail };
  }

  // LIVE FIREBASE: Secondary Firebase App pattern
  const secondaryAppName = `StaffProvision_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      trimmedEmail,
      trimmedPass
    );
    const newUid = userCredential.user.uid;

    await updateProfile(userCredential.user, {
      displayName: trimmedName,
    });

    // Write authoritative user profile into Firestore /users/{uid}
    await setDoc(doc(db, 'users', newUid), {
      uid: newUid,
      email: trimmedEmail,
      displayName: trimmedName,
      role: 'employee',
      assignedRegion: trimmedRegion,
      isActive: true,
      points: 0,
      badge: 'Civic Guardian',
      reportsCount: 0,
      resolvedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Sign out from the isolated secondary auth instance
    await secondarySignOut(secondaryAuth).catch(() => {});

    return { uid: newUid, email: trimmedEmail };
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      throw new AppSecurityError('already-exists', `Cet email (${trimmedEmail}) est déjà utilisé.`);
    }
    throw normalizeSecurityError(err, 'Échec de la création du compte employé municipal.');
  } finally {
    // Teardown the secondary app so no dangling instance remains
    await deleteApp(secondaryApp).catch(() => {});
  }
}

/**
 * Suspend or reactivate a municipal employee account.
 */
export async function toggleEmployeeStatus(uid: string, nextStatus: boolean): Promise<void> {
  if (!isFirebaseConfigured) {
    const idx = localStaffStore.findIndex((s) => s.uid === uid);
    if (idx !== -1) {
      localStaffStore[idx] = {
        ...localStaffStore[idx],
        isActive: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      notifyStaffListeners();
    }
    return;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      isActive: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw normalizeSecurityError(err, 'Impossible de modifier le statut de l\'agent.');
  }
}

/**
 * Reassign an employee to a different Délégation / Mo3tamdiya.
 */
export async function updateEmployeeRegion(uid: string, newRegion: string): Promise<void> {
  const cleanRegion = newRegion.trim();
  if (!cleanRegion) {
    throw new AppSecurityError('invalid-argument', 'Délégation invalide.');
  }

  if (!isFirebaseConfigured) {
    const idx = localStaffStore.findIndex((s) => s.uid === uid);
    if (idx !== -1) {
      localStaffStore[idx] = {
        ...localStaffStore[idx],
        assignedRegion: cleanRegion,
        updatedAt: new Date().toISOString(),
      };
      notifyStaffListeners();
    }
    return;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      assignedRegion: cleanRegion,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw normalizeSecurityError(err, 'Impossible de réaffecter la délégation.');
  }
}
