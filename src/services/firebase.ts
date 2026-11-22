/**
 * Production Firebase Configuration & Hardened Initialization
 *
 * Uses `expo-secure-store` (chunked Keychain/Keystore adapter) via Firebase Auth's
 * `getReactNativePersistence` instead of plaintext AsyncStorage.
 */

import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { secureStorage } from './secureStorage';

// Replace with your Firebase Project Configuration from the Firebase Console:
// Project Settings > General > Your apps > Web app
export const firebaseConfig = {
  apiKey: 'AIzaSyYOUR_FIREBASE_API_KEY',
  authDomain: 'citizen-reporting-mini-project.firebaseapp.com',
  projectId: 'citizen-reporting-mini-project',
  storageBucket: 'citizen-reporting-mini-project.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456',
};

/**
 * Security Switch: Evaluates strictly false until real Firebase credentials are configured.
 * Demo offline preview shortcuts only run when `isFirebaseConfigured === false`.
 * With live Firebase credentials, ZERO client bypasses or demo fallbacks are allowed.
 */
export const isFirebaseConfigured: boolean =
  Boolean(firebaseConfig.apiKey) &&
  !firebaseConfig.apiKey.includes('YOUR_FIREBASE_API_KEY') &&
  !firebaseConfig.projectId.includes('mini-project');

// Singleton pattern: Avoid re-initializing the Firebase app on React Native Fast Refresh
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Hardware-backed React Native auth persistence via expo-secure-store.
 * On Web, Firebase defaults to secure IndexedDB/session persistence.
 */
let auth: firebaseAuth.Auth;
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;

if (Platform.OS !== 'web' && typeof getReactNativePersistence === 'function') {
  try {
    auth = firebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence(secureStorage),
    });
  } catch {
    // Fallback when auth was already initialized during Fast Refresh
    auth = firebaseAuth.getAuth(app);
  }
} else {
  auth = firebaseAuth.getAuth(app);
}

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
