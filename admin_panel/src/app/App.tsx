import React, { useState, createContext, useContext, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  LayoutDashboard, Users, Clock, CalendarDays, BarChart3,
  MapPin, FolderOpen, Phone, Menu, X, LogOut, Search,
  ChevronDown, Download, Play, Flag, Shield, Eye,
  CheckCircle2, XCircle, Bell, Lock, UserCheck, UserX,
  AlertCircle, FileText, Filter, RefreshCw, Mic, Archive,
  Wifi, Battery, Radio, ArrowUpRight, Settings, Building2,
  TrendingUp, TrendingDown, Minus, ChevronRight, Pause
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  collection, onSnapshot, doc, getDoc, setDoc, updateDoc,
  query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { fbAuth, db } from "../firebase";

// ─── Types ───────────────────────────────────────────────────────────────────
type Role = "admin" | "superadmin";
type Page =
  | "dashboard" | "employees" | "attendance" | "leave" | "analytics"
  | "gps" | "filemanager" | "commsync";

interface Employee {
  id: string; name: string; dept: string; email: string; phone: string;
  status: "Active" | "On Leave" | "Inactive"; joinDate: string; role: string; avatar: string;
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
  posLeft: string; posTop: string;
}
interface CallLog {
  id: string; timestamp: string; employeeName: string;
  direction: "Incoming" | "Outgoing"; duration: string; remoteNumber: string;
}
interface AudioFile {
  id: string; filename: string; employeeName: string; duration: string;
  size: string; recordedAt: string; flagged: boolean;
}
interface SyncedFile {
  id: string; filename: string; fileType: string; size: string;
  employeeName: string; syncedAt: string; category: "Document" | "Media" | "Backup" | "Image";
}

// ─── Auth Context ─────────────────────────────────────────────────────────────
interface AuthCtx {
  role: Role; setRole: (r: Role) => void;
  user: { name: string; email: string };
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
  dataLoading: boolean;
  approveLeave: (id: string) => Promise<void>;
  rejectLeave: (id: string, reason: string) => Promise<void>;
  toggleAudioFlag: (id: string, current: boolean) => Promise<void>;
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
    ...pos,
  };
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
    }));

    subs.push(onSnapshot(
      query(collection(db, "callLogs"), orderBy("timestamp", "desc"), limit(100)),
      snap => setCallLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as CallLog)))
    ));

    subs.push(onSnapshot(
      query(collection(db, "audioFiles"), orderBy("recordedAt", "desc")),
      snap => setAudioFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as AudioFile)))
    ));

    subs.push(onSnapshot(
      query(collection(db, "syncedFiles"), orderBy("syncedAt", "desc")),
      snap => setSyncedFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as SyncedFile)))
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

  return (
    <DataContext.Provider value={{ employees, attendanceLogs, leaveRequests, gpsEmployees, callLogs, audioFiles, syncedFiles, dataLoading, approveLeave, rejectLeave, toggleAudioFlag }}>
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

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";
  return (
    <div className={`${sz} ${getAvatarBg(initials)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials || "??"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Active": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    "On Leave": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    "Inactive": "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    "On-Time": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    "Late": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    "Absent": "bg-red-50 text-red-700 ring-1 ring-red-200",
    "Early Leave": "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    "Approved": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    "Rejected": "bg-red-50 text-red-700 ring-1 ring-red-200",
    "Pending": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Shared Auth Layout ───────────────────────────────────────────────────────
function AuthLayout({ children, quote }: { children: React.ReactNode; quote?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">WorkForce HR</span>
        </div>
        <div>
          <blockquote className="text-slate-300 text-2xl font-light leading-relaxed mb-6">
            {quote ?? <>"Workforce intelligence,<br />centralized and secure."</>}
          </blockquote>
          <div className="flex flex-wrap gap-3">
            {["Smart Attendance", "Live GPS", "Leave Mgmt", "Analytics"].map(tag => (
              <div key={tag} className="bg-slate-800 rounded-lg px-4 py-2">
                <span className="text-slate-300 text-xs font-medium">{tag}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-500 text-sm">© 2026 WorkForce Smart Attendance. All rights reserved.</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-slate-900">WorkForce HR</span>
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
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Welcome back</h1>
      <p className="text-slate-500 text-sm mb-8">Sign in to your admin dashboard</p>

      {error && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            placeholder="admin@yourcompany.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <Eye size={15} />
            </button>
          </div>
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {loading
            ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
            : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Don't have an account?{" "}
        <button onClick={onSignUp} className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
          Create account
        </button>
      </p>
    </AuthLayout>
  );
}

// ─── Sign Up Page ─────────────────────────────────────────────────────────────
function SignUpPage({ onLogin }: { onLogin: () => void }) {
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "",
    password: "", confirmPassword: "", role: "admin" as "admin" | "superadmin",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(fbAuth, form.email, form.password);
      await setDoc(doc(db, "admins", credential.user.uid), {
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      // onAuthStateChanged will pick up the new user and redirect to dashboard automatically
    } catch (err: any) {
      const code = err?.code ?? "";
      setError(
        code === "auth/email-already-in-use"
          ? "An account with this email already exists. Sign in instead."
          : code === "auth/weak-password"
          ? "Password is too weak. Use at least 8 characters."
          : code === "auth/invalid-email"
          ? "Please enter a valid email address."
          : "Registration failed. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center py-8">
          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Account created!</h2>
          <p className="text-slate-500 text-sm">Welcome to WorkForce HR. Redirecting you to the dashboard…</p>
          <div className="mt-6 flex justify-center">
            <div className="h-5 w-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout quote={<>"Set up your workspace<br />in under a minute."</>}>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Create admin account</h1>
      <p className="text-slate-500 text-sm mb-7">Register your organisation on WorkForce HR</p>

      {error && (
        <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name + Company */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
            <input
              value={form.name} onChange={set("name")} required autoFocus
              placeholder="John Smith"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company <span className="text-red-500">*</span></label>
            <input
              value={form.company} onChange={set("company")} required
              placeholder="Acme Corp"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email <span className="text-red-500">*</span></label>
          <input
            type="email" value={form.email} onChange={set("email")} required
            placeholder="you@company.com"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Phone + Role */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input
              type="tel" value={form.phone} onChange={set("phone")}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin role <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={form.role} onChange={set("role")}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              >
                <option value="admin">Dept. Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Role hint */}
        <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${form.role === "superadmin" ? "bg-indigo-50 border border-indigo-200 text-indigo-700" : "bg-slate-50 border border-slate-200 text-slate-500"}`}>
          <Shield size={13} className="mt-0.5 flex-shrink-0" />
          {form.role === "superadmin"
            ? "Super Admin has access to GPS tracking, file sync, and communication logs in addition to all standard features."
            : "Dept. Admin can manage employees, attendance, leave requests, and analytics."}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")} required minLength={8}
              placeholder="Minimum 8 characters"
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <Eye size={15} />
            </button>
          </div>
          {form.password.length > 0 && (
            <div className="flex gap-1 mt-2">
              {[4, 6, 8, 10].map(n => (
                <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${form.password.length >= n ? (form.password.length >= 10 ? "bg-emerald-500" : form.password.length >= 8 ? "bg-amber-400" : "bg-red-400") : "bg-slate-200"}`} />
              ))}
              <span className={`text-xs ml-1 ${form.password.length >= 10 ? "text-emerald-600" : form.password.length >= 8 ? "text-amber-600" : "text-red-500"}`}>
                {form.password.length >= 10 ? "Strong" : form.password.length >= 8 ? "Good" : "Weak"}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"} value={form.confirmPassword} onChange={set("confirmPassword")} required
              placeholder="Re-enter your password"
              className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                form.confirmPassword && form.confirmPassword !== form.password
                  ? "border-red-300 bg-red-50 focus:ring-red-500/20 focus:border-red-400"
                  : form.confirmPassword && form.confirmPassword === form.password
                  ? "border-emerald-300 bg-emerald-50 focus:ring-emerald-500/20 focus:border-emerald-400"
                  : "border-slate-200 bg-white focus:ring-indigo-500/20 focus:border-indigo-500"
              }`}
            />
            <button type="button" onClick={() => setShowConfirm(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <Eye size={15} />
            </button>
            {form.confirmPassword && (
              <div className="absolute right-9 top-1/2 -translate-y-1/2">
                {form.confirmPassword === form.password
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <XCircle size={14} className="text-red-400" />}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-1"
        >
          {loading
            ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
            : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <button onClick={onLogin} className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
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
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — Today's workforce overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map(m => (
          <Card key={m.label} className="p-5">
            <div className={`inline-flex p-2 rounded-lg ${m.color} mb-3`}><m.icon size={18} /></div>
            <div className="text-2xl font-semibold text-slate-900">{m.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{m.label}</div>
            <div className="text-xs text-slate-400 mt-1">{m.trend}</div>
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
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todayLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
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
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All Departments");
  const [selected, setSelected] = useState<Employee | null>(null);

  const filtered = useMemo(() =>
    employees.filter(e =>
      (dept === "All Departments" || e.dept === dept) &&
      (e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.id.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()))
    ), [search, dept, employees]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Employee Management</h2>
        <p className="text-sm text-slate-500 mt-0.5">{employees.length} total employees across all departments</p>
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
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={emp.avatar} size="sm" />
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
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">{employees.length === 0 ? "No employees found. Add employees via the mobile app." : "No employees match your search."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
                <Avatar initials={selected.avatar} size="lg" />
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
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
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
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
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

// ─── GPS Tracking Page ────────────────────────────────────────────────────────
function GPSTrackingPage() {
  const { gpsEmployees } = useData();
  const [selected, setSelected] = useState<GPSEmployee | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    if (gpsEmployees.length > 0 && !selected) setSelected(gpsEmployees[0]);
  }, [gpsEmployees]);

  const statusColor: Record<string, string> = { Active: "bg-emerald-500", Idle: "bg-amber-400", Offline: "bg-slate-400" };
  const gpsStatusBg: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    Idle: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    Offline: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield size={16} className="text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">System Monitoring</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Live GPS Tracking</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time employee location monitoring · {gpsEmployees.length} devices active</p>
        </div>
        <button onClick={() => setLastRefresh(new Date().toLocaleTimeString())}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

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
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">Active Devices</p>
            {gpsEmployees.map(emp => (
              <button key={emp.id} onClick={() => setSelected(emp)}
                className={`w-full text-left rounded-lg border p-4 transition-all ${selected?.id === emp.id ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
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
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File Manager Page ────────────────────────────────────────────────────────
function FileManagerPage() {
  const { syncedFiles } = useData();
  const [filter, setFilter] = useState<"All" | "Document" | "Media" | "Backup" | "Image">("All");
  const categories = ["All", "Document", "Media", "Backup", "Image"] as const;
  const filtered = filter === "All" ? syncedFiles : syncedFiles.filter(f => f.category === filter);

  const typeColor: Record<string, string> = {
    PDF: "bg-red-100 text-red-700", DOCX: "bg-blue-100 text-blue-700",
    XLSX: "bg-emerald-100 text-emerald-700", ZIP: "bg-amber-100 text-amber-700",
    MP4: "bg-purple-100 text-purple-700", JPG: "bg-pink-100 text-pink-700",
    FIG: "bg-indigo-100 text-indigo-700",
  };
  const categoryIcon: Record<string, React.ReactNode> = {
    Document: <FileText size={20} className="text-slate-500" />,
    Media: <Play size={20} className="text-slate-500" />,
    Backup: <Archive size={20} className="text-slate-500" />,
    Image: <Eye size={20} className="text-slate-500" />,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Shield size={16} className="text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">System Monitoring</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Device File Sync Manager</h2>
        <p className="text-sm text-slate-500 mt-0.5">{syncedFiles.length} synced items</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["Document", "Media", "Backup", "Image"] as const).map(cat => (
          <Card key={cat} className="p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50"><FolderOpen size={16} className="text-slate-500" /></div>
            <div>
              <div className="text-xl font-semibold text-slate-900">{syncedFiles.filter(f => f.category === cat).length}</div>
              <div className="text-xs text-slate-500">{cat}s</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === cat ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No files synced yet</p>
          <p className="text-sm text-slate-400 mt-1">Files will appear here once devices sync data via the mobile app.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(file => (
            <Card key={file.id} className="p-4 hover:shadow-md transition-shadow cursor-default group">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-slate-50 rounded-lg">{categoryIcon[file.category]}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeColor[file.fileType] ?? "bg-slate-100 text-slate-600"}`}>{file.fileType}</span>
              </div>
              <p className="text-sm font-medium text-slate-900 truncate mb-1" title={file.filename}>{file.filename}</p>
              <p className="text-xs text-slate-400 mb-3">{file.size}</p>
              <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600">{file.employeeName}</p>
                  <p className="text-xs text-slate-400">{file.syncedAt}</p>
                </div>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"><Download size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Comm Sync Page ───────────────────────────────────────────────────────────
function CommSyncPage() {
  const { callLogs, audioFiles, toggleAudioFlag } = useData();
  const [tab, setTab] = useState<"calls" | "audio">("calls");
  const [playing, setPlaying] = useState<string | null>(null);

  const flagged = audioFiles.filter(f => f.flagged).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Shield size={16} className="text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">System Monitoring</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Communication Sync Logs</h2>
        <p className="text-sm text-slate-500 mt-0.5">Call metadata and audio recordings from enrolled devices</p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button onClick={() => setTab("calls")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "calls" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Phone size={13} /> Call Logs
        </button>
        <button onClick={() => setTab("audio")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "audio" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Mic size={13} /> Audio Recordings
          {flagged > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{flagged}</span>}
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
              <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"><Download size={12} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Timestamp", "Employee", "Direction", "Duration", "Remote Number"].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {callLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3 text-xs font-mono text-slate-500">{log.timestamp}</td>
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
            <p className="text-sm text-slate-400 mt-1">Recordings will appear here once the mobile app syncs data.</p>
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
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{audioFiles.length} recordings</span>
                <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"><Download size={12} /> Export All</button>
              </div>
              <div className="divide-y divide-slate-50">
                {audioFiles.map(file => {
                  const isPlaying = playing === file.id;
                  return (
                    <div key={file.id} className={`px-6 py-4 flex items-center gap-4 transition-colors ${file.flagged ? "bg-red-50/40" : "hover:bg-slate-50/70"}`}>
                      <button onClick={() => setPlaying(p => p === file.id ? null : file.id)}
                        className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isPlaying ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <div className="flex items-center gap-0.5 h-8 flex-shrink-0">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const h = [3, 5, 7, 4, 8, 6, 9, 5, 4, 7, 8, 6, 5, 9, 7, 4, 6, 8, 5, 3, 7, 6, 4, 5][i];
                          return <div key={i} className={`w-1 rounded-sm transition-colors ${isPlaying ? "bg-indigo-500" : "bg-slate-300"}`} style={{ height: `${h * 10}%` }} />;
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{file.filename}</p>
                          {file.flagged && <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium"><Flag size={9} /> Flagged</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                          <span>{file.employeeName}</span>
                          <span>{file.duration}</span>
                          <span>{file.size}</span>
                          <span className="font-mono">{file.recordedAt}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleAudioFlag(file.id, file.flagged)} title={file.flagged ? "Unflag" : "Flag"}
                          className={`p-1.5 rounded-lg transition-colors ${file.flagged ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
                          <Flag size={13} />
                        </button>
                        <button className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"><Download size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
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
const NAV_ITEMS = [
  { page: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { page: "employees" as Page, label: "Employees", icon: Users },
  { page: "attendance" as Page, label: "Attendance", icon: Clock },
  { page: "leave" as Page, label: "Leave", icon: CalendarDays },
  { page: "analytics" as Page, label: "Analytics", icon: BarChart3 },
];
const SUPER_ADMIN_ITEMS = [
  { page: "gps" as Page, label: "GPS Tracking", icon: MapPin },
  { page: "filemanager" as Page, label: "File Sync", icon: FolderOpen },
  { page: "commsync" as Page, label: "Comm Sync", icon: Phone },
];

function Sidebar({ currentPage, setCurrentPage, setSidebarOpen }: {
  currentPage: Page; setCurrentPage: (p: Page) => void; setSidebarOpen: (v: boolean) => void;
}) {
  const { role, user, setRole } = useAuth();

  const handleNav = (page: Page) => { setCurrentPage(page); setSidebarOpen(false); };
  const handleLogout = async () => { await fbSignOut(fbAuth); };

  return (
    <div className="h-full flex flex-col bg-slate-900 w-64 flex-shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0"><Building2 size={16} className="text-white" /></div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">WorkForce HR</p>
          <p className="text-slate-500 text-xs">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = currentPage === item.page;
          return (
            <button key={item.page} onClick={() => handleNav(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
              <item.icon size={16} /> {item.label}
            </button>
          );
        })}
        {role === "superadmin" && (
          <div className="pt-4">
            <div className="flex items-center gap-2 px-3 mb-2">
              <Shield size={11} className="text-indigo-400" />
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">System Monitoring</p>
            </div>
            {SUPER_ADMIN_ITEMS.map(item => {
              const active = currentPage === item.page;
              return (
                <button key={item.page} onClick={() => handleNav(item.page)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                  <item.icon size={16} /> {item.label}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/5 space-y-2">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="h-7 w-7 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{makeAvatar(user?.name || "Admin")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.name || "Admin"}</p>
            <p className="text-xs text-slate-500 truncate">{role === "superadmin" ? "Super Admin" : "Dept. Admin"}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
const PAGE_LABELS: Record<Page, string> = {
  dashboard: "Dashboard", employees: "Employees", attendance: "Attendance Logs",
  leave: "Leave Management", analytics: "Analytics", gps: "GPS Tracking",
  filemanager: "File Sync Manager", commsync: "Comm Sync Logs",
};

function Header({ currentPage, setSidebarOpen }: { currentPage: Page; setSidebarOpen: (v: boolean) => void }) {
  const { role, setRole, user } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><Menu size={18} /></button>
        <h1 className="text-sm font-semibold text-slate-900">{PAGE_LABELS[currentPage]}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setRoleMenuOpen(p => !p)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors">
            <Shield size={12} className={role === "superadmin" ? "text-indigo-600" : "text-slate-400"} />
            <span>{role === "superadmin" ? "Super Admin" : "Dept. Admin"}</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>
          {roleMenuOpen && (
            <div className="absolute right-0 top-9 bg-white rounded-lg border border-slate-200 shadow-lg py-1 w-44 z-20">
              <div className="px-3 py-1.5 text-xs text-slate-400 font-medium">Switch view</div>
              {(["admin", "superadmin"] as Role[]).map(r => (
                <button key={r} onClick={() => { setRole(r); setRoleMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${role === r ? "text-indigo-600 bg-indigo-50 font-medium" : "text-slate-700 hover:bg-slate-50"}`}>
                  <Shield size={11} />
                  {r === "superadmin" ? "Super Admin" : "Department Admin"}
                  {role === r && <CheckCircle2 size={11} className="ml-auto text-indigo-600" />}
                </button>
              ))}
            </div>
          )}
          {roleMenuOpen && <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />}
        </div>
        <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-indigo-600 rounded-full" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
          <div className="h-7 w-7 bg-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-semibold">{makeAvatar(user?.name || "A")}</span>
          </div>
          <span className="text-xs font-medium text-slate-700 hidden sm:block">{user?.name || "Admin"}</span>
        </div>
      </div>
    </header>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const SUPER_ONLY: Page[] = ["gps", "filemanager", "commsync"];

function AppShell({ role, setRole, userProfile }: { role: Role; setRole: (r: Role) => void; userProfile: { name: string; email: string } }) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSetRole = (r: Role) => {
    setRole(r);
    if (r === "admin" && SUPER_ONLY.includes(currentPage)) setCurrentPage("dashboard");
  };

  const renderPage = () => {
    if (SUPER_ONLY.includes(currentPage) && role !== "superadmin") return <AccessDeniedPage />;
    switch (currentPage) {
      case "dashboard": return <DashboardPage />;
      case "employees": return <EmployeesPage />;
      case "attendance": return <AttendancePage />;
      case "leave": return <LeavePage />;
      case "analytics": return <AnalyticsPage />;
      case "gps": return <GPSTrackingPage />;
      case "filemanager": return <FileManagerPage />;
      case "commsync": return <CommSyncPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AuthContext.Provider value={{ role, setRole: handleSetRole, user: userProfile }}>
      <DataProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50">
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
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>("admin");
  const [userProfile, setUserProfile] = useState({ name: "", email: "" });

  useEffect(() => {
    return onAuthStateChanged(fbAuth, async (fbUser) => {
      if (fbUser) {
        // Try to fetch admin role from Firestore
        try {
          const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
          if (adminDoc.exists()) {
            setRole((adminDoc.data().role as Role) || "admin");
            setUserProfile({ name: adminDoc.data().name || fbUser.displayName || fbUser.email || "Admin", email: fbUser.email || "" });
          } else {
            setUserProfile({ name: fbUser.displayName || fbUser.email || "Admin", email: fbUser.email || "" });
          }
        } catch {
          setUserProfile({ name: fbUser.displayName || fbUser.email || "Admin", email: fbUser.email || "" });
        }
        setFirebaseUser(fbUser);
      } else {
        setFirebaseUser(null);
      }
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading...</p>
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
