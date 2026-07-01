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
  if (identifier.includes('@')) return identifier;
  try {
    const q = query(collection(db, 'employees'), where('employeeId', '==', identifier));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().email as string;
  } catch {}
  return identifier;
}

async function fetchUserProfile(uid: string): Promise<User | null> {
  try {
    const snap = await getDoc(doc(db, 'employees', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
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
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        setUser(profile ?? {
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
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const email = await resolveEmail(identifier);
      await fbSignIn(auth, email, password);
      return true;
    } catch (e: any) {
      const code = e?.code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Invalid credentials. Please check your Employee ID / Email and password.'
          : 'Login failed. Please try again.',
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

      // If biometric passed (or no biometric), restore existing Firebase session
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
    setIsLoading(true);
    try {
      await fbSignOut(auth);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
