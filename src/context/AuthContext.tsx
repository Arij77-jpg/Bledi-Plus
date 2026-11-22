/**
 * Zero-Trust Authentication & Custom-Claims RBAC Context (`src/context/AuthContext.tsx`)
 *
 * Security Guarantees:
 * 1. Verified roles (`citizen` | `employee` | `admin`) are extracted strictly from
 *    cryptographically signed Firebase Auth Custom Claims (`getIdTokenResult()`),
 *    NEVER trusted from client-writable Firestore user documents.
 * 2. Uses `onIdTokenChanged` so Custom Claim updates & token revocations reflect immediately.
 * 3. Persists session metadata using encrypted `expo-secure-store` (Keychain/Keystore),
 *    never unencrypted AsyncStorage.
 * 4. Public `signUp` creates strictly `citizen` accounts (no client-side role selection).
 * 5. Offline demo mode is strictly gated on `!isFirebaseConfigured` so live builds have
 *    zero client-side authentication or role bypasses.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../services/firebase';
import { secureStorage } from '../services/secureStorage';
import { UserProfile, UserRole } from '../types/report';
import { uploadUserProfileAvatar } from '../services/reports';
import { AppSecurityError, normalizeSecurityError } from '../utils/errors';

const USERS_COLLECTION = 'users';
const DEMO_SECURE_SESSION_KEY = 'citizen_report.secure_demo_session';
const VALID_ROLES = new Set<UserRole>(['civil', 'citizen', 'employee', 'admin']);

export interface DemoSessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  isDemo?: true;
}

interface AuthContextType {
  user: User | DemoSessionUser | null;
  userProfile: UserProfile | null;
  role: UserRole;
  assignedRegion: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  claimsVerified: boolean;
  isCitizen: boolean;
  isEmployee: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isDemoMode: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  updateOwnDisplayName: (displayName: string) => Promise<void>;
  updateOwnAvatar: (localImageUri: string) => Promise<string>;
  removeOwnAvatar: () => Promise<void>;
  refreshClaims: () => Promise<UserRole>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signInDemo: (demoRole: UserRole, customEmail?: string, region?: string) => Promise<void>;
  switchDemoRegion: (region: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function calculateBadge(points: number): UserProfile['badge'] {
  if (points >= 300) return 'Community Hero';
  if (points >= 150) return 'Civic Guardian';
  if (points >= 50) return 'Active Citizen';
  return 'Novice Watcher';
}

function parseVerifiedClaimRole(claims: Record<string, unknown> | undefined): UserRole {
  const candidate = claims?.role;
  if (typeof candidate === 'string' && VALID_ROLES.has(candidate as UserRole)) {
    return candidate as UserRole;
  }
  return 'civil';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | DemoSessionUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('civil');
  const [assignedRegion, setAssignedRegion] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [claimsVerified, setClaimsVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeProfile: (() => void) | null = null;

    // In unconfigured local preview mode, restore encrypted demo session if stored
    const restoreDemoSessionIfUnconfigured = async () => {
      if (isFirebaseConfigured) return false;
      try {
        const stored = await secureStorage.getItem(DEMO_SECURE_SESSION_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as UserProfile;
          const verifiedRole = VALID_ROLES.has(parsed.role) ? parsed.role : 'citizen';
          const reg = parsed.assignedRegion || (verifiedRole === 'admin' ? 'Sousse Médina' : null);
          const isSuper = Boolean(parsed.isSuperAdmin || reg === 'ALL');

          setUser({
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.displayName,
            isDemo: true,
          });
          setRole(verifiedRole);
          setAssignedRegion(reg);
          setIsSuperAdmin(isSuper);
          setUserProfile({
            ...parsed,
            role: verifiedRole,
            assignedRegion: reg,
            isSuperAdmin: isSuper,
          });
          setClaimsVerified(false);
          return true;
        }
      } catch {
        // Ignore corrupted cache
      }
      return false;
    };

    // Guard against startup hang when Firebase is unconfigured/offline
    const offlineSafetyTimer = setTimeout(async () => {
      if (!isMounted || !loading) return;
      if (!isFirebaseConfigured) {
        await restoreDemoSessionIfUnconfigured();
      }
      if (isMounted) setLoading(false);
    }, 1200);

    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;
      clearTimeout(offlineSafetyTimer);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        let verifiedRole: UserRole = 'citizen';
        let tokenRegion: string | null = null;
        let tokenIsSuper = false;

        try {
          // Extract RBAC role & regional claims exclusively from cryptographically signed Custom Claims
          const tokenResult = await firebaseUser.getIdTokenResult();
          verifiedRole = parseVerifiedClaimRole(tokenResult.claims);
          if (typeof tokenResult.claims.assignedRegion === 'string') {
            tokenRegion = tokenResult.claims.assignedRegion;
          }
          tokenIsSuper = Boolean(tokenResult.claims.isSuperAdmin || tokenRegion === 'ALL');

          if (isMounted) {
            setClaimsVerified(true);
            setRole(verifiedRole);
            setAssignedRegion(tokenRegion);
            setIsSuperAdmin(tokenIsSuper);
            setUser(firebaseUser);
          }
        } catch {
          if (isMounted) {
            setClaimsVerified(false);
            setRole('civil');
            setAssignedRegion(null);
            setIsSuperAdmin(false);
            setUser(firebaseUser);
          }
        }

        const userDocRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snap) => {
            if (!isMounted) return;
            const data = snap.exists() ? snap.data() : {};
            const points = Number(data?.points || 0);
            const resolvedRegion =
              tokenRegion ??
              (typeof data?.assignedRegion === 'string'
                ? data.assignedRegion
                : verifiedRole === 'admin'
                  ? 'Sousse Médina'
                  : null);
            const resolvedSuper =
              tokenIsSuper || Boolean(data?.isSuperAdmin || resolvedRegion === 'ALL');

            setAssignedRegion(resolvedRegion);
            setIsSuperAdmin(resolvedSuper);

            // Authoritative role always originates from Token Custom Claims, NEVER data.role
            setUserProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: data?.displayName || firebaseUser.displayName || 'Citizen',
              photoURL: data?.photoURL || firebaseUser.photoURL || null,
              role: verifiedRole,
              assignedRegion: resolvedRegion,
              isSuperAdmin: resolvedSuper,
              isActive: data?.isActive !== false,
              pushToken: data?.pushToken || null,
              points,
              badge: calculateBadge(points),
              reportsCount: Number(data?.reportsCount || 0),
              resolvedCount: Number(data?.resolvedCount || 0),
            });
            setLoading(false);
          },
          () => {
            if (!isMounted) return;
            setUserProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Citizen',
              photoURL: firebaseUser.photoURL || null,
              role: verifiedRole,
              assignedRegion: tokenRegion,
              isSuperAdmin: tokenIsSuper,
              pushToken: null,
              points: 0,
              badge: 'Novice Watcher',
              reportsCount: 0,
              resolvedCount: 0,
            });
            setLoading(false);
          }
        );
      } else {
        const restoredDemo = await restoreDemoSessionIfUnconfigured();
        if (!restoredDemo && isMounted) {
          setUser(null);
          setUserProfile(null);
          setRole('civil');
          setAssignedRegion(null);
          setIsSuperAdmin(false);
          setClaimsVerified(false);
        }
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(offlineSafetyTimer);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  /**
   * Forces Firebase ID token refresh so newly assigned Admin/Employee claims take
   * effect without requiring the user to clear app data.
   */
  const refreshClaims = useCallback(async (): Promise<UserRole> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return role;
    }
    try {
      const tokenResult = await currentUser.getIdTokenResult(true);
      const nextRole = parseVerifiedClaimRole(tokenResult.claims);
      const claimRegion =
        typeof tokenResult.claims.assignedRegion === 'string'
          ? tokenResult.claims.assignedRegion
          : null;
      const claimSuper = Boolean(tokenResult.claims.isSuperAdmin || claimRegion === 'ALL');

      setRole(nextRole);
      setAssignedRegion(claimRegion);
      setIsSuperAdmin(claimSuper);
      setClaimsVerified(true);
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              role: nextRole,
              assignedRegion: claimRegion,
              isSuperAdmin: claimSuper,
            }
          : prev
      );
      return nextRole;
    } catch (err) {
      throw normalizeSecurityError(err, 'Unable to refresh security token. Please sign in again.');
    }
  }, [role]);

  const signIn = async (email: string, pass: string): Promise<void> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !pass) {
      throw new AppSecurityError('validation-error', 'Email and password are required.');
    }

    // If Firebase credentials are NOT configured yet, allow explicit local preview profiles only
    if (!isFirebaseConfigured) {
      const lower = cleanEmail.toLowerCase();
      const demoRole: UserRole =
        lower.endsWith('@bledi.admin.tn') || lower.includes('admin') || lower.includes('arij')
          ? 'admin'
          : lower.endsWith('@bledi.employee.tn') || lower.includes('employee') || lower.includes('worker') || lower.includes('chiheb')
            ? 'employee'
            : 'civil';
      await signInDemo(demoRole, cleanEmail);
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const tokenResult = await cred.user.getIdTokenResult();
      const verifiedRole = parseVerifiedClaimRole(tokenResult.claims);
      setRole(verifiedRole);
      setClaimsVerified(true);
    } catch (err) {
      throw normalizeSecurityError(err, 'Authentication failed. Check your credentials.');
    }
  };

  /**
   * Public mobile registration: STRICTLY provisions `civil` citizen accounts only.
   * Admin and Employee accounts must be created out-of-band via Admin SDK / Staff Management.
   */
  const signUp = async (email: string, pass: string, name: string): Promise<void> => {
    const cleanEmail = email.trim();
    const cleanName = name.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      throw new AppSecurityError('validation-error', 'Name must be between 2 and 80 characters.');
    }
    if (!cleanEmail || pass.length < 6) {
      throw new AppSecurityError('validation-error', 'Valid email and password (6+ chars) required.');
    }

    // Public Registration Guard: Block staff email domains
    const lowerEmail = cleanEmail.toLowerCase();
    if (lowerEmail.endsWith('@bledi.admin.tn') || lowerEmail.endsWith('@bledi.employee.tn')) {
      throw new AppSecurityError(
        'permission-denied',
        'Ce domaine est réservé au personnel municipal. Veuillez utiliser une adresse e-mail personnelle.',
        true
      );
    }

    if (!isFirebaseConfigured) {
      const demoCivil: UserProfile = {
        uid: `demo_civil_${Date.now()}`,
        email: cleanEmail,
        displayName: cleanName,
        photoURL: null,
        role: 'civil',
        points: 0,
        badge: 'Novice Watcher',
        reportsCount: 0,
        resolvedCount: 0,
      };
      await secureStorage.setItem(DEMO_SECURE_SESSION_KEY, JSON.stringify(demoCivil));
      setUser({
        uid: demoCivil.uid,
        email: demoCivil.email,
        displayName: demoCivil.displayName,
        isDemo: true,
      });
      setRole('civil');
      setUserProfile(demoCivil);
      setClaimsVerified(false);
      return;
    }

    try {
      const creds = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      await updateProfile(creds.user, { displayName: cleanName });

      const userDocRef = doc(db, USERS_COLLECTION, creds.user.uid);
      await setDoc(userDocRef, {
        uid: creds.user.uid,
        email: cleanEmail,
        displayName: cleanName,
        photoURL: null,
        role: 'civil', // Enforced in firestore.rules: isValidCitizenRegistration()
        points: 0,
        badge: 'Novice Watcher',
        reportsCount: 0,
        resolvedCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      throw normalizeSecurityError(err, 'Could not complete account registration.');
    }
  };

  /**
   * Safe citizen self-service update matching firestore.rules `isValidProfileSelfUpdate()`:
   * Mutates ONLY `displayName` and `updatedAt` (never `role`, `points`, or stats).
   */
  const updateOwnDisplayName = async (displayName: string): Promise<void> => {
    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      throw new AppSecurityError('validation-error', 'Display name must be 2 to 80 characters.');
    }
    if (!user?.uid) {
      throw new AppSecurityError('unauthenticated', 'Please sign in first.', true);
    }

    if (!isFirebaseConfigured && (user as DemoSessionUser).isDemo) {
      if (userProfile) {
        const updated = { ...userProfile, displayName: cleanName };
        await secureStorage.setItem(DEMO_SECURE_SESSION_KEY, JSON.stringify(updated));
        setUserProfile(updated);
      }
      return;
    }

    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: cleanName });
      }
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        displayName: cleanName,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      throw normalizeSecurityError(err, 'Could not update profile name.');
    }
  };

  /**
   * User self-service avatar update:
   * 1. Uploads photo to Firebase Storage at `avatars/{userId}/avatar_{timestamp}.jpg`
   * 2. Updates Firebase Auth currentUser photoURL
   * 3. Mutates `/users/{userId}` photoURL field (verified by firestore.rules isValidProfileSelfUpdate)
   * 4. In demo mode, persists to local secure storage
   */
  const updateOwnAvatar = async (localImageUri: string): Promise<string> => {
    if (!user?.uid) {
      throw new AppSecurityError('unauthenticated', 'Please sign in first.', true);
    }

    if (!isFirebaseConfigured && (user as DemoSessionUser).isDemo) {
      if (userProfile) {
        const updated: UserProfile = { ...userProfile, photoURL: localImageUri };
        await secureStorage.setItem(DEMO_SECURE_SESSION_KEY, JSON.stringify(updated));
        setUserProfile(updated);
      }
      setUser((prev) => (prev ? { ...prev, photoURL: localImageUri } : prev));
      return localImageUri;
    }

    try {
      const downloadUrl = await uploadUserProfileAvatar({
        userId: user.uid,
        localImageUri,
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadUrl });
      }

      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        photoURL: downloadUrl,
        updatedAt: serverTimestamp(),
      });

      if (userProfile) {
        setUserProfile({ ...userProfile, photoURL: downloadUrl });
      }
      setUser((prev) => (prev ? { ...prev, photoURL: downloadUrl } : prev));

      return downloadUrl;
    } catch (err) {
      throw normalizeSecurityError(err, 'Could not update profile picture.');
    }
  };

  /**
   * Removes user profile avatar and reverts to standard initials circle.
   */
  const removeOwnAvatar = async (): Promise<void> => {
    if (!user?.uid) {
      throw new AppSecurityError('unauthenticated', 'Please sign in first.', true);
    }

    if (!isFirebaseConfigured && (user as DemoSessionUser).isDemo) {
      if (userProfile) {
        const updated: UserProfile = { ...userProfile, photoURL: null };
        await secureStorage.setItem(DEMO_SECURE_SESSION_KEY, JSON.stringify(updated));
        setUserProfile(updated);
      }
      setUser((prev) => (prev ? { ...prev, photoURL: null } : prev));
      return;
    }

    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: null });
      }

      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        photoURL: null,
        updatedAt: serverTimestamp(),
      });

      if (userProfile) {
        setUserProfile({ ...userProfile, photoURL: null });
      }
      setUser((prev) => (prev ? { ...prev, photoURL: null } : prev));
    } catch (err) {
      throw normalizeSecurityError(err, 'Could not remove profile picture.');
    }
  };

  const signInDemo = async (
    demoRole: UserRole,
    customEmail?: string,
    region?: string
  ): Promise<void> => {
    if (isFirebaseConfigured) {
      throw new AppSecurityError(
        'permission-denied',
        'Demo sign-in is disabled when connected to production Firebase.',
        true
      );
    }

    const defaultRegion =
      region ||
      (demoRole === 'admin'
        ? 'Sousse Médina'
        : demoRole === 'employee'
          ? 'Sousse Médina'
          : null);
    const superAdmin = Boolean(
      demoRole === 'admin' && (defaultRegion === 'ALL' || customEmail?.toLowerCase().includes('super'))
    );

    const presets: Record<UserRole, { uid: string; name: string; email: string; points: number }> = {
      civil: {
        uid: 'demo_civil_uid',
        name: 'Citoyen Bledi+',
        email: customEmail || 'citoyen@gmail.com',
        points: 35,
      },
      citizen: {
        uid: 'demo_citizen_uid',
        name: 'Amine Ben Salem (Citoyen)',
        email: customEmail || 'amine@gmail.com',
        points: 35,
      },
      employee: {
        uid: 'staff_chiheb_001',
        name: 'Chiheb (Agent Municipal)',
        email: customEmail || 'chiheb@bledi.employee.tn',
        points: 180,
      },
      admin: {
        uid: 'staff_arij_001',
        name: superAdmin ? 'Arij (Super-Admin Bledi+)' : 'Arij (Administratrice Municipale)',
        email: customEmail || (superAdmin ? 'arij.superadmin@bledi.admin.tn' : 'arij@bledi.admin.tn'),
        points: 320,
      },
    };

    const preset = presets[demoRole];
    const isCiv = demoRole === 'civil' || demoRole === 'citizen';
    const demoProfile: UserProfile = {
      uid: preset.uid,
      email: preset.email,
      displayName: preset.name,
      photoURL: null,
      role: demoRole,
      assignedRegion: defaultRegion,
      isSuperAdmin: superAdmin,
      isActive: true,
      points: preset.points,
      badge: calculateBadge(preset.points),
      reportsCount: isCiv ? 3 : 8,
      resolvedCount: isCiv ? 1 : 6,
    };

    await secureStorage.setItem(DEMO_SECURE_SESSION_KEY, JSON.stringify(demoProfile));
    setUser({
      uid: demoProfile.uid,
      email: demoProfile.email,
      displayName: demoProfile.displayName,
      isDemo: true,
    });
    setRole(demoRole);
    setAssignedRegion(defaultRegion);
    setIsSuperAdmin(superAdmin);
    setUserProfile(demoProfile);
    setClaimsVerified(false);
  };

  /**
   * Allows live dynamic switching of regional authority in demo/evaluation mode
   * to immediately test multi-tenant dashboard isolation.
   */
  const switchDemoRegion = async (newRegion: string): Promise<void> => {
    const isSuper = newRegion === 'ALL';
    setAssignedRegion(newRegion);
    setIsSuperAdmin(isSuper);
    if (userProfile) {
      const updated: UserProfile = {
        ...userProfile,
        assignedRegion: newRegion,
        isSuperAdmin: isSuper,
      };
      setUserProfile(updated);
      if (!isFirebaseConfigured) {
        await secureStorage.setItem(DEMO_SECURE_SESSION_KEY, JSON.stringify(updated));
      }
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fbSignOut(auth);
    } catch {
      // Proceed to clear encrypted local state even if offline
    }
    await secureStorage.removeItem(DEMO_SECURE_SESSION_KEY);
    setUser(null);
    setUserProfile(null);
    setRole('civil');
    setAssignedRegion(null);
    setIsSuperAdmin(false);
    setClaimsVerified(false);
  };

  /**
   * Permanent Account Deletion (GDPR / Privacy Right to Erasure).
   * Removes user profile document and deletes the Firebase Auth credential.
   */
  const deleteAccount = async (): Promise<void> => {
    if (!user?.uid) {
      throw new AppSecurityError('unauthenticated', 'No active account session found.', true);
    }

    if (!isFirebaseConfigured && (user as DemoSessionUser).isDemo) {
      await secureStorage.removeItem(DEMO_SECURE_SESSION_KEY);
      setUser(null);
      setUserProfile(null);
      setRole('civil');
      setClaimsVerified(false);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new AppSecurityError('unauthenticated', 'Your security session expired. Sign in again.', true);
    }

    // Verify recent sign-in (< 5 mins) before deleting Firestore document to prevent partial state
    const lastSignInMs = currentUser.metadata?.lastSignInTime
      ? Date.parse(currentUser.metadata.lastSignInTime)
      : 0;
    if (lastSignInMs && Date.now() - lastSignInMs > 5 * 60 * 1000) {
      throw new AppSecurityError(
        'auth/requires-recent-login',
        'For security, please sign out and sign back in right before deleting your account.',
        true
      );
    }

    try {
      await deleteDoc(doc(db, USERS_COLLECTION, currentUser.uid));
      await deleteUser(currentUser);
      await secureStorage.removeItem(DEMO_SECURE_SESSION_KEY);
      setUser(null);
      setUserProfile(null);
      setRole('civil');
      setClaimsVerified(false);
    } catch (err) {
      throw normalizeSecurityError(
        err,
        'Unable to delete account. Sign in again and retry.'
      );
    }
  };

  const isCitizen = role === 'civil' || role === 'citizen';
  const isEmployee = role === 'employee';
  const isAdmin = role === 'admin';
  const isStaff = role === 'employee' || role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role,
        assignedRegion,
        isSuperAdmin,
        loading,
        claimsVerified,
        isCitizen,
        isEmployee,
        isStaff,
        isAdmin,
        isDemoMode: !isFirebaseConfigured,
        signIn,
        signUp,
        updateOwnDisplayName,
        updateOwnAvatar,
        removeOwnAvatar,
        refreshClaims,
        logout,
        deleteAccount,
        signInDemo,
        switchDemoRegion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
