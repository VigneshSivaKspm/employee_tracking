import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { auth, db } from '../services/firebase';
import {
  signInWithEmailAndPassword as fbSignIn,
  onAuthStateChanged,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import * as LocalAuthentication from 'expo-local-authentication';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  signIn: (identifier: string, password: string) => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveEmail(identifier: string): Promise<string> {
  if (identifier.includes('@')) {
    console.log('[Auth] resolveEmail: identifier is email, using as-is:', identifier);
    return identifier;
  }
  console.log('[Auth] resolveEmail: looking up employeeId in Firestore:', identifier);
  try {
    const q = query(collection(db, 'employees'), where('employeeId', '==', identifier));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const email = snap.docs[0].data().email as string;
      console.log('[Auth] resolveEmail: found employee, email:', email);
      return email;
    }
    console.warn('[Auth] resolveEmail: no employee found with employeeId:', identifier);
  } catch (e: any) {
    console.error('[Auth] resolveEmail error:', e?.code ?? e?.message);
  }
  console.log('[Auth] resolveEmail: falling back to identifier as email');
  return identifier;
}

async function fetchUserProfile(uid: string): Promise<User | null> {
  console.log('[Auth] fetchUserProfile uid:', uid);
  try {
    const snap = await getDoc(doc(db, 'employees', uid));
    if (!snap.exists()) {
      console.warn('[Auth] fetchUserProfile: no Firestore doc for uid:', uid);
      return null;
    }
    const d = snap.data();
    console.log('[Auth] fetchUserProfile: loaded profile, name:', d.name, 'employeeId:', d.employeeId);
    return {
      id: uid,
      name: d.name || '',
      email: d.email || '',
      employeeId: d.employeeId || '',
      designation: d.designation || '',
      department: d.department || '',
      phone: d.phone || '',
      emergencyContact: d.emergencyContact || '',
      emergencyPhone: d.emergencyPhone || '',
      joinDate: d.joinDate || '',
    };
  } catch (e: any) {
    console.error('[Auth] fetchUserProfile error:', e?.code ?? e?.message);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Auth] Setting up onAuthStateChanged listener');
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged fired — firebaseUser:', firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        if (profile) {
          console.log('[Auth] Profile loaded, setting user. isAuthenticated will be true');
          setUser(profile);
        } else {
          console.log('[Auth] No Firestore profile, using Firebase user fallback');
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Employee',
            email: firebaseUser.email || '',
            employeeId: '',
            designation: '',
            department: '',
            phone: '',
            emergencyContact: '',
            emergencyPhone: '',
            joinDate: '',
          });
        }
      } else {
        console.log('[Auth] No Firebase user — setting user to null');
        setUser(null);
      }
      setIsLoading(false);
      console.log('[Auth] isLoading set to false');
    });
    return unsub;
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    console.log('[Auth] login() called with identifier:', identifier);
    setIsLoading(true);
    setError(null);
    try {
      const email = await resolveEmail(identifier);
      console.log('[Auth] Attempting fbSignIn with email:', email);
      await fbSignIn(auth, email, password);
      console.log('[Auth] fbSignIn succeeded — onAuthStateChanged will fire next');
      return true;
    } catch (e: any) {
      const code = e?.code ?? '';
      console.error('[Auth] fbSignIn error code:', code, 'message:', e?.message);
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Invalid credentials. Please check your Employee ID / Email and password.'
          : `Login failed (${code}). Please try again.`,
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithBiometric = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const [hasHW, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      if (hasHW && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your identity',
          fallbackLabel: 'Use Password',
          cancelLabel: 'Cancel',
        });
        if (!result.success) {
          setError('Biometric authentication failed. Please try again.');
          return false;
        }
      }

      if (auth.currentUser) {
        const profile = await fetchUserProfile(auth.currentUser.uid);
        if (profile) {
          setUser(profile);
          return true;
        }
      }

      setError('Please log in with your credentials first to enable biometric sign-in.');
      return false;
    } catch {
      setError('Biometric authentication failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    console.log('[Auth] logout() called');
    setIsLoading(true);
    try {
      await fbSignOut(auth);
      console.log('[Auth] fbSignOut done');
    } finally {
      setIsLoading(false);
    }
  }, []);

  console.log('[Auth] AuthProvider render — isAuthenticated:', !!user, 'isLoading:', isLoading);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, error, login, signIn: login, loginWithBiometric, logout, signOut: logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
