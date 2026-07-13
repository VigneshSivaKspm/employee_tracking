import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { AttendanceRecord, AttendanceStatus, LeaveRequest, User } from '../types';
import { recordPunchIn, recordPunchOut, submitLeaveRequest } from '../services/FirebaseService';
import { getCurrentPosition, isWithinOfficeBoundary } from '../services/LocationService';
import { startSessionLocationTracking, stopSessionLocationTracking } from '../services/BackgroundTaskService';
import { verifyBiometric } from '../services/BiometricService';
import type { LeaveBalance } from '../types';

interface AttendanceContextValue {
  status: AttendanceStatus;
  todayRecord: AttendanceRecord | null;
  attendanceHistory: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  leaveBalance: LeaveBalance;
  workingSeconds: number;
  isWithinOffice: boolean | null;
  isPunching: boolean;
  punchStage: 'idle' | 'verifying' | 'locating' | 'saving';
  punchIn: () => Promise<void>;
  punchOut: () => Promise<void>;
  submitLeave: (leave: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'>) => Promise<void>;
  refreshLocation: () => Promise<void>;
}

const DEFAULT_LEAVE_BALANCE: LeaveBalance = {
  casual: 5,
  sick: 3,
  earned: 7,
  entitled: 24,
  taken: 0,
  pending: 0,
  remaining: 24,
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getLocalDateStr(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseClockInTime(clockIn: string): Date {
  const parts = clockIn.split(':').map(Number);
  const [h, m, s = 0] = parts;
  const d = new Date();
  d.setHours(h, m, s, 0);
  return d;
}

export function AttendanceProvider({ children, user }: { children: ReactNode; user: User }) {
  const userId = user.id;

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>(DEFAULT_LEAVE_BALANCE);
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [isWithinOffice, setIsWithinOffice] = useState<boolean | null>(null);
  const [isPunching, setIsPunching] = useState(false);
  const [punchStage, setPunchStage] = useState<'idle' | 'verifying' | 'locating' | 'saving'>('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionClockIn, setSessionClockIn] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const punchInTimeRef = useRef<Date | null>(null);
  const firebaseDocIdRef = useRef<string | null>(null);

  const todayDate = getLocalDateStr();
  const todayRecordFromDb = history.find(r => r.date === todayDate) ?? null;

  const todayRecord: AttendanceRecord | null = todayRecordFromDb ?? (
    sessionActive && sessionClockIn
      ? {
          id: firebaseDocIdRef.current || 'local-session',
          date: todayDate,
          clockIn: sessionClockIn,
          clockOut: null,
          status: 'on_time',
          totalHours: 0,
          isRemote: false,
        }
      : null
  );

  const status: AttendanceStatus = todayRecordFromDb?.clockOut
    ? 'clocked_out'
    : todayRecordFromDb?.clockIn || sessionActive
    ? 'active'
    : 'not_clocked_in';

  // ─── Firestore real-time listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const attendanceQ = query(
      collection(db, 'attendance'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(60),
    );

    const unsubAttendance = onSnapshot(attendanceQ, snap => {
      setHistory(
        snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            date: data.date || '',
            clockIn: data.clockIn || null,
            clockOut: data.clockOut || null,
            status: (data.status as AttendanceStatus) || 'absent',
            totalHours: data.totalHours || 0,
            isRemote: data.isRemote || false,
          } as AttendanceRecord;
        }),
      );
    });

    const leaveQ = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', userId),
      orderBy('appliedOn', 'desc'),
    );

    const unsubLeave = onSnapshot(leaveQ, snap => {
      setLeaveRequests(
        snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type || 'annual',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            reason: data.reason || '',
            status: ((data.status || 'pending') as string).toLowerCase() as LeaveRequest['status'],
            appliedOn: data.appliedOn || '',
            hasDocument: data.hasDocument || false,
            totalDays: data.totalDays || 1,
          } as LeaveRequest;
        }),
      );
    });

    // Load leave balance from employee profile
    getDoc(doc(db, 'employees', userId)).then(snap => {
      if (snap.exists() && snap.data().leaveBalance) {
        setLeaveBalance(snap.data().leaveBalance as LeaveBalance);
      }
    });

    return () => {
      unsubAttendance();
      unsubLeave();
    };
  }, [userId]);

  // Keep punch-out doc id in sync after app reload
  useEffect(() => {
    if (todayRecordFromDb?.id) {
      firebaseDocIdRef.current = todayRecordFromDb.id;
    }
  }, [todayRecordFromDb?.id]);

  // Clear optimistic session once Firestore confirms punch-out
  useEffect(() => {
    if (todayRecordFromDb?.clockOut) {
      setSessionActive(false);
      setSessionClockIn(null);
    }
  }, [todayRecordFromDb?.clockOut]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Working timer (runs while clocked in) ────────────────────────────────
  useEffect(() => {
    if (status !== 'active') {
      stopTimer();
      if (status === 'clocked_out' && todayRecordFromDb?.totalHours) {
        setWorkingSeconds(Math.floor(todayRecordFromDb.totalHours * 3600));
      } else if (status === 'not_clocked_in') {
        setWorkingSeconds(0);
        punchInTimeRef.current = null;
      }
      return;
    }

    const clockInStr = todayRecordFromDb?.clockIn ?? sessionClockIn;
    if (!clockInStr) return;

    if (!punchInTimeRef.current) {
      punchInTimeRef.current = parseClockInTime(clockInStr);
    }

    const tick = () => {
      if (!punchInTimeRef.current) return;
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - punchInTimeRef.current.getTime()) / 1000),
      );
      setWorkingSeconds(elapsed);
    };

    tick();
    stopTimer();
    timerRef.current = setInterval(tick, 1000);

    return () => stopTimer();
  }, [status, todayRecordFromDb?.clockIn, todayRecordFromDb?.clockOut, sessionClockIn, stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const refreshLocation = useCallback(async () => {
    const coords = await getCurrentPosition();
    if (coords) setIsWithinOffice(isWithinOfficeBoundary(coords));
  }, []);

  useEffect(() => { refreshLocation(); }, [refreshLocation]);

  // ─── Punch In ─────────────────────────────────────────────────────────────
  const punchIn = useCallback(async () => {
    setIsPunching(true);
    setPunchStage('verifying');
    try {
      const bio = await verifyBiometric('Scan fingerprint to Punch In');
      if (!bio.success) {
        throw new Error(
          bio.error === 'cancelled' || bio.error === 'user_cancel'
            ? 'Fingerprint verification cancelled.'
            : 'Fingerprint verification failed. Please try again.',
        );
      }

      setPunchStage('locating');
      const coords = await getCurrentPosition();
      const now = new Date();
      const clockInStr = formatTime(now);
      const dateStr = getLocalDateStr(now);
      const isRemote = coords ? !isWithinOfficeBoundary(coords) : true;
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);

      setPunchStage('saving');
      const docId = await recordPunchIn(userId, coords ?? { lat: 0, lng: 0 }, {
        date: dateStr,
        clockIn: clockInStr,
        status: isLate ? 'late' : 'on_time',
        isRemote,
        employeeId: user.employeeId,
        employeeName: user.name,
        dept: user.department,
        verifiedBy: bio.hardwareMissing ? 'no_biometric_hardware' : 'fingerprint',
      });

      firebaseDocIdRef.current = docId;
      punchInTimeRef.current = now;
      setSessionActive(true);
      setSessionClockIn(clockInStr);
      setWorkingSeconds(0);
      if (coords) setIsWithinOffice(isWithinOfficeBoundary(coords));
      startSessionLocationTracking(userId).catch(() => undefined);
    } finally {
      setIsPunching(false);
      setPunchStage('idle');
    }
  }, [userId, user]);

  // ─── Punch Out ────────────────────────────────────────────────────────────
  const punchOut = useCallback(async () => {
    setIsPunching(true);
    setPunchStage('verifying');
    try {
      const bio = await verifyBiometric('Scan fingerprint to Punch Out');
      if (!bio.success) {
        throw new Error(
          bio.error === 'cancelled' || bio.error === 'user_cancel'
            ? 'Fingerprint verification cancelled.'
            : 'Fingerprint verification failed. Please try again.',
        );
      }

      setPunchStage('locating');
      const coords = await getCurrentPosition();
      const clockOutStr = formatTime(new Date());
      const totalHours = parseFloat((workingSeconds / 3600).toFixed(2));

      setPunchStage('saving');
      if (firebaseDocIdRef.current) {
        await recordPunchOut(userId, firebaseDocIdRef.current, coords ?? { lat: 0, lng: 0 }, totalHours, clockOutStr);
      }
      setSessionActive(false);
      setSessionClockIn(null);
      punchInTimeRef.current = null;
      stopTimer();
      stopSessionLocationTracking().catch(() => undefined);
    } finally {
      setIsPunching(false);
      setPunchStage('idle');
    }
  }, [userId, workingSeconds, stopTimer]);

  // ─── Submit Leave ─────────────────────────────────────────────────────────
  const submitLeave = useCallback(async (leave: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'>) => {
    await submitLeaveRequest(userId, {
      ...leave,
      employeeId: user.employeeId,
      employeeName: user.name,
      dept: user.department,
    });
    setLeaveBalance(prev => ({ ...prev, pending: prev.pending + leave.totalDays }));
  }, [userId, user]);

  return (
    <AttendanceContext.Provider
      value={{
        status,
        todayRecord,
        attendanceHistory: history,
        leaveRequests,
        leaveBalance,
        workingSeconds,
        isWithinOffice,
        isPunching,
        punchStage,
        punchIn,
        punchOut,
        submitLeave,
        refreshLocation,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance(): AttendanceContextValue {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider');
  return ctx;
}
