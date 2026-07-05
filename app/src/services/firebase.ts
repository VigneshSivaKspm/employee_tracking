import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('[Firebase] Config check — projectId:', firebaseConfig.projectId ?? 'MISSING');
console.log('[Firebase] Config check — apiKey set:', !!firebaseConfig.apiKey);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log('[Firebase] App initialized, name:', app.name);

// Use AsyncStorage persistence so auth sessions survive app restarts
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('[Firebase] Auth initialized with AsyncStorage persistence');
} catch (e: any) {
  console.log('[Firebase] initializeAuth threw (already initialized?):', e?.code ?? e?.message);
  auth = getAuth(app);
  console.log('[Firebase] Auth obtained via getAuth fallback');
}

export { auth };
export const db = getFirestore(app);
console.log('[Firebase] Firestore initialized');
