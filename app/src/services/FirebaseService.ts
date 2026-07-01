import {
  signInWithEmailAndPassword,
  signOut as firebaseAuthSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AttendanceRecord, LeaveRequest, User } from '../types';

function formatTimeStr(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function firebaseSignIn(email: string, password: string): Promise<{ uid: string } | null> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { uid: credential.user.uid };
  } catch (error) {
    console.error('[Firebase] signIn error:', error);
    return null;
  }
}

export async function firebaseSignUp(email: string, password: string): Promise<{ uid: string } | null> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return { uid: credential.user.uid };
  } catch (error) {
    console.error('[Firebase] signUp error:', error);
    return null;
  }
}

export async function firebaseSignOut(): Promise<void> {
  try {
    await firebaseAuthSignOut(auth);
  } catch (error) {
    console.error('[Firebase] signOut error:', error);
  }
}

export async function firebaseForgotPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface PunchInMeta {
  date: string;
  clockIn: string;
  status: string;
  isRemote: boolean;
  employeeId?: string;
  employeeName?: string;
  dept?: string;
}

export async function recordPunchIn(
  userId: string,
  coordinates: { lat: number; lng: number },
  meta: PunchInMeta,
): Promise<string> {
  const payload = {
    userId,
    date: meta.date,
    clockIn: meta.clockIn,
    clockOut: null,
    status: meta.status,
    isRemote: meta.isRemote,
    totalHours: 0,
    coordinates,
    employeeId: meta.employeeId || '',
    employeeName: meta.employeeName || '',
    dept: meta.dept || '',
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'attendance'), payload);
  return docRef.id;
}

export async function recordPunchOut(
  userId: string,
  attendanceDocId: string,
  coordinates: { lat: number; lng: number },
  totalHours: number,
  clockOut: string,
): Promise<void> {
  await updateDoc(doc(db, 'attendance', attendanceDocId), {
    clockOut,
    coordinates,
    totalHours,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchAttendanceHistory(userId: string, limitCount = 60): Promise<AttendanceRecord[]> {
  try {
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(limitCount),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        date: data.date || '',
        clockIn: data.clockIn || null,
        clockOut: data.clockOut || null,
        status: data.status || 'absent',
        totalHours: data.totalHours || 0,
        isRemote: data.isRemote || false,
      } as AttendanceRecord;
    });
  } catch (error) {
    console.error('[Firebase] fetchAttendanceHistory error:', error);
    return [];
  }
}

// ─── Leave Management ─────────────────────────────────────────────────────────

export interface LeaveSubmitMeta {
  employeeId?: string;
  employeeName?: string;
  dept?: string;
}

export async function submitLeaveRequest(
  userId: string,
  leave: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'> & LeaveSubmitMeta,
): Promise<string> {
  const appliedOn = new Date().toISOString().split('T')[0];
  const payload = {
    ...leave,
    userId,
    status: 'pending',
    appliedOn,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'leaveRequests'), payload);
  return docRef.id;
}

export async function fetchLeaveHistory(userId: string): Promise<LeaveRequest[]> {
  try {
    const q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', userId),
      orderBy('appliedOn', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
  } catch (error) {
    console.error('[Firebase] fetchLeaveHistory error:', error);
    return [];
  }
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function fetchUserProfile(uid: string): Promise<User | null> {
  try {
    const snap = await getDoc(doc(db, 'employees', uid));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null;
  } catch (error) {
    console.error('[Firebase] fetchUserProfile error:', error);
    return null;
  }
}

export async function updateUserProfile(uid: string, updates: Partial<User>): Promise<void> {
  await updateDoc(doc(db, 'employees', uid), { ...updates, updatedAt: serverTimestamp() });
}

// ─── Location Heartbeat ───────────────────────────────────────────────────────

export async function recordLocationHeartbeat(
  userId: string,
  employeeName: string,
  dept: string,
  coords: { lat: number; lng: number },
  battery: number,
  withinBoundary: boolean,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'locations', userId), {
      userId,
      name: employeeName,
      department: dept,
      lat: coords.lat,
      lng: coords.lng,
      battery,
      withinOffice: withinBoundary,
      status: withinBoundary ? 'Active' : 'Idle',
      lastUpdate: formatTimeStr(new Date()),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Doc may not exist yet — use set instead
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'locations', userId), {
      userId,
      name: employeeName,
      department: dept,
      lat: coords.lat,
      lng: coords.lng,
      battery,
      withinOffice: withinBoundary,
      status: withinBoundary ? 'Active' : 'Idle',
      lastUpdate: formatTimeStr(new Date()),
      updatedAt: serverTimestamp(),
    });
  }
}
