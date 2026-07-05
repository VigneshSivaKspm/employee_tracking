import React, { useState, useEffect, useMemo } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  Users,
  Plus,
  Search,
  Trash2,
  X,
  Shield,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ─── Firebase Config (secondary app — keeps current session alive) ─────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCYTV15D-fAxQ8Xf25fEjv0VGCHB8jbFmo",
  authDomain: "niklaus-sms.firebaseapp.com",
  projectId: "niklaus-sms",
  storageBucket: "niklaus-sms.firebasestorage.app",
  messagingSenderId: "960099181513",
  appId: "1:960099181513:web:6e10699f60c1bf66797e18",
};

async function createFirebaseUser(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(FIREBASE_CONFIG, `admin_create_${Date.now()}`);
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "superadmin" | "company_admin" | "admin";
  companyId: string;
  companyName: string;
  status: string;
  createdAt: any;
}

interface Company {
  id: string;
  name: string;
}

const ROLE_OPTIONS = [
  {
    value: "company_admin",
    label: "Company Admin",
    desc: "Manages a specific company and its branches",
  },
  {
    value: "admin",
    label: "Dept. Admin",
    desc: "Manages employees, attendance, and leave",
  },
] as const;

type CreatableRole = "company_admin" | "admin";

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
  company_admin: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  admin: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  company_admin: "Company Admin",
  admin: "Dept. Admin",
};

function makeAvatar(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

const avatarBgMap: Record<string, string> = {};
const BG_COLORS = [
  "bg-indigo-600", "bg-violet-600", "bg-sky-600", "bg-pink-600",
  "bg-amber-600", "bg-emerald-600", "bg-orange-600", "bg-teal-600",
];
let bgIdx = 0;
function getAvatarBg(initials: string): string {
  if (!avatarBgMap[initials]) {
    avatarBgMap[initials] = BG_COLORS[bgIdx % BG_COLORS.length];
    bgIdx++;
  }
  return avatarBgMap[initials];
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div
      className={`h-9 w-9 ${getAvatarBg(initials)} rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}
    >
      {initials || "??"}
    </div>
  );
}

// ─── AdminUsersPage ───────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "company_admin" as CreatableRole,
    companyId: "",
    password: "",
  });

  // Real-time Firestore subscriptions
  useEffect(() => {
    const subs: (() => void)[] = [];

    subs.push(
      onSnapshot(collection(db, "admins"), (snap) => {
        setAdmins(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || "",
            email: d.data().email || "",
            phone: d.data().phone || "",
            role: d.data().role || "admin",
            companyId: d.data().companyId || "",
            companyName: d.data().companyName || d.data().company || "",
            status: d.data().status || "Active",
            createdAt: d.data().createdAt,
          }))
        );
      })
    );

    subs.push(
      onSnapshot(collection(db, "companies"), (snap) => {
        setCompanies(
          snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || d.id }))
        );
      })
    );

    return () => subs.forEach((u) => u());
  }, []);

  // Stats
  const stats = useMemo(() => ({
    superAdmins: admins.filter((a) => a.role === "superadmin").length,
    companyAdmins: admins.filter((a) => a.role === "company_admin").length,
    deptAdmins: admins.filter((a) => a.role === "admin").length,
  }), [admins]);

  const filtered = useMemo(() =>
    admins.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        (a.companyName || "").toLowerCase().includes(search.toLowerCase())
    ),
    [admins, search]
  );

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", role: "company_admin", companyId: "", password: "" });
    setCreateError("");
    setCreateSuccess(false);
    setShowPass(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const uid = await createFirebaseUser(form.email, form.password);
      const selectedCompany = companies.find((c) => c.id === form.companyId);
      await setDoc(doc(db, "admins", uid), {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        companyId: form.companyId,
        companyName: selectedCompany?.name || "",
        status: "Active",
        createdAt: serverTimestamp(),
      });
      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreate(false);
        resetForm();
      }, 2500);
    } catch (err: any) {
      const code = err?.code ?? "";
      setCreateError(
        code === "auth/email-already-in-use"
          ? "An account with this email already exists."
          : code === "auth/weak-password"
          ? "Password is too weak. Use at least 6 characters."
          : err?.message || "Failed to create admin. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: AdminUser) => {
    if (!window.confirm(`Delete admin "${admin.name}"? This only removes them from Firestore — their Firebase Auth account remains.`)) return;
    setDeleting(admin.id);
    try {
      await deleteDoc(doc(db, "admins", admin.id));
    } finally {
      setDeleting(null);
    }
  };

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === form.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Admin User Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage company admin accounts
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} /> Add Admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Super Admins", value: stats.superAdmins, icon: Shield, color: "text-indigo-600 bg-indigo-50" },
          { label: "Company Admins", value: stats.companyAdmins, icon: Building2, color: "text-violet-600 bg-violet-50" },
          { label: "Dept. Admins", value: stats.deptAdmins, icon: Users, color: "text-sky-600 bg-sky-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className={`inline-flex p-2 rounded-lg ${s.color} mb-3`}>
              <s.icon size={18} />
            </div>
            <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or company…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Admin", "Email", "Role", "Company", "Phone", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={makeAvatar(admin.name)} />
                      <span className="text-sm font-medium text-slate-900">{admin.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-600">{admin.email}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[admin.role] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {ROLE_LABEL[admin.role] ?? admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-600">{admin.companyName || "—"}</td>
                  <td className="px-6 py-3.5 text-sm text-slate-500">{admin.phone || "—"}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        admin.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    {admin.role !== "superadmin" && (
                      <button
                        onClick={() => handleDelete(admin)}
                        disabled={deleting === admin.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete admin"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                    {admins.length === 0
                      ? "No admin accounts yet. Click 'Add Admin' to create one."
                      : "No admins match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setShowCreate(false); resetForm(); }}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-base font-semibold text-slate-900">Add Admin Account</h3>
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-4">
              {createSuccess ? (
                <div className="py-8 text-center">
                  <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mb-1">Admin Created!</h4>
                  <p className="text-sm text-slate-500">
                    The admin account has been set up successfully.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4">
                  {createError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle size={13} className="text-red-600 flex-shrink-0" />
                      <p className="text-xs text-red-700">{createError}</p>
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="jane@company.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {ROLE_OPTIONS.map((r) => (
                        <label
                          key={r.value}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            form.role === r.value
                              ? "border-indigo-300 bg-indigo-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={r.value}
                            checked={form.role === r.value}
                            onChange={() => setForm((p) => ({ ...p, role: r.value }))}
                            className="mt-0.5 accent-indigo-600"
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{r.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Company Assignment */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Company Assignment
                      {form.role === "company_admin" && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <div className="relative">
                      <select
                        required={form.role === "company_admin"}
                        value={form.companyId}
                        onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="">Select company (optional for dept. admin)</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>

                  {/* Role hint */}
                  {selectedRole && (
                    <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700">
                      <Shield size={12} className="mt-0.5 flex-shrink-0" />
                      <span>{selectedRole.desc}</span>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Initial Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        required
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Min. 6 characters"
                        minLength={6}
                        className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowCreate(false); resetForm(); }}
                      className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Admin"
                      )}
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
