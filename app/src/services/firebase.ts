import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('[Firebase] Init — projectId:', firebaseConfig.projectId ?? 'MISSING');
console.log('[Firebase] Init — apiKey set:', !!firebaseConfig.apiKey);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log('[Firebase] App name:', app.name);

// Try AsyncStorage persistence; fall back to in-memory (still works within a session)
let auth;
try {
  // Dynamic require so a missing native module doesn't crash the import
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('[Firebase] Auth: AsyncStorage persistence enabled');
} catch (e: any) {
  console.warn('[Firebase] Auth persistence fallback (in-memory):', e?.code ?? e?.message);
  try {
    auth = getAuth(app);
  } catch {
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
console.log('[Firebase] Ready — auth:', !!auth, 'db:', !!db, 'storage:', !!storage);
