import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCYTV15D-fAxQ8Xf25fEjv0VGCHB8jbFmo',
  authDomain: 'niklaus-sms.firebaseapp.com',
  projectId: 'niklaus-sms',
  storageBucket: 'niklaus-sms.firebasestorage.app',
  messagingSenderId: '960099181513',
  appId: '1:960099181513:web:6e10699f60c1bf66797e18',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const fbAuth = getAuth(app);
export const db = getFirestore(app);
