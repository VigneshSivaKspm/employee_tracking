import React, { useState, createContext, useContext, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  LayoutDashboard, Users, Clock, CalendarDays, BarChart3,
  MapPin, FolderOpen, Phone, Menu, X, LogOut, Search,
  ChevronDown, Download, Play, Flag, Shield, Eye, EyeOff, Plus,
  CheckCircle2, XCircle, Bell, Lock, UserCheck, UserX,
  AlertCircle, FileText, Filter, RefreshCw, Mic, Archive,
  Wifi, Battery, Radio, ArrowUpRight, Settings, Building2,
  TrendingUp, TrendingDown, Minus, ChevronRight,
  Target, Wrench, ShoppingCart
} from "lucide-react";
import BranchesPage from "./pages/BranchesPage";
import SalesPage from "./pages/SalesPage";
import TargetsPage from "./pages/TargetsPage";
import ServiceRequestsPage from "./pages/ServiceRequestsPage";
import CalendarPage from "./pages/CalendarPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import { initializeApp, deleteApp } from "firebase/app";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  getAuth,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  collection, onSnapshot, doc, getDoc, setDoc, updateDoc,
  query, orderBy, limit, serverTimestamp, getFirestore,
} from "firebase/firestore";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { fbAuth, db, storage } from "../firebase";

// ─── Firebase Config & Helpers ────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCYTV15D-fAxQ8Xf25fEjv0VGCHB8jbFmo",
  authDomain: "niklaus-sms.firebaseapp.com",
  projectId: "niklaus-sms",
  storageBucket: "niklaus-sms.firebasestorage.app",
  messagingSenderId: "960099181513",
  appId: "1:960099181513:web:6e10699f60c1bf66797e18",
};

async function createFirebaseUser(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(FIREBASE_CONFIG, `user_create_${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await fbSignOut(secondaryAuth);
    await deleteApp(secondaryApp);
    return uid;
  } catch (e) {
    await deleteApp(secondaryApp);
    throw e;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Role = "branch_admin" | "superadmin";
type Page =
  | "dashboard" | "employees" | "attendance" | "leave" | "analytics"
  | "gps" | "filemanager" | "commsync"
  | "branches" | "sales" | "targets" | "servicerequests" | "calendar" | "admins";

interface Employee {
  id: string; name: string; dept: string; email: string; phone: string;
  status: "Active" | "On Leave" | "Inactive"; joinDate: string; role: string; avatar: string;
  avatarUrl?: string;
}
interface AttendanceLog {
  id: string; date: string; employeeId: string; employeeName: string;
  punchIn: string; punchOut: string; status: "On-Time" | "Late" | "Absent" | "Early Leave";
}
interface LeaveRequest {
  id: string; employeeId: string; employeeName: string; dept: string;
  type: string; startDate: string; endDate: string; reason: string;
  status: "Pending" | "Approved" | "Rejected"; appliedOn: string;
}
interface GPSEmployee {
  id: string; name: string; dept: string; lastUpdate: string;
  battery: number; status: "Active" | "Idle" | "Offline";
  posLeft: string; posTop: string; lat?: number; lng?: number;
}
interface CallLog {
  id: string; timestamp: string; employeeName: string;
  direction: "Incoming" | "Outgoing"; duration: string; remoteNumber: string;
}
interface AudioFile {
  id: string; filename: string; employeeName: string; duration: string;
  size: string; recordedAt: string; flagged: boolean; downloadUrl?: string; userId?: string;
  source?: string;
}
interface SyncedFile {
  id: string; filename: string; fileType: string; size: string;
  employeeName: string; syncedAt: string; category: "Document" | "Media" | "Backup" | "Image";
  downloadUrl?: string; userId?: string;
}
interface StorageCloudFile {
  id: string; path: string; filename: string; downloadUrl: string;
  bucket: "synced-files" | "audio" | "live-audio"; userId: string; employeeName: string;
}
interface NotificationLog {
  id: string; timestamp: string; employeeName: string;
  title: string; body: string; appName: string;
}

// ─── Auth Context ─────────────────────────────────────────────────────────────
interface AuthCtx {
  role: Role; setRole: (r: Role) => void;
  user: { name: string; email: string; branchId: string; branchName: string; companyId: string };
}
const AuthContext = createContext<AuthCtx>({} as AuthCtx);
const useAuth = () => useContext(AuthContext);

// ─── Data Context ─────────────────────────────────────────────────────────────
interface DataCtx {
  employees: Employee[];
  attendanceLogs: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  gpsEmployees: GPSEmployee[];
  callLogs: CallLog[];
  audioFiles: AudioFile[];
  syncedFiles: SyncedFile[];
  notificationLogs: NotificationLog[];
  dataLoading: boolean;
  approveLeave: (id: string) => Promise<void>;
  rejectLeave: (id: string, reason: string) => Promise<void>;
  toggleAudioFlag: (id: string, current: boolean) => Promise<void>;
  requestRemoteRecording: (userId: string, employeeName: string, durationSec?: number) => Promise<void>;
  startLiveListen: (userId: string, employeeName: string) => Promise<void>;
  stopLiveListen: (userId: string) => Promise<void>;
}
const DataContext = createContext<DataCtx>({} as DataCtx);
const useData = () => useContext(DataContext);

// ─── Data Mappers ─────────────────────────────────────────────────────────────
const DEPARTMENTS = ["All Departments", "Engineering", "HR", "Finance", "Marketing", "Operations", "Sales", "Legal", "Design", "Product", "General"];

function makeAvatar(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

function docToEmployee(id: string, data: Record<string, any>): Employee {
  return {
    id: data.employeeId || id,
    name: data.name || "",
    dept: data.department || data.dept || "General",
    email: data.email || "",
    phone: data.phone || "",
    status: (data.status as Employee["status"]) || "Active",
    joinDate: data.joinDate || "",
    role: data.designation || data.role || "",
    avatar: makeAvatar(data.name || ""),
    avatarUrl: data.avatarUrl || "",
  };
}

function docToAttendanceLog(id: string, data: Record<string, any>): AttendanceLog {
  const statusMap: Record<string, AttendanceLog["status"]> = {
    on_time: "On-Time", late: "Late", absent: "Absent", half_day: "Early Leave",
    "On-Time": "On-Time", Late: "Late", Absent: "Absent", "Early Leave": "Early Leave",
  };
  return {
    id,
    date: data.date || "",
    employeeId: data.employeeId || data.userId || "",
    employeeName: data.employeeName || "",
    punchIn: data.clockIn || data.punchIn || "—",
    punchOut: data.clockOut || data.punchOut || "—",
    status: statusMap[data.status] || "On-Time",
  };
}

function docToLeaveRequest(id: string, data: Record<string, any>): LeaveRequest {
  const statusMap: Record<string, LeaveRequest["status"]> = {
    pending: "Pending", approved: "Approved", rejected: "Rejected",
    Pending: "Pending", Approved: "Approved", Rejected: "Rejected",
  };
  const typeMap: Record<string, string> = {
    annual: "Annual Leave", sick: "Sick Leave", casual: "Casual Leave",
    earned: "Earned Leave", personal: "Personal Leave", medical: "Medical Leave",
  };
  return {
    id,
    employeeId: data.employeeId || data.userId || "",
    employeeName: data.employeeName || "",
    dept: data.dept || data.department || "",
    type: typeMap[data.type] || data.type || "Annual Leave",
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    reason: data.reason || "",
    status: statusMap[data.status] || "Pending",
    appliedOn: data.appliedOn || "",
  };
}

function latLngToPos(lat: number, lng: number): { posLeft: string; posTop: string } {
  // Bounding box around Bangalore; adjust to your region
  const latMin = 12.85, latMax = 13.10, lngMin = 77.45, lngMax = 77.75;
  const left = Math.max(5, Math.min(90, ((lng - lngMin) / (lngMax - lngMin)) * 85 + 5));
  const top = Math.max(5, Math.min(90, (1 - (lat - latMin) / (latMax - latMin)) * 85 + 5));
  return { posLeft: `${left.toFixed(0)}%`, posTop: `${top.toFixed(0)}%` };
}

function docToGPSEmployee(id: string, data: Record<string, any>): GPSEmployee {
  const pos = (data.lat && data.lng) ? latLngToPos(data.lat, data.lng) : { posLeft: "50%", posTop: "50%" };
  return {
    id: data.userId || id,
    name: data.name || "",
    dept: data.department || data.dept || "",
    lastUpdate: data.lastUpdate || "Unknown",
    battery: data.battery ?? 50,
    status: (data.status as GPSEmployee["status"]) || "Offline",
    lat: data.lat,
    lng: data.lng,
    ...pos,
  };
}

function formatMonitorTime(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" });
    }
    return value;
  }
  return String(value);
}

async function downloadRemoteFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function downloadManyFiles(files: { url: string; filename: string }[]): Promise<void> {
  for (const file of files) {
    await downloadRemoteFile(file.url, file.filename);
    await new Promise(r => setTimeout(r, 350));
  }
}

function inferFileCategory(filename: string): SyncedFile["category"] {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic)$/.test(lower)) return "Image";
  if (/\.(mp4|mov|avi|mkv|mp3|wav|m4a|aac|webm)$/.test(lower)) return "Media";
  if (/\.(zip|rar|7z|bak)$/.test(lower)) return "Backup";
  return "Document";
}

async function listAllStorageFiles(nameByUserId: Record<string, string>): Promise<StorageCloudFile[]> {
  const roots = ["synced-files", "audio", "live-audio"] as const;
  const items: StorageCloudFile[] = [];

  for (const bucket of roots) {
    try {
      const rootList = await listAll(ref(storage, bucket));
      for (const userPrefix of rootList.prefixes) {
        const userId = userPrefix.name;
        const fileList = await listAll(userPrefix);
        for (const item of fileList.items) {
          const downloadUrl = await getDownloadURL(item);
          const filename = item.name.includes("_") ? item.name.split("_").slice(1).join("_") : item.name;
          items.push({
            id: item.fullPath,
            path: item.fullPath,
            filename: filename || item.name,
            downloadUrl,
            bucket,
            userId,
            employeeName: nameByUserId[userId] ?? userId.slice(0, 8),
          });
        }
      }
    } catch (e) {
      console.warn(`[Storage] list ${bucket}:`, e);
    }
  }

  return items.sort((a, b) => b.path.localeCompare(a.path));
}

function isVideoFile(fileType: string, filename: string): boolean {
  return /^(MP4|MOV|AVI|MKV|WEBM|3GP)/i.test(fileType) || /\.(mp4|mov|webm|mkv|3gp)$/i.test(filename);
}

function isAudioFileType(fileType: string, filename: string): boolean {
  return /^(MP3|M4A|WAV|AAC|OGG|FLAC)/i.test(fileType) || /\.(mp3|m4a|wav|aac|ogg)$/i.test(filename);
}

function uniqueEmployeeNames(items: { employeeName?: string }[]): string[] {
  return [...new Set(items.map(i => i.employeeName).filter(Boolean) as string[])].sort();
}

function listenAndSort<T>(
  name: string,
  colName: string,
  map: (id: string, data: Record<string, unknown>) => T,
  sort: (a: T, b: T) => number,
  set: (items: T[]) => void,
  max?: number,
): () => void {
  return onSnapshot(
    collection(db, colName),
    snap => {
      let items = snap.docs.map(d => map(d.id, d.data() as Record<string, unknown>));
      items.sort(sort);
      if (max) items = items.slice(0, max);
      set(items);
    },
    err => console.warn(`[DataProvider] ${name} listener:`, err?.message ?? err),
  );
}

// ─── Data Provider ────────────────────────────────────────────────────────────
function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [gpsEmployees, setGpsEmployees] = useState<GPSEmployee[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [syncedFiles, setSyncedFiles] = useState<SyncedFile[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const subs: (() => void)[] = [];

    subs.push(onSnapshot(collection(db, "employees"), snap => {
      setEmployees(snap.docs.map(d => docToEmployee(d.id, d.data())));
      setDataLoading(false);
    }));

    subs.push(onSnapshot(
      query(collection(db, "attendance"), orderBy("date", "desc"), limit(300)),
      snap => setAttendanceLogs(snap.docs.map(d => docToAttendanceLog(d.id, d.data())))
    ));

    subs.push(onSnapshot(
      query(collection(db, "leaveRequests"), orderBy("appliedOn", "desc")),
      snap => setLeaveRequests(snap.docs.map(d => docToLeaveRequest(d.id, d.data())))
    ));

    subs.push(onSnapshot(collection(db, "locations"), snap => {
      setGpsEmployees(snap.docs.map(d => docToGPSEmployee(d.id, d.data())));
    }, err => console.warn("[DataProvider] locations:", err?.message ?? err)));

    subs.push(listenAndSort(
      "callLogs",
      "callLogs",
      (id, data) => ({ id, ...data } as CallLog),
      (a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")),
      setCallLogs,
      200,
    ));

    subs.push(listenAndSort(
      "audioFiles",
      "audioFiles",
      (id, data) => ({ id, ...data } as AudioFile),
      (a, b) => String(b.recordedAt ?? "").localeCompare(String(a.recordedAt ?? "")),
      setAudioFiles,
    ));

    subs.push(listenAndSort(
      "syncedFiles",
      "syncedFiles",
      (id, data) => ({ id, ...data } as SyncedFile),
      (a, b) => String(b.syncedAt ?? "").localeCompare(String(a.syncedAt ?? "")),
      setSyncedFiles,
    ));

    subs.push(listenAndSort(
      "notificationLogs",
      "notificationLogs",
      (id, data) => ({ id, ...data } as NotificationLog),
      (a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")),
      setNotificationLogs,
      300,
    ));

    return () => subs.forEach(u => u());
  }, []);

  const approveLeave = useCallback(async (id: string) => {
    await updateDoc(doc(db, "leaveRequests", id), { status: "Approved", decidedAt: serverTimestamp() });
  }, []);

  const rejectLeave = useCallback(async (id: string, reason: string) => {
    await updateDoc(doc(db, "leaveRequests", id), { status: "Rejected", rejectionReason: reason, decidedAt: serverTimestamp() });
  }, []);

  const toggleAudioFlag = useCallback(async (id: string, current: boolean) => {
    await updateDoc(doc(db, "audioFiles", id), { flagged: !current });
  }, []);

  const requestRemoteRecording = useCallback(async (userId: string, employeeName: string, durationSec = 30) => {
    await setDoc(doc(db, "deviceCommands", userId), {
      type: "record_audio",
      durationSec,
      status: "pending",
      employeeName,
      requestedAt: serverTimestamp(),
    });
  }, []);

  const startLiveListen = useCallback(async (userId: string, employeeName: string) => {
    await setDoc(doc(db, "deviceCommands", userId), {
      type: "live_audio",
      status: "active",
      employeeName,
      requestedAt: serverTimestamp(),
    });
  }, []);

  const stopLiveListen = useCallback(async (userId: string) => {
    await setDoc(doc(db, "deviceCommands", userId), {
      type: "live_audio",
      status: "stopped",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, []);

  return (
    <DataContext.Provider value={{ employees, attendanceLogs, leaveRequests, gpsEmployees, callLogs, audioFiles, syncedFiles, notificationLogs, dataLoading, approveLeave, rejectLeave, toggleAudioFlag, requestRemoteRecording, startLiveListen, stopLiveListen }}>
      {children}
    </DataContext.Provider>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const avatarBgMap: Record<string, string> = {};
const BG_COLORS = ["bg-indigo-600", "bg-violet-600", "bg-sky-600", "bg-pink-600", "bg-amber-600", "bg-emerald-600", "bg-orange-600", "bg-teal-600", "bg-blue-600", "bg-rose-600"];
let bgIdx = 0;
function getAvatarBg(initials: string): string {
  if (!avatarBgMap[initials]) {
    avatarBgMap[initials] = BG_COLORS[bgIdx % BG_COLORS.length];
    bgIdx++;
  }
  return avatarBgMap[initials];
}

function Avatar({ initials, imageUrl, size = "md" }: { initials: string; imageUrl?: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${sz} rounded-xl object-cover flex-shrink-0 border border-slate-200/80 bg-slate-100`}
      />
    );
  }
  return (
    <div className={`${sz} ${getAvatarBg(initials)} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials || "??"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string }> = {
    "Active":      { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80", dot: "bg-emerald-500" },
    "On Leave":    { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",       dot: "bg-amber-500" },
    "Inactive":    { cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200/80",      dot: "bg-slate-400" },
    "On-Time":     { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80", dot: "bg-emerald-500" },
    "Late":        { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",       dot: "bg-amber-500" },
    "Absent":      { cls: "bg-red-50 text-red-600 ring-1 ring-red-200/80",             dot: "bg-red-500" },
    "Early Leave": { cls: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80",    dot: "bg-orange-500" },
    "Approved":    { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80", dot: "bg-emerald-500" },
    "Rejected":    { cls: "bg-red-50 text-red-600 ring-1 ring-red-200/80",             dot: "bg-red-500" },
    "Pending":     { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",       dot: "bg-amber-400" },
  };
  const { cls, dot } = map[status] ?? { cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/60 z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const LOGO_URL = "/icons/logo.png";

function BrandLogo({
  size = "md",
  showSubtitle = false,
  subtitle = "Admin Console",
  theme = "dark",
}: {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  subtitle?: string;
  theme?: "dark" | "light";
}) {
  const imgSize = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const titleSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-sm";
  const titleColor = theme === "dark" ? "text-white" : "text-slate-900";

  return (
    <div className="flex items-center gap-3">
      <img
        src={LOGO_URL}
        alt="WorkForce HR"
        className={`${imgSize} object-contain flex-shrink-0 rounded-xl`}
      />
      <div>
        <p className={`${titleColor} font-bold ${titleSize} leading-tight tracking-tight`}>WorkForce HR</p>
        {showSubtitle && (
          <p className="text-slate-500 text-[11px] font-medium mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ─── Shared Auth Layout ───────────────────────────────────────────────────────
function AuthLayout({ children, quote }: { children: React.ReactNode; quote?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-950 via-[#060D1F] to-indigo-950 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <BrandLogo size="lg" theme="dark" />
        </div>
        <div className="relative">
          <div className="mb-8">
            <blockquote className="text-slate-200 text-[2rem] font-light leading-[1.35] mb-3">
              {quote ?? <>"Workforce intelligence,<br />centralized and secure."</>}
            </blockquote>
            <p className="text-slate-500 text-sm">The complete HR platform for modern teams.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Smart Attendance", "Live GPS", "Leave Mgmt", "Analytics", "Real-time Sync"].map(tag => (
              <div key={tag} className="bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] rounded-lg px-3.5 py-1.5">
                <span className="text-slate-300 text-xs font-semibold">{tag}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-xs relative">© 2026 WorkForce Smart Attendance. All rights reserved.</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto bg-white">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <BrandLogo size="md" theme="light" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onSignUp }: { onSignUp: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(fbAuth, email, password);
    } catch (err: any) {
      const code = err?.code ?? "";
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
          ? "Invalid email or password. Please try again."
          : "Login failed. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1.5">Welcome back</h1>
        <p className="text-slate-500 text-sm">Sign in to your admin dashboard to continue.</p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-50 rounded-xl border border-red-200/80">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
            placeholder="admin@yourcompany.com"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <Eye size={15} />
            </button>
          </div>
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 active:scale-[0.99] disabled:opacity-70 text-white py-3 rounded-xl text-sm font-bold tracking-tight transition-all flex items-center justify-center gap-2 mt-1 shadow-sm shadow-indigo-900/20"
        >
          {loading
            ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
            : "Sign in to dashboard"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        New super admin?{" "}
        <button onClick={onSignUp} className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors">
          Create account
        </button>
      </p>
    </AuthLayout>
  );
}

// ─── Super Admin Sign Up Page ─────────────────────────────────────────────────
function SignUpPage({ onLogin }: { onLogin: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      // Step 1: Create the Firebase Auth user via a secondary app so that
      // onAuthStateChanged on the MAIN app does NOT fire yet.
      const secondaryApp = initializeApp(FIREBASE_CONFIG, `superadmin_signup_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = getFirestore(secondaryApp);

      let uid: string;
      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
        uid = credential.user.uid;

        // Step 2: Write the admins doc while authenticated via the secondary app.
        // This guarantees the doc exists BEFORE the main auth state changes.
        await setDoc(doc(secondaryDb, "admins", uid), {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: "superadmin",
          status: "Active",
          createdAt: serverTimestamp(),
        });
      } finally {
        await fbSignOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
      }

      // Step 3: Sign in to the MAIN auth. onAuthStateChanged fires now,
      // but the Firestore doc already exists so loadProfile reads "superadmin" immediately.
      await signInWithEmailAndPassword(fbAuth, form.email, form.password);
      setSuccess(true);
    } catch (err: any) {
      console.error("[SignUpPage] signup error:", err);
      const code = err?.code ?? "";
      setError(
        code === "auth/email-already-in-use" ? "An account with this email already exists. Sign in instead."
        : code === "auth/weak-password" ? "Password is too weak. Use at least 8 characters."
        : code === "auth/invalid-email" ? "Please enter a valid email address."
        : err?.message ?? "Registration failed. Check your connection and try again."
      );
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center py-10">
          <img
            src={LOGO_URL}
            alt="WorkForce HR"
            className="h-16 w-16 object-contain mx-auto mb-5 rounded-2xl"
          />
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Super Admin Created!</h2>
          <p className="text-slate-500 text-sm">Welcome to WorkForce HR. Signing you in to your dashboard…</p>
          <div className="mt-6 flex justify-center">
            <div className="h-5 w-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout quote={<>"Full control,<br />from day one."</>}>
      {/* Badge */}
      <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl w-fit">
        <Shield size={14} className="text-indigo-600" />
        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Super Admin Registration</span>
      </div>

      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1.5">Create Super Admin</h1>
      <p className="text-slate-500 text-sm mb-7">
        Register a super admin account with full system access.
      </p>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-50 rounded-xl border border-red-200/80">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name} onChange={set("name")} required autoFocus
            placeholder="John Smith"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email" value={form.email} onChange={set("email")} required
            placeholder="admin@yourcompany.com"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Phone</label>
          <input
            type="tel" value={form.phone} onChange={set("phone")}
            placeholder="+91 98765 43210"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* Access level note — locked to superadmin */}
        <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
          <Shield size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-indigo-800 mb-0.5">Super Admin access</p>
            <p className="text-xs text-indigo-600">
              Full access to all companies, branches, GPS tracking, field file sync,
              communication logs, and branch admin management.
            </p>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} value={form.password}
              onChange={set("password")} required minLength={8}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {form.password.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {[4, 6, 8, 10].map(n => (
                <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${
                  form.password.length >= n
                    ? form.password.length >= 10 ? "bg-emerald-500"
                    : form.password.length >= 8 ? "bg-amber-400" : "bg-red-400"
                    : "bg-slate-200"
                }`} />
              ))}
              <span className={`text-xs ml-1.5 font-semibold ${
                form.password.length >= 10 ? "text-emerald-600"
                : form.password.length >= 8 ? "text-amber-600" : "text-red-500"
              }`}>
                {form.password.length >= 10 ? "Strong" : form.password.length >= 8 ? "Good" : "Weak"}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"} value={form.confirmPassword}
              onChange={set("confirmPassword")} required
              placeholder="Re-enter your password"
              className={`w-full px-4 py-3 pr-16 rounded-xl border text-slate-900 text-sm focus:outline-none focus:ring-2 transition-all ${
                form.confirmPassword && form.confirmPassword !== form.password
                  ? "border-red-300 bg-red-50 focus:ring-red-500/20 focus:border-red-400"
                  : form.confirmPassword && form.confirmPassword === form.password
                  ? "border-emerald-300 bg-emerald-50 focus:ring-emerald-500/20 focus:border-emerald-400"
                  : "border-slate-200 bg-slate-50/50 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
              }`}
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {form.confirmPassword && (
                form.confirmPassword === form.password
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <XCircle size={14} className="text-red-400" />
              )}
              <button type="button" onClick={() => setShowConfirm(p => !p)}
                className="text-slate-400 hover:text-slate-600 transition-colors">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 active:scale-[0.99] disabled:opacity-70 text-white py-3 rounded-xl text-sm font-bold tracking-tight transition-all flex items-center justify-center gap-2 mt-2 shadow-sm shadow-indigo-900/20"
        >
          {loading
            ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account…</>
            : <><Shield size={14} /> Create Super Admin Account</>}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <button onClick={onLogin} className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors">
          Sign in
        </button>
      </p>
    </AuthLayout>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage() {
  const { employees, attendanceLogs, leaveRequests } = useData();
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = attendanceLogs.filter(l => l.date === today);
  const pendingLeaves = leaveRequests.filter(l => l.status === "Pending");

  const metrics = [
    { label: "Total Employees", value: employees.length, icon: Users, color: "text-indigo-600 bg-indigo-50", trend: `${employees.filter(e => e.status === "Active").length} active` },
    { label: "Present Today", value: todayLogs.filter(l => l.status === "On-Time" || l.status === "Late").length, icon: UserCheck, color: "text-emerald-600 bg-emerald-50", trend: employees.length ? `${Math.round(todayLogs.length / Math.max(employees.length, 1) * 100)}% attendance` : "No data" },
    { label: "Absent Today", value: todayLogs.filter(l => l.status === "Absent").length, icon: UserX, color: "text-red-600 bg-red-50", trend: "Unaccounted" },
    { label: "On Leave", value: employees.filter(e => e.status === "On Leave").length + pendingLeaves.length, icon: CalendarDays, color: "text-amber-600 bg-amber-50", trend: `${pendingLeaves.length} pending` },
    { label: "Late Arrivals", value: todayLogs.filter(l => l.status === "Late").length, icon: Clock, color: "text-orange-600 bg-orange-50", trend: "After 09:15" },
  ];

  // Weekly chart
  const weeklyData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day, i) => {
      const d = new Date();
      const diff = i - (d.getDay() === 0 ? 6 : d.getDay() - 1);
      d.setDate(d.getDate() + diff);
      const ds = d.toISOString().split("T")[0];
      const dl = attendanceLogs.filter(l => l.date === ds);
      return {
        day,
        Present: dl.filter(l => l.status === "On-Time").length,
        Late: dl.filter(l => l.status === "Late").length,
        Absent: dl.filter(l => l.status === "Absent").length,
        Leave: dl.filter(l => l.status === "Early Leave").length,
      };
    });
  }, [attendanceLogs]);

  const leaveTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    leaveRequests.filter(r => r.status === "Approved").forEach(r => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [leaveRequests]);
  const PIE_COLORS = ["#4f46e5", "#22c55e", "#f59e0b", "#ec4899", "#64748b"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map(m => (
          <Card key={m.label} className="p-5 hover:shadow-md transition-all duration-200 group cursor-default">
            <div className={`inline-flex p-2.5 rounded-xl ${m.color} mb-4 group-hover:scale-105 transition-transform duration-200`}><m.icon size={18} /></div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">{m.value}</div>
            <div className="text-xs font-bold text-slate-400 mt-1.5 uppercase tracking-wider">{m.label}</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">{m.trend}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Weekly Attendance Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">Current week</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barSize={12} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Present" fill="#4f46e5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Late" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Absent" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Leave" fill="#6366f1" opacity={0.4} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Leave Distribution</h3>
          {leaveTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No leave data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={leaveTypeData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {leaveTypeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {leaveTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-slate-600">{d.name}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Today's Attendance Log</h3>
          <span className="text-xs text-slate-500">{todayLogs.length} records</span>
        </div>
        {todayLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No attendance records for today yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Employee", "Punch In", "Punch Out", "Status"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todayLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={makeAvatar(log.employeeName)} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-slate-900">{log.employeeName}</div>
                          <div className="text-xs text-slate-500">{log.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-700 font-mono">{log.punchIn}</td>
                    <td className="px-6 py-3 text-sm text-slate-700 font-mono">{log.punchOut}</td>
                    <td className="px-6 py-3"><StatusBadge status={log.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Employees Page ───────────────────────────────────────────────────────────
function EmployeesPage() {
  const { employees, attendanceLogs } = useData();
  const { role, user } = useAuth();
  const isBranchAdmin = role === "branch_admin";
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All Departments");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; company: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [empForm, setEmpForm] = useState({
    name: "", employeeId: "", email: "", phone: "",
    department: "Engineering", designation: "",
    companyId: "", branchId: "",
    joinDate: new Date().toISOString().split("T")[0],
    password: "",
  });

  useEffect(() => {
    const subs: (() => void)[] = [];
    subs.push(onSnapshot(collection(db, "companies"), snap => {
      setCompanies(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) || d.id })));
    }));
    subs.push(onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) || d.id, company: (d.data().company as string) || "" })));
    }));
    return () => subs.forEach(u => u());
  }, []);

  // For super admin: filter branches by selected company name
  const selectedCompanyName = companies.find(c => c.id === empForm.companyId)?.name || "";
  const filteredBranches = branches.filter(b => !empForm.companyId || b.company === selectedCompanyName);

  const filtered = useMemo(() =>
    employees.filter(e =>
      (dept === "All Departments" || e.dept === dept) &&
      (e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.id.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()))
    ), [search, dept, employees]);

  const resetForm = () => {
    setEmpForm({
      name: "", employeeId: "", email: "", phone: "",
      department: "Engineering", designation: "",
      // Branch admins are locked to their own company/branch
      companyId: isBranchAdmin ? user.companyId : "",
      branchId: isBranchAdmin ? user.branchId : "",
      joinDate: new Date().toISOString().split("T")[0],
      password: "",
    });
    setCreateError("");
    setCreateSuccess(false);
    setShowPass(false);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const uid = await createFirebaseUser(empForm.email, empForm.password);
      // Branch admin: use their own company/branch from auth context
      const companyId = isBranchAdmin ? user.companyId : empForm.companyId;
      const branchId = isBranchAdmin ? user.branchId : empForm.branchId;
      const companyName = isBranchAdmin
        ? (companies.find(c => c.id === user.companyId)?.name || "")
        : (companies.find(c => c.id === empForm.companyId)?.name || "");
      const branchName = isBranchAdmin
        ? user.branchName
        : (branches.find(b => b.id === empForm.branchId)?.name || "");
      await setDoc(doc(db, "employees", uid), {
        name: empForm.name.trim(),
        email: empForm.email.trim(),
        employeeId: empForm.employeeId.trim().toUpperCase(),
        phone: empForm.phone.trim(),
        department: empForm.department,
        designation: empForm.designation.trim(),
        companyId,
        companyName,
        branchId,
        branchName,
        joinDate: empForm.joinDate,
        status: "Active",
        role: "employee",
        leaveBalance: { casual: 12, sick: 6, earned: 12, entitled: 30, taken: 0, pending: 0, remaining: 30 },
        createdAt: serverTimestamp(),
      });
      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreate(false);
        resetForm();
      }, 3000);
    } catch (err: any) {
      const code = err?.code ?? "";
      setCreateError(
        code === "auth/email-already-in-use"
          ? "An account with this email already exists."
          : code === "auth/weak-password"
          ? "Password is too weak. Use at least 6 characters."
          : err?.message || "Failed to create employee. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">{employees.length} total employees across all departments</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} /> Add Employee
        </button>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-b border-slate-100">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, or email…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={dept} onChange={e => setDept(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            >
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Employee", "Department", "Contact", "Status", ""].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={emp.avatar} imageUrl={emp.avatarUrl} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{emp.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="text-sm text-slate-700">{emp.dept}</div>
                    <div className="text-xs text-slate-400">{emp.role}</div>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="text-xs text-slate-600">{emp.email}</div>
                    <div className="text-xs text-slate-400">{emp.phone}</div>
                  </td>
                  <td className="px-6 py-3.5"><StatusBadge status={emp.status} /></td>
                  <td className="px-6 py-3.5">
                    <button onClick={() => setSelected(emp)} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">{employees.length === 0 ? "No employees found. Add employees via the button above." : "No employees match your search."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Employee Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-md shadow-2xl overflow-y-auto h-full z-10">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Employee Profile</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar initials={selected.avatar} imageUrl={selected.avatarUrl} size="lg" />
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{selected.name}</h4>
                  <p className="text-sm text-slate-500">{selected.role}</p>
                  <div className="mt-1"><StatusBadge status={selected.status} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Employee ID", value: selected.id },
                  { label: "Department", value: selected.dept },
                  { label: "Email", value: selected.email },
                  { label: "Phone", value: selected.phone },
                  { label: "Join Date", value: selected.joinDate },
                  { label: "Status", value: selected.status },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">{item.label}</p>
                    <p className="text-sm text-slate-800 font-medium break-all">{item.value || "—"}</p>
                  </div>
                ))}
              </div>
              <div>
                <h5 className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-3">Recent Attendance</h5>
                <div className="space-y-2">
                  {attendanceLogs.filter(l => l.employeeId === selected.id).slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                      <span className="text-xs text-slate-500">{l.date}</span>
                      <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
                        <span>{l.punchIn}</span>
                        <span className="text-slate-300">→</span>
                        <span>{l.punchOut}</span>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                  ))}
                  {attendanceLogs.filter(l => l.employeeId === selected.id).length === 0 && (
                    <p className="text-xs text-slate-400">No attendance records yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-base font-semibold text-slate-900">Add New Employee</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-4">
              {createSuccess ? (
                <div className="py-8 text-center">
                  <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mb-1">Employee Created!</h4>
                  <p className="text-sm text-slate-500">The employee account has been set up successfully.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  {createError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle size={13} className="text-red-600 flex-shrink-0" />
                      <p className="text-xs text-red-700">{createError}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                      <input required value={empForm.name} onChange={e => setEmpForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="John Smith"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Employee ID <span className="text-red-500">*</span></label>
                      <input required value={empForm.employeeId} onChange={e => setEmpForm(p => ({ ...p, employeeId: e.target.value }))}
                        placeholder="EMP-2024-0001"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Work Email <span className="text-red-500">*</span></label>
                      <input required type="email" value={empForm.email} onChange={e => setEmpForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="john@company.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                      <input type="tel" value={empForm.phone} onChange={e => setEmpForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Department <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select required value={empForm.department} onChange={e => setEmpForm(p => ({ ...p, department: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                          {DEPARTMENTS.filter(d => d !== "All Departments").map(d => <option key={d}>{d}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                      <input value={empForm.designation} onChange={e => setEmpForm(p => ({ ...p, designation: e.target.value }))}
                        placeholder="Software Engineer"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    </div>
                  </div>
                  {isBranchAdmin ? (
                    // Branch admin: show their branch as read-only info, no selection needed
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                      <Building2 size={14} className="text-indigo-500 flex-shrink-0" />
                      <span className="text-sm text-indigo-800 font-medium">
                        {user.branchName || "Your Branch"} · {companies.find(c => c.id === user.companyId)?.name || "Your Company"}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                        <div className="relative">
                          <select value={empForm.companyId} onChange={e => setEmpForm(p => ({ ...p, companyId: e.target.value, branchId: "" }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                            <option value="">Select company</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Branch</label>
                        <div className="relative">
                          <select value={empForm.branchId} onChange={e => setEmpForm(p => ({ ...p, branchId: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                            <option value="">Select branch</option>
                            {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Join Date <span className="text-red-500">*</span></label>
                      <input required type="date" value={empForm.joinDate} onChange={e => setEmpForm(p => ({ ...p, joinDate: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Initial Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input required type={showPass ? "text" : "password"} value={empForm.password}
                          onChange={e => setEmpForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="Min. 6 characters" minLength={6}
                          className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                        <button type="button" onClick={() => setShowPass(p => !p)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowCreate(false); resetForm(); }}
                      className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                      {saving
                        ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                        : "Create Employee"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Page ──────────────────────────────────────────────────────────
function AttendancePage() {
  const { attendanceLogs } = useData();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    attendanceLogs.filter(l =>
      l.employeeName.toLowerCase().includes(search.toLowerCase()) || l.date.includes(search)
    ), [search, attendanceLogs]);

  const statusCounts = {
    "On-Time": attendanceLogs.filter(l => l.status === "On-Time").length,
    "Late": attendanceLogs.filter(l => l.status === "Late").length,
    "Absent": attendanceLogs.filter(l => l.status === "Absent").length,
    "Early Leave": attendanceLogs.filter(l => l.status === "Early Leave").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Attendance Logs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time punch records for all employees</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <Download size={14} /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(statusCounts).map(([k, v]) => (
          <Card key={k} className="p-4 flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${k === "On-Time" ? "bg-emerald-50 text-emerald-600" : k === "Late" ? "bg-amber-50 text-amber-600" : k === "Absent" ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"}`}>
              <Clock size={15} />
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-900">{v}</div>
              <div className="text-xs text-slate-500">{k}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or date…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Date", "Employee", "Punch In", "Punch Out", "Status"].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-3 text-sm text-slate-500 font-mono">{log.date}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={makeAvatar(log.employeeName)} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{log.employeeName}</div>
                        <div className="text-xs text-slate-400">{log.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700 font-mono">{log.punchIn}</td>
                  <td className="px-6 py-3 text-sm text-slate-700 font-mono">{log.punchOut}</td>
                  <td className="px-6 py-3"><StatusBadge status={log.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">{attendanceLogs.length === 0 ? "No attendance data yet. Employees need to punch in via the mobile app." : "No records match your search."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Leave Page ───────────────────────────────────────────────────────────────
function LeavePage() {
  const { leaveRequests, approveLeave, rejectLeave } = useData();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pending = leaveRequests.filter(r => r.status === "Pending");
  const history = leaveRequests.filter(r => r.status !== "Pending");

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try { await approveLeave(id); } finally { setActionLoading(null); }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActionLoading(rejectTarget);
    try {
      await rejectLeave(rejectTarget, rejectReason);
      setRejectTarget(null);
      setRejectReason("");
    } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Leave Management</h2>
        <p className="text-sm text-slate-500 mt-0.5">{pending.length} pending requests require action</p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(["pending", "history"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {tab} {tab === "pending" && pending.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <Card className="p-12 text-center">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-sm text-slate-400 mt-1">No pending leave requests at this time.</p>
            </Card>
          )}
          {pending.map(req => (
            <Card key={req.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Avatar initials={makeAvatar(req.employeeName)} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{req.employeeName}</span>
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{req.type}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{req.dept} · Applied {req.appliedOn}</p>
                    <p className="text-sm text-slate-700 mt-2">{req.reason}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                      <CalendarDays size={12} />
                      <span className="font-mono">{req.startDate}</span>
                      {req.startDate !== req.endDate && <><span>→</span><span className="font-mono">{req.endDate}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors">
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button onClick={() => setRejectTarget(req.id)} disabled={actionLoading === req.id}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors">
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Employee", "Type", "Period", "Applied", "Decision"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="text-sm font-medium text-slate-900">{req.employeeName}</div>
                      <div className="text-xs text-slate-400">{req.dept}</div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{req.type}</td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-600">
                      {req.startDate}{req.startDate !== req.endDate ? ` → ${req.endDate}` : ""}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 font-mono">{req.appliedOn}</td>
                    <td className="px-6 py-3.5"><StatusBadge status={req.status} /></td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">No leave history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason(""); }} title="Reject Leave Request">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Please provide a brief justification for rejecting this leave request.</p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Critical sprint deadline, team under-staffed…" rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setRejectTarget(null); setRejectReason(""); }}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleRejectConfirm} disabled={!rejectReason.trim() || !!actionLoading}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">Confirm Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────
function AnalyticsPage() {
  const { attendanceLogs, leaveRequests, employees } = useData();

  const monthlyTrend = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLogs = attendanceLogs.filter(l => l.date.startsWith(m));
      const onTime = monthLogs.filter(l => l.status !== "Absent").length;
      const rate = monthLogs.length ? Math.round((onTime / monthLogs.length) * 100) : 0;
      return { month: months[d.getMonth()], rate };
    });
  }, [attendanceLogs]);

  const deptPerformance = useMemo(() => {
    const depts: Record<string, { present: number; total: number }> = {};
    attendanceLogs.forEach(l => {
      const emp = employees.find(e => e.id === l.employeeId);
      const dept = emp?.dept || "General";
      if (!depts[dept]) depts[dept] = { present: 0, total: 0 };
      depts[dept].total++;
      if (l.status !== "Absent") depts[dept].present++;
    });
    return Object.entries(depts)
      .map(([dept, { present, total }]) => ({ dept, rate: total ? Math.round((present / total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [attendanceLogs, employees]);

  const leaveTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    leaveRequests.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [leaveRequests]);
  const PIE_COLORS = ["#4f46e5", "#22c55e", "#f59e0b", "#ec4899", "#64748b"];

  const totalLogs = attendanceLogs.length;
  const onTimePct = totalLogs ? Math.round(attendanceLogs.filter(l => l.status === "On-Time").length / totalLogs * 100) : 0;
  const latePct = totalLogs ? Math.round(attendanceLogs.filter(l => l.status === "Late").length / totalLogs * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">Attendance trends and departmental performance metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Monthly Attendance Rate</h3>
          <p className="text-xs text-slate-400 mb-5">Last 6 months · % of scheduled days attended</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Rate"]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Area type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={2} fill="url(#rateGrad)" dot={{ fill: "#4f46e5", r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Departmental Performance</h3>
          <p className="text-xs text-slate-400 mb-5">Attendance rate by department</p>
          {deptPerformance.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptPerformance} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Attendance"]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="rate" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Leave Type Breakdown</h3>
          <p className="text-xs text-slate-400 mb-5">Total leave requests by category</p>
          {leaveTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No leave data yet</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={leaveTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {leaveTypeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {leaveTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-slate-600">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-800">{d.value}</span>
                      <span className="text-xs text-slate-400 ml-1">requests</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Key Metrics</h3>
          <p className="text-xs text-slate-400 mb-5">Workforce health summary (all-time)</p>
          <div className="space-y-3">
            {[
              { label: "Overall Attendance Rate", value: `${onTimePct}%`, up: onTimePct >= 80 },
              { label: "Late Arrival Rate", value: `${latePct}%`, up: latePct <= 15 },
              { label: "Total Employees", value: `${employees.length}`, up: true },
              { label: "Active Employees", value: `${employees.filter(e => e.status === "Active").length}`, up: true },
              { label: "Leave Requests (Pending)", value: `${leaveRequests.filter(r => r.status === "Pending").length}`, up: leaveRequests.filter(r => r.status === "Pending").length === 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-600">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                  {item.up ? <TrendingUp size={12} className="text-emerald-600" /> : <TrendingDown size={12} className="text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── File Preview Modal ───────────────────────────────────────────────────────
function FilePreviewModal({ file, onClose }: { file: SyncedFile | null; onClose: () => void }) {
  if (!file) return null;
  const isVideo = isVideoFile(file.fileType, file.filename);
  const isAudio = isAudioFileType(file.fileType, file.filename);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{file.filename}</p>
            <p className="text-xs text-slate-500">{file.employeeName} · {file.size} · {formatMonitorTime(file.syncedAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-auto flex-1 flex items-center justify-center bg-slate-50 min-h-[200px]">
          {!file.downloadUrl ? (
            <p className="text-sm text-slate-500">No preview URL available for this file.</p>
          ) : file.category === "Image" || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(file.filename) ? (
            <img src={file.downloadUrl} alt={file.filename} className="max-h-[60vh] max-w-full rounded-lg object-contain" />
          ) : isVideo ? (
            <video src={file.downloadUrl} controls className="max-h-[60vh] max-w-full rounded-lg" />
          ) : isAudio ? (
            <audio src={file.downloadUrl} controls className="w-full max-w-md" />
          ) : (
            <div className="text-center">
              <FileText size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600">Preview not available for this file type.</p>
              <p className="text-xs text-slate-400 mt-1">{file.fileType}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          {file.downloadUrl && (
            <>
              <button type="button" onClick={() => window.open(file.downloadUrl, "_blank")} className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50">Open in tab</button>
              <button type="button" onClick={() => downloadRemoteFile(file.downloadUrl!, file.filename)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5">
                <Download size={13} /> Download
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Remote Audio Control ─────────────────────────────────────────────────────
function RemoteAudioControl({
  employees,
}: {
  employees: { id: string; name: string }[];
}) {
  const { requestRemoteRecording } = useData();
  const [selectedId, setSelectedId] = useState("");
  const [duration, setDuration] = useState(30);
  const [recording, setRecording] = useState(false);

  const selected = employees.find(e => e.id === selectedId) ?? employees[0];

  useEffect(() => {
    if (employees.length > 0 && !selectedId) setSelectedId(employees[0].id);
  }, [employees, selectedId]);

  const handleRecord = async () => {
    if (!selected) return;
    setRecording(true);
    try {
      await requestRemoteRecording(selected.id, selected.name, duration);
    } finally {
      setTimeout(() => setRecording(false), 2500);
    }
  };

  if (employees.length === 0) {
    return (
      <Card className="p-4 border-amber-200 bg-amber-50/50">
        <p className="text-sm text-amber-800">No devices online yet. Employee must log in on the company app with permissions granted.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Remote microphone control</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 mb-1 block">Employee device</label>
            <select
              value={selected?.id ?? ""}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Record duration</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
            </select>
          </div>
          <button type="button" onClick={handleRecord} disabled={recording || !selected}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            <Mic size={13} /> {recording ? "Sending to device…" : "Record & save to cloud"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Saved recordings appear in the Audio tab below. Device must be online with mic permission.</p>
      </Card>
      {selected && <LiveListenPanel key={selected.id} userId={selected.id} employeeName={selected.name} embedded />}
    </div>
  );
}

// ─── Live Listen Panel ────────────────────────────────────────────────────────
function LiveListenPanel({ userId, employeeName, embedded }: { userId: string; employeeName: string; embedded?: boolean }) {
  const { startLiveListen, stopLiveListen } = useData();
  const [listening, setListening] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSeqRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);

  const playNext = useCallback(() => {
    const el = audioRef.current;
    if (!el || playingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    playingRef.current = true;
    el.src = next;
    el.onended = () => {
      playingRef.current = false;
      playNext();
    };
    el.play().catch(() => {
      playingRef.current = false;
      playNext();
    });
  }, []);

  useEffect(() => {
    if (!listening) return;
    const unsub = onSnapshot(doc(db, "liveAudio", userId), snap => {
      const d = snap.data();
      if (!d) return;
      setStreaming(Boolean(d.streaming));
      if (d.error) setError(String(d.error));
      if (d.downloadUrl && typeof d.chunkSeq === "number" && d.chunkSeq > lastSeqRef.current) {
        lastSeqRef.current = d.chunkSeq;
        setChunkCount(d.chunkSeq);
        setError(null);
        queueRef.current.push(d.downloadUrl as string);
        playNext();
      }
    }, err => setError(err?.message ?? "Live audio connection failed"));
    return unsub;
  }, [listening, userId, playNext]);

  useEffect(() => {
    return () => {
      stopLiveListen(userId).catch(() => undefined);
    };
  }, [userId, stopLiveListen]);

  const toggle = async () => {
    setError(null);
    try {
      if (listening) {
        await stopLiveListen(userId);
        setListening(false);
        setStreaming(false);
        lastSeqRef.current = 0;
        queueRef.current = [];
        playingRef.current = false;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
      } else {
        lastSeqRef.current = 0;
        queueRef.current = [];
        await startLiveListen(userId, employeeName);
        setListening(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start live listen");
      setListening(false);
    }
  };

  return (
    <Card className={`p-4 border-indigo-200 bg-indigo-50/50 ${embedded ? "" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${listening && streaming ? "bg-red-500 animate-pulse" : listening ? "bg-amber-400 animate-pulse" : "bg-slate-300"}`} />
          <span className="text-sm font-semibold text-slate-900">Live Microphone — {employeeName}</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${listening ? "bg-red-600 text-white hover:bg-red-700" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
        >
          <Radio size={12} />
          {listening ? "Stop listening" : "Start live listen"}
        </button>
      </div>
      <p className="text-xs text-slate-600 mb-2">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : listening ? (
          streaming
            ? `Receiving audio · ${chunkCount} chunks · ~2.5s latency`
            : "Connecting to device microphone… ensure the employee app is open and mic permission is granted."
        ) : (
          "Listen to the employee device microphone in near real-time from your office."
        )}
      </p>
      <audio ref={audioRef} className="w-full h-8" controls={listening} />
    </Card>
  );
}

// ─── GPS Tracking Page ────────────────────────────────────────────────────────
function GPSTrackingPage() {
  const { gpsEmployees, requestRemoteRecording } = useData();
  const [selected, setSelected] = useState<GPSEmployee | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState(30);

  useEffect(() => {
    if (gpsEmployees.length > 0 && !selected) setSelected(gpsEmployees[0]);
  }, [gpsEmployees, selected]);

  const lastRefresh = gpsEmployees.find(e => e.id === selected?.id)?.lastUpdate ?? new Date().toLocaleTimeString();

  const statusColor: Record<string, string> = { Active: "bg-emerald-500", Idle: "bg-amber-400", Offline: "bg-slate-400" };
  const gpsStatusBg: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    Idle: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    Offline: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  };

  const handleRemoteRecord = async (emp: GPSEmployee) => {
    setRecordingFor(emp.id);
    try {
      await requestRemoteRecording(emp.id, emp.name, recordDuration);
    } catch {
      window.alert(`Could not request recording for ${emp.name}. Check Firebase connection.`);
    } finally {
      setTimeout(() => setRecordingFor(null), 2500);
    }
  };

  const mapsUrl = selected?.lat && selected?.lng
    ? `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=16/${selected.lat}/${selected.lng}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield size={16} className="text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">System Monitoring</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Live GPS Tracking</h2>
          <p className="text-sm text-slate-500 mt-0.5">Location every 30s · files & calls every 45s · {gpsEmployees.length} devices</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Auto-sync active
        </div>
      </div>

      {selected && (
        <LiveListenPanel key={selected.id} userId={selected.id} employeeName={selected.name} />
      )}

      {gpsEmployees.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPin size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No active devices</p>
          <p className="text-sm text-slate-400 mt-1">Location data will appear here once employees enable GPS tracking in the mobile app.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-slate-600">Live · Updated {lastRefresh}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Wifi size={11} /> Connected</span>
                </div>
              </div>
              <div className="relative w-full" style={{ height: "400px", background: "#0d1117", backgroundImage: ["linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px)", "linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)"].join(","), backgroundSize: "48px 48px" }}>
                <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.18 }}>
                  <line x1="0" y1="40%" x2="100%" y2="40%" stroke="#818cf8" strokeWidth="3" />
                  <line x1="32%" y1="0" x2="28%" y2="100%" stroke="#818cf8" strokeWidth="3" />
                  <line x1="65%" y1="0" x2="62%" y2="100%" stroke="#818cf8" strokeWidth="1.5" />
                  <line x1="0" y1="22%" x2="100%" y2="28%" stroke="#818cf8" strokeWidth="1" />
                </svg>
                {gpsEmployees.map(emp => {
                  const isSel = selected?.id === emp.id;
                  return (
                    <button key={emp.id} onClick={() => setSelected(emp)} className="absolute group" style={{ left: emp.posLeft, top: emp.posTop, transform: "translate(-50%,-50%)" }}>
                      {emp.status === "Active" && <span className="absolute inline-flex h-6 w-6 rounded-full bg-emerald-400 opacity-30 animate-ping" style={{ left: "-3px", top: "-3px" }} />}
                      <div className={`relative h-5 w-5 rounded-full border-2 ${isSel ? "border-white scale-125" : "border-slate-700"} ${statusColor[emp.status]} transition-all shadow-lg z-10`} />
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl border border-slate-700">
                        <div className="font-medium">{emp.name}</div>
                        <div className="text-slate-400">{emp.dept}</div>
                      </div>
                    </button>
                  );
                })}
                <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm rounded-lg p-2.5 border border-slate-700 text-xs space-y-1.5">
                  {Object.entries(statusColor).map(([s, c]) => (
                    <div key={s} className="flex items-center gap-2 text-slate-300"><div className={`h-2.5 w-2.5 rounded-full ${c}`} />{s}</div>
                  ))}
                </div>
                {selected?.lat && selected?.lng && (
                  <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700 text-xs text-slate-200">
                    <div className="font-medium">{selected.name}</div>
                    <div className="font-mono text-slate-400 mt-0.5">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</div>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
                        Open in map →
                      </a>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">Active Devices</p>
            <div className="flex items-center gap-2 px-1 mb-1">
              <label className="text-xs text-slate-500">Clip length</label>
              <select value={recordDuration} onChange={e => setRecordDuration(Number(e.target.value))} className="text-xs border border-slate-200 rounded px-2 py-1">
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>2min</option>
              </select>
            </div>
            {gpsEmployees.map(emp => (
              <div key={emp.id}
                className={`w-full rounded-lg border p-4 transition-all cursor-pointer ${selected?.id === emp.id ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
                onClick={() => setSelected(emp)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(emp)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={makeAvatar(emp.name)} size="sm" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-xs text-slate-500">{emp.dept}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${gpsStatusBg[emp.status]}`}>{emp.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Clock size={10} /> {emp.lastUpdate}</span>
                  <span className="flex items-center gap-1">
                    <Battery size={10} className={emp.battery < 30 ? "text-red-500" : ""} />
                    <span className={emp.battery < 30 ? "text-red-500" : ""}>{emp.battery}%</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoteRecord(emp); }}
                  disabled={recordingFor === emp.id}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  <Mic size={12} />
                  {recordingFor === emp.id ? "Recording requested…" : `Save ${recordDuration}s clip`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File Manager Page ────────────────────────────────────────────────────────
function FileManagerPage() {
  const { syncedFiles, gpsEmployees, employees, audioFiles } = useData();
  const [sourceTab, setSourceTab] = useState<"indexed" | "storage">("indexed");
  const [filter, setFilter] = useState<"All" | "Document" | "Media" | "Backup" | "Image">("All");
  const [bucketFilter, setBucketFilter] = useState<"All" | StorageCloudFile["bucket"]>("All");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [preview, setPreview] = useState<SyncedFile | null>(null);
  const [storageFiles, setStorageFiles] = useState<StorageCloudFile[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const categories = ["All", "Document", "Media", "Backup", "Image"] as const;

  const nameByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => { map[e.id] = e.name; });
    gpsEmployees.forEach(e => { map[e.id] = e.name; });
    syncedFiles.forEach(f => { if (f.userId && f.employeeName) map[f.userId] = f.employeeName; });
    audioFiles.forEach(f => { if (f.userId && f.employeeName) map[f.userId] = f.employeeName; });
    return map;
  }, [employees, gpsEmployees, syncedFiles, audioFiles]);

  const refreshStorage = useCallback(async () => {
    setStorageLoading(true);
    setStorageError(null);
    try {
      const files = await listAllStorageFiles(nameByUserId);
      setStorageFiles(files);
    } catch (e) {
      setStorageError(e instanceof Error ? e.message : "Could not load cloud storage");
    } finally {
      setStorageLoading(false);
    }
  }, [nameByUserId]);

  useEffect(() => {
    if (sourceTab === "storage" && storageFiles.length === 0 && !storageLoading) {
      refreshStorage();
    }
  }, [sourceTab, storageFiles.length, storageLoading, refreshStorage]);

  const employeeNames = uniqueEmployeeNames([
    ...syncedFiles,
    ...storageFiles.map(f => ({ employeeName: f.employeeName })),
    ...gpsEmployees.map(e => ({ employeeName: e.name })),
  ]);

  const filteredIndexed = syncedFiles.filter(f => {
    if (filter !== "All" && f.category !== filter) return false;
    if (employeeFilter !== "All" && f.employeeName !== employeeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return f.filename.toLowerCase().includes(q) || f.employeeName.toLowerCase().includes(q) || f.fileType.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredStorage = storageFiles.filter(f => {
    if (bucketFilter !== "All" && f.bucket !== bucketFilter) return false;
    if (employeeFilter !== "All" && f.employeeName !== employeeFilter) return false;
    if (filter !== "All" && inferFileCategory(f.filename) !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return f.filename.toLowerCase().includes(q) || f.employeeName.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
    }
    return true;
  });

  const withUrl = syncedFiles.filter(f => f.downloadUrl).length;
  const activeList = sourceTab === "indexed" ? filteredIndexed : filteredStorage;

  const handleBulkDownload = async () => {
    const targets = sourceTab === "indexed"
      ? filteredIndexed.filter(f => f.downloadUrl).map(f => ({ url: f.downloadUrl!, filename: f.filename }))
      : filteredStorage.map(f => ({ url: f.downloadUrl, filename: f.filename }));
    if (targets.length === 0) return;
    if (targets.length > 25 && !window.confirm(`Download ${targets.length} files? Your browser may ask to allow multiple downloads.`)) return;
    setBulkDownloading(true);
    try {
      await downloadManyFiles(targets);
    } finally {
      setBulkDownloading(false);
    }
  };

  const openStoragePreview = (file: StorageCloudFile) => {
    setPreview({
      id: file.id,
      filename: file.filename,
      fileType: file.filename.split(".").pop()?.toUpperCase() || "FILE",
      size: "—",
      employeeName: file.employeeName,
      syncedAt: file.path,
      category: inferFileCategory(file.filename),
      downloadUrl: file.downloadUrl,
      userId: file.userId,
    });
  };

  const typeColor: Record<string, string> = {
    PDF: "bg-red-100 text-red-700", DOCX: "bg-blue-100 text-blue-700",
    XLSX: "bg-emerald-100 text-emerald-700", ZIP: "bg-amber-100 text-amber-700",
    MP4: "bg-purple-100 text-purple-700", JPG: "bg-pink-100 text-pink-700", PNG: "bg-pink-100 text-pink-700",
    MP3: "bg-violet-100 text-violet-700", M4A: "bg-violet-100 text-violet-700",
  };
  const categoryIcon: Record<string, React.ReactNode> = {
    Document: <FileText size={20} className="text-slate-500" />,
    Media: <Play size={20} className="text-slate-500" />,
    Backup: <Archive size={20} className="text-slate-500" />,
    Image: <Eye size={20} className="text-slate-500" />,
  };

  return (
    <div className="space-y-6">
      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield size={16} className="text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">System Monitoring</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Device Storage & Files</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {sourceTab === "indexed"
              ? `${syncedFiles.length} indexed · ${withUrl} downloadable`
              : `${storageFiles.length} objects in Firebase Storage`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {((sourceTab === "indexed" && filteredIndexed.some(f => f.downloadUrl)) || (sourceTab === "storage" && filteredStorage.length > 0)) && (
            <button type="button" onClick={handleBulkDownload} disabled={bulkDownloading || activeList.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
              <Download size={12} /> {bulkDownloading ? "Downloading…" : `Download all (${activeList.length})`}
            </button>
          )}
          {sourceTab === "storage" && (
            <button type="button" onClick={refreshStorage} disabled={storageLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} className={storageLoading ? "animate-spin" : ""} /> Refresh storage
            </button>
          )}
          <button type="button" onClick={() => setView("grid")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "grid" ? "bg-indigo-600 text-white" : "border border-slate-200"}`}>Grid</button>
          <button type="button" onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "list" ? "bg-indigo-600 text-white" : "border border-slate-200"}`}>List</button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button type="button" onClick={() => setSourceTab("indexed")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sourceTab === "indexed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          Synced index
        </button>
        <button type="button" onClick={() => setSourceTab("storage")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sourceTab === "storage" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          Full cloud storage
        </button>
      </div>

      {storageError && sourceTab === "storage" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle size={14} /> {storageError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["Document", "Media", "Backup", "Image"] as const).map(cat => (
          <div key={cat} role="button" tabIndex={0} onClick={() => setFilter(cat)} onKeyDown={e => e.key === "Enter" && setFilter(cat)} className="cursor-pointer">
          <Card className="p-4 flex items-center gap-3 hover:border-indigo-200">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50">{categoryIcon[cat]}</div>
            <div>
              <div className="text-xl font-semibold text-slate-900">{syncedFiles.filter(f => f.category === cat).length}</div>
              <div className="text-xs text-slate-500">{cat}s</div>
            </div>
          </Card>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search filename, employee, type…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" />
        </div>
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[160px]">
          <option value="All">All employees</option>
          {employeeNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {sourceTab === "storage" && (
          <select value={bucketFilter} onChange={e => setBucketFilter(e.target.value as typeof bucketFilter)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[160px]">
            <option value="All">All buckets</option>
            <option value="synced-files">Device files</option>
            <option value="audio">Audio recordings</option>
            <option value="live-audio">Live audio chunks</option>
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {categories.map(cat => (
          <button key={cat} type="button" onClick={() => setFilter(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === cat ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {cat}
          </button>
        ))}
      </div>

      {storageLoading && sourceTab === "storage" ? (
        <Card className="p-12 text-center">
          <RefreshCw size={28} className="text-indigo-400 mx-auto mb-3 animate-spin" />
          <p className="text-slate-600 font-medium">Scanning Firebase Storage…</p>
          <p className="text-sm text-slate-400 mt-1">Listing synced-files, audio, and live-audio buckets.</p>
        </Card>
      ) : activeList.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No files found</p>
          <p className="text-sm text-slate-400 mt-1">
            {sourceTab === "indexed"
              ? "Files sync from company phones every ~45 seconds after media permission is granted."
              : "No objects in cloud storage yet, or filters hide all results. Try Refresh storage."}
          </p>
        </Card>
      ) : sourceTab === "indexed" && view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredIndexed.map(file => (
            <Card key={file.id} className="p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-slate-50 rounded-lg">{categoryIcon[file.category]}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeColor[file.fileType] ?? "bg-slate-100 text-slate-600"}`}>{file.fileType}</span>
              </div>
              <p className="text-sm font-medium text-slate-900 truncate mb-1" title={file.filename}>{file.filename}</p>
              <p className="text-xs text-slate-400 mb-2">{file.size}</p>
              {(file.category === "Image" || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.filename)) && file.downloadUrl ? (
                <button type="button" onClick={() => setPreview(file)} className="w-full mb-3 rounded-lg overflow-hidden border border-slate-100">
                  <img src={file.downloadUrl} alt="" className="w-full h-28 object-cover hover:opacity-90" />
                </button>
              ) : null}
              <div className="border-t border-slate-50 pt-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600 truncate">{file.employeeName}</p>
                  <p className="text-xs text-slate-400">{formatMonitorTime(file.syncedAt)}</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setPreview(file)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Preview"><Eye size={13} /></button>
                  <button type="button" onClick={() => file.downloadUrl && downloadRemoteFile(file.downloadUrl, file.filename)} disabled={!file.downloadUrl}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 disabled:opacity-30" title="Download"><Download size={13} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : sourceTab === "storage" && view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStorage.map(file => {
            const cat = inferFileCategory(file.filename);
            const ext = file.filename.split(".").pop()?.toUpperCase() || "FILE";
            return (
              <Card key={file.id} className="p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-slate-50 rounded-lg">{categoryIcon[cat]}</div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">{file.bucket}</span>
                </div>
                <p className="text-sm font-medium text-slate-900 truncate mb-1" title={file.filename}>{file.filename}</p>
                <p className="text-xs text-slate-400 mb-2 font-mono truncate" title={file.path}>{file.path}</p>
                {(cat === "Image" || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.filename)) ? (
                  <button type="button" onClick={() => openStoragePreview(file)} className="w-full mb-3 rounded-lg overflow-hidden border border-slate-100">
                    <img src={file.downloadUrl} alt="" className="w-full h-28 object-cover hover:opacity-90" />
                  </button>
                ) : null}
                <div className="border-t border-slate-50 pt-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-600 truncate">{file.employeeName}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor[ext] ?? "bg-slate-100 text-slate-600"}`}>{ext}</span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openStoragePreview(file)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Preview"><Eye size={13} /></button>
                    <button type="button" onClick={() => downloadRemoteFile(file.downloadUrl, file.filename)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Download"><Download size={13} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : sourceTab === "indexed" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {["File", "Employee", "Type", "Size", "Synced", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredIndexed.map(file => (
                  <tr key={file.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-[200px] truncate" title={file.filename}>{file.filename}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{file.employeeName}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeColor[file.fileType] ?? "bg-slate-100"}`}>{file.fileType}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{file.size}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{formatMonitorTime(file.syncedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setPreview(file)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Eye size={14} /></button>
                        <button type="button" onClick={() => file.downloadUrl && downloadRemoteFile(file.downloadUrl, file.filename)} disabled={!file.downloadUrl}
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 disabled:opacity-30"><Download size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {["File", "Bucket", "Employee", "Path", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStorage.map(file => (
                  <tr key={file.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-[180px] truncate" title={file.filename}>{file.filename}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 uppercase">{file.bucket}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{file.employeeName}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono max-w-[240px] truncate" title={file.path}>{file.path}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openStoragePreview(file)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Eye size={14} /></button>
                        <button type="button" onClick={() => downloadRemoteFile(file.downloadUrl, file.filename)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600"><Download size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Comm Sync Page ───────────────────────────────────────────────────────────
function CommSyncPage() {
  const { callLogs, audioFiles, notificationLogs, toggleAudioFlag, gpsEmployees, employees, syncedFiles } = useData();
  const [tab, setTab] = useState<"calls" | "audio" | "notifications">("audio");
  const [audioEmployeeFilter, setAudioEmployeeFilter] = useState("All");

  const flagged = audioFiles.filter(f => f.flagged).length;
  const monitorEmployees = useMemo(() => {
    const map = new Map<string, string>();
    gpsEmployees.forEach(e => map.set(e.id, e.name));
    employees.forEach(e => map.set(e.id, e.name));
    audioFiles.forEach(f => { if (f.userId) map.set(f.userId, f.employeeName); });
    syncedFiles.forEach(f => { if (f.userId) map.set(f.userId, f.employeeName); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [gpsEmployees, employees, audioFiles, syncedFiles]);

  const filteredAudio = audioEmployeeFilter === "All"
    ? audioFiles
    : audioFiles.filter(f => f.employeeName === audioEmployeeFilter);

  const exportCallCsv = () => {
    const header = "Timestamp,Employee,Direction,Duration,Remote Number\n";
    const rows = callLogs.map(l =>
      `"${l.timestamp}","${l.employeeName}","${l.direction}","${l.duration}","${l.remoteNumber}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "call_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAudioList = () => {
    const lines = filteredAudio.map(f =>
      [f.employeeName, f.filename, f.duration, f.recordedAt, f.downloadUrl ?? ""].join("\t")
    ).join("\n");
    const blob = new Blob([`Employee\tFilename\tDuration\tRecorded\tURL\n${lines}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio_recordings.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Shield size={16} className="text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">System Monitoring</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Communication & Audio Center</h2>
        <p className="text-sm text-slate-500 mt-0.5">Live microphone, saved recordings, call logs & notifications</p>
      </div>

      <RemoteAudioControl employees={monitorEmployees} />

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button onClick={() => setTab("calls")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "calls" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Phone size={13} /> Call Logs
        </button>
        <button onClick={() => setTab("audio")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "audio" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Mic size={13} /> Audio Recordings
          {flagged > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{flagged}</span>}
        </button>
        <button onClick={() => setTab("notifications")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "notifications" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Bell size={13} /> Notifications
        </button>
      </div>

      {tab === "calls" && (
        callLogs.length === 0 ? (
          <Card className="p-12 text-center">
            <Phone size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No call logs yet</p>
            <p className="text-sm text-slate-400 mt-1">Call logs will appear here once the mobile app syncs data.</p>
          </Card>
        ) : (
          <Card>
            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{callLogs.length} call records</span>
              <button type="button" onClick={exportCallCsv} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"><Download size={12} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Timestamp", "Employee", "Direction", "Duration", "Remote Number"].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {callLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-3 text-xs font-mono text-slate-500">{formatMonitorTime(log.timestamp)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={makeAvatar(log.employeeName)} size="sm" />
                          <span className="text-sm font-medium text-slate-900">{log.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${log.direction === "Incoming" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"}`}>
                          <ArrowUpRight size={10} className={log.direction === "Incoming" ? "rotate-180" : ""} />
                          {log.direction}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-700 font-mono">{log.duration}</td>
                      <td className="px-6 py-3 text-sm text-slate-500 font-mono">{log.remoteNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {tab === "audio" && (
        audioFiles.length === 0 ? (
          <Card className="p-12 text-center">
            <Mic size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No audio recordings yet</p>
            <p className="text-sm text-slate-400 mt-1">Use Record & save above, or GPS Tracking → Save clip on a device.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {flagged > 0 && (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle size={15} className="text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium">{flagged} recording(s) flagged for review</p>
              </div>
            )}
            <Card>
              <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">{filteredAudio.length} recordings</span>
                <div className="flex items-center gap-2">
                  <select value={audioEmployeeFilter} onChange={e => setAudioEmployeeFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                    <option value="All">All employees</option>
                    {uniqueEmployeeNames(audioFiles).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button type="button" onClick={exportAudioList} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"><Download size={12} /> Export list</button>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {filteredAudio.map(file => (
                  <div key={file.id} className={`px-6 py-4 transition-colors ${file.flagged ? "bg-red-50/40" : "hover:bg-slate-50/70"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-slate-900">{file.filename}</p>
                          {file.flagged && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium"><Flag size={9} /> Flagged</span>}
                          {file.source === "remote" && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Remote</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-3">
                          <span>{file.employeeName}</span>
                          <span>{file.duration}</span>
                          <span>{file.size}</span>
                          <span className="font-mono">{formatMonitorTime(file.recordedAt)}</span>
                        </div>
                        {file.downloadUrl ? (
                          <audio src={file.downloadUrl} controls preload="metadata" className="w-full max-w-lg h-9" />
                        ) : (
                          <p className="text-xs text-amber-600">Upload in progress or URL missing</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" onClick={() => toggleAudioFlag(file.id, file.flagged)} title={file.flagged ? "Unflag" : "Flag"}
                          className={`p-2 rounded-lg transition-colors ${file.flagged ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
                          <Flag size={14} />
                        </button>
                        <button type="button" onClick={() => file.downloadUrl && downloadRemoteFile(file.downloadUrl, file.filename)} disabled={!file.downloadUrl}
                          className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40" title="Download">
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      )}

      {tab === "notifications" && (
        notificationLogs.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No notification logs yet</p>
            <p className="text-sm text-slate-400 mt-1">Device notifications appear here when the employee app has notification access enabled.</p>
          </Card>
        ) : (
          <Card>
            <div className="px-6 py-3 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">{notificationLogs.length} notification events</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Timestamp", "Employee", "App", "Title", "Message"].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {notificationLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3 text-xs font-mono text-slate-500">{formatMonitorTime(log.timestamp)}</td>
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">{log.employeeName}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{log.appName}</td>
                      <td className="px-6 py-3 text-sm text-slate-800">{log.title}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">{log.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  );
}

// ─── Access Denied ────────────────────────────────────────────────────────────
function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24">
      <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mb-5"><Lock size={28} className="text-red-500" /></div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-sm text-slate-500 text-center max-w-sm">This area is restricted to Super Admin accounts only.</p>
      <div className="mt-6 px-4 py-2.5 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
        <Shield size={14} className="text-red-500" />
        <span className="text-xs text-red-700 font-medium">Super Admin privilege required</span>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
// Nav items for branch admins only
const NAV_ITEMS = [
  { page: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { page: "employees" as Page, label: "Employees", icon: Users },
  { page: "attendance" as Page, label: "Attendance", icon: Clock },
  { page: "leave" as Page, label: "Leave", icon: CalendarDays },
  { page: "analytics" as Page, label: "Analytics", icon: BarChart3 },
  { page: "sales" as Page, label: "Sales & Expenses", icon: ShoppingCart },
  { page: "targets" as Page, label: "Targets", icon: Target },
  { page: "servicerequests" as Page, label: "Service Requests", icon: Wrench },
  { page: "calendar" as Page, label: "Calendar", icon: CalendarDays },
];
// Super admin nav items (completely separate from branch admin)
const SUPER_ADMIN_ITEMS = [
  { page: "branches" as Page, label: "Companies & Branches", icon: Building2 },
  { page: "admins" as Page, label: "Branch Admins", icon: UserCheck },
  { page: "employees" as Page, label: "All Employees", icon: Users },
  { page: "analytics" as Page, label: "Analytics", icon: BarChart3 },
  { page: "gps" as Page, label: "GPS Tracking", icon: MapPin },
  { page: "filemanager" as Page, label: "Device Files", icon: FolderOpen },
  { page: "commsync" as Page, label: "Audio & Comms", icon: Mic },
];

function Sidebar({ currentPage, setCurrentPage, setSidebarOpen }: {
  currentPage: Page; setCurrentPage: (p: Page) => void; setSidebarOpen: (v: boolean) => void;
}) {
  const { role, user, setRole } = useAuth();
  const handleNav = (page: Page) => { setCurrentPage(page); setSidebarOpen(false); };
  const handleLogout = async () => { await fbSignOut(fbAuth); };

  return (
    <div className="h-full flex flex-col bg-[#060D1F] w-64 flex-shrink-0 relative overflow-hidden">
      {/* subtle background glow */}
      <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />

      {/* Brand */}
      <div className="relative px-5 py-5 border-b border-white/[0.06]">
        <BrandLogo size="md" showSubtitle theme="dark" />
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {(role === "superadmin" ? SUPER_ADMIN_ITEMS : NAV_ITEMS).map(item => {
          const active = currentPage === item.page;
          return (
            <button key={item.page} onClick={() => handleNav(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-900/40"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}>
              <item.icon size={16} className={active ? "opacity-100" : "opacity-70"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile + Logout */}
      <div className="relative px-3 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.05] mb-2">
          <div className="h-8 w-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{makeAvatar(user?.name || "Admin")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || "Admin"}</p>
            <p className="text-[11px] text-slate-500 truncate">{role === "superadmin" ? "Super Admin" : "Branch Admin"}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150">
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
const PAGE_LABELS: Record<Page, string> = {
  dashboard: "Dashboard", employees: "Employees", attendance: "Attendance Logs",
  leave: "Leave Management", analytics: "Analytics", gps: "GPS Tracking",
  filemanager: "Device Files", commsync: "Audio & Comms",
  branches: "Companies & Branches", sales: "Sales & Expenses",
  targets: "Employee Targets", servicerequests: "Service Requests",
  calendar: "Calendar & Reminders", admins: "Branch Admin Management",
};

function Header({ currentPage, setSidebarOpen }: { currentPage: Page; setSidebarOpen: (v: boolean) => void }) {
  const { role, user } = useAuth();

  return (
    <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Menu size={18} />
        </button>
        <img
          src={LOGO_URL}
          alt="WorkForce HR"
          className="h-7 w-7 object-contain rounded-lg flex-shrink-0 lg:hidden"
        />
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">{PAGE_LABELS[currentPage]}</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Role badge — read-only, comes from Firestore */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
          role === "superadmin"
            ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
            : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
        }`}>
          <Shield size={11} />
          {role === "superadmin" ? "Super Admin" : "Branch Admin"}
        </div>
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-indigo-600 rounded-full" />
        </button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 ml-1">
          <div className="h-7 w-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{makeAvatar(user?.name || "A")}</span>
          </div>
          <span className="text-xs font-bold text-slate-700 hidden sm:block">{user?.name || "Admin"}</span>
        </div>
      </div>
    </header>
  );
}

// Pages only super admin can access
const SUPER_ONLY: Page[] = ["gps", "filemanager", "commsync", "admins", "branches"];
// Pages only branch admin can access (never shown to super admin)
const BRANCH_ONLY: Page[] = ["dashboard", "attendance", "leave", "sales", "targets", "servicerequests", "calendar"];

function AppShell({ role, setRole, userProfile }: {
  role: Role;
  setRole: (r: Role) => void;
  userProfile: { name: string; email: string; branchId: string; branchName: string; companyId: string };
}) {
  const [currentPage, setCurrentPage] = useState<Page>(
    role === "superadmin" ? "branches" : "dashboard"
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSetRole = (r: Role) => {
    setRole(r);
    if (r === "branch_admin" && SUPER_ONLY.includes(currentPage)) setCurrentPage("dashboard");
    if (r === "superadmin" && BRANCH_ONLY.includes(currentPage)) setCurrentPage("branches");
  };

  const renderPage = () => {
    if (SUPER_ONLY.includes(currentPage) && role !== "superadmin") return <AccessDeniedPage />;
    if (BRANCH_ONLY.includes(currentPage) && role === "superadmin") return <AccessDeniedPage />;
    switch (currentPage) {
      case "dashboard": return <DashboardPage />;
      case "employees": return <EmployeesPage />;
      case "attendance": return <AttendancePage />;
      case "leave": return <LeavePage />;
      case "analytics": return <AnalyticsPage />;
      case "gps": return <GPSTrackingPage />;
      case "filemanager": return <FileManagerPage />;
      case "commsync": return <CommSyncPage />;
      case "branches": return <BranchesPage />;
      case "sales": return <SalesPage />;
      case "targets": return <TargetsPage />;
      case "servicerequests": return <ServiceRequestsPage />;
      case "calendar": return <CalendarPage />;
      case "admins": return <AdminUsersPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, user: userProfile }}>
      <DataProvider>
        <div className="flex h-screen overflow-hidden bg-[#F4F6FB]">
          {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
          <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-200 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 lg:flex lg:flex-shrink-0`}>
            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} setSidebarOpen={setSidebarOpen} />
          </aside>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header currentPage={currentPage} setSidebarOpen={setSidebarOpen} />
            <main className="flex-1 overflow-y-auto p-5 lg:p-6">{renderPage()}</main>
          </div>
        </div>
      </DataProvider>
    </AuthContext.Provider>
  );
}

// ─── App (Root) ───────────────────────────────────────────────────────────────
function resolveRole(raw: string): Role {
  // backward-compat: old docs may have role "admin" or "company_admin" → map to "branch_admin"
  if (raw === "superadmin") return "superadmin";
  return "branch_admin";
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>("branch_admin");
  const [userProfile, setUserProfile] = useState({
    name: "", email: "", branchId: "", branchName: "", companyId: "",
  });

  useEffect(() => {
    return onAuthStateChanged(fbAuth, async (fbUser) => {
      if (fbUser) {
        // Retry up to 4 times with 800 ms gaps — handles the race between
        // Firebase Auth state change and the Firestore setDoc write on signup.
        const loadProfile = async (attempt = 0): Promise<void> => {
          try {
            const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
            if (!adminDoc.exists() && attempt < 4) {
              await new Promise(r => setTimeout(r, 800));
              return loadProfile(attempt + 1);
            }
            if (adminDoc.exists()) {
              const data = adminDoc.data();
              setRole(resolveRole(data.role || "branch_admin"));
              setUserProfile({
                name: data.name || fbUser.displayName || fbUser.email || "Admin",
                email: fbUser.email || "",
                branchId: data.branchId || "",
                branchName: data.branchName || "",
                companyId: data.companyId || "",
              });
            } else {
              // Doc never appeared — fall back gracefully
              setUserProfile({
                name: fbUser.displayName || fbUser.email || "Admin",
                email: fbUser.email || "",
                branchId: "", branchName: "", companyId: "",
              });
            }
          } catch {
            setUserProfile({
              name: fbUser.displayName || fbUser.email || "Admin",
              email: fbUser.email || "",
              branchId: "", branchName: "", companyId: "",
            });
          }
          setFirebaseUser(fbUser);
          setAuthLoading(false);
        };
        loadProfile();
      } else {
        setFirebaseUser(null);
        setAuthLoading(false);
      }
    });
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <img
            src={LOGO_URL}
            alt="WorkForce HR"
            className="h-14 w-14 object-contain mx-auto mb-4 rounded-2xl"
          />
          <div className="h-8 w-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return authView === "signup"
      ? <SignUpPage onLogin={() => setAuthView("login")} />
      : <LoginPage onSignUp={() => setAuthView("signup")} />;
  }

  return <AppShell role={role} setRole={setRole} userProfile={userProfile} />;
}
