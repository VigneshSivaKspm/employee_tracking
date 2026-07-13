import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

console.log('[Firebase] Init — projectId:', firebaseConfig.projectId ?? 'MISSING');
console.log('[Firebase] Init — apiKey set:', !!firebaseConfig.apiKey);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log('[Firebase] App name:', app.name);

    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
      console.log('[Firebase] Auth: AsyncStorage persistence enabled');
    } catch (e: any) {
      console.warn('[Firebase] Auth persistence fallback (in-memory):', e?.code ?? e?.message);
      auth = getAuth(app);
    }

    db = getFirestore(app);
    storage = getStorage(app);
    console.log('[Firebase] Ready — auth:', !!auth, 'db:', !!db, 'storage:', !!storage);
  } catch (e: any) {
    console.error('[Firebase] Initialization failed:', e?.code ?? e?.message);
  }
} else {
  console.error('[Firebase] Missing EXPO_PUBLIC_FIREBASE_* env vars. Copy .env.example to .env and rebuild.');
}

export { app, auth, db, storage };
