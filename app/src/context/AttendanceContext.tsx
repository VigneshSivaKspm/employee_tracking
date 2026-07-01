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

export function AttendanceProvider({ children, user }: { children: ReactNode; user: User }) {
  const userId = user.id;

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>(DEFAULT_LEAVE_BALANCE);
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [isWithinOffice, setIsWithinOffice] = useState<boolean | null>(null);
  const [isPunching, setIsPunching] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const punchInTimeRef = useRef<Date | null>(null);
  const firebaseDocIdRef = useRef<string | null>(null);

  const todayDate = new Date().toISOString().split('T')[0];
  const todayRecord = history.find(r => r.date === todayDate) ?? null;
  const status: AttendanceStatus =
    !todayRecord || !todayRecord.clockIn
      ? 'not_clocked_in'
      : todayRecord.clockOut
      ? 'clocked_out'
      : 'active';

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
            status: data.status || 'pending',
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

  // ─── Restore timer if already punched in ──────────────────────────────────
  useEffect(() => {
    if (status === 'active' && todayRecord?.clockIn) {
      const [h, m] = todayRecord.clockIn.split(':').map(Number);
      const now = new Date();
      const clockInDate = new Date(now);
      clockInDate.setHours(h, m, 0, 0);
      const elapsed = Math.max(0, Math.floor((now.getTime() - clockInDate.getTime()) / 1000));
      punchInTimeRef.current = clockInDate;
      setWorkingSeconds(elapsed);
      startTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRecord?.clockIn]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setWorkingSeconds(s => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const refreshLocation = useCallback(async () => {
    const coords = await getCurrentPosition();
    if (coords) setIsWithinOffice(isWithinOfficeBoundary(coords));
  }, []);

  useEffect(() => { refreshLocation(); }, [refreshLocation]);

  // ─── Punch In ─────────────────────────────────────────────────────────────
  const punchIn = useCallback(async () => {
    setIsPunching(true);
    try {
      const coords = await getCurrentPosition();
      const now = new Date();
      const clockInStr = formatTime(now);
      const dateStr = now.toISOString().split('T')[0];
      const isRemote = coords ? !isWithinOfficeBoundary(coords) : true;
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);

      const docId = await recordPunchIn(userId, coords ?? { lat: 0, lng: 0 }, {
        date: dateStr,
        clockIn: clockInStr,
        status: isLate ? 'late' : 'on_time',
        isRemote,
        employeeId: user.employeeId,
        employeeName: user.name,
        dept: user.department,
      });

      firebaseDocIdRef.current = docId;
      punchInTimeRef.current = now;
      setWorkingSeconds(0);
      startTimer();
      if (coords) setIsWithinOffice(isWithinOfficeBoundary(coords));
    } finally {
      setIsPunching(false);
    }
  }, [userId, user, startTimer]);

  // ─── Punch Out ────────────────────────────────────────────────────────────
  const punchOut = useCallback(async () => {
    setIsPunching(true);
    try {
      const coords = await getCurrentPosition();
      const now = new Date();
      const clockOutStr = formatTime(now);
      const totalHours = parseFloat((workingSeconds / 3600).toFixed(2));

      if (firebaseDocIdRef.current) {
        await recordPunchOut(userId, firebaseDocIdRef.current, coords ?? { lat: 0, lng: 0 }, totalHours, clockOutStr);
      }
      stopTimer();
    } finally {
      setIsPunching(false);
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
