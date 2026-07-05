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
  Users, Plus, Search, Trash2, X, Shield, Building2, Eye, EyeOff,
  CheckCircle2, AlertCircle, Copy, Check, GitBranch, Mail,
} from "lucide-react";

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
interface BranchAdmin {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "superadmin" | "branch_admin";
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  status: string;
  createdAt: any;
}

interface Company {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  company: string; // company name string in Firestore
}

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
  branch_admin: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  branch_admin: "Branch Admin",
};

function makeAvatar(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

const avatarBgMap: Record<string, string> = {};
const BG_COLORS = [
  "bg-indigo-600", "bg-sky-600", "bg-violet-600", "bg-emerald-600",
  "bg-pink-600", "bg-amber-600", "bg-teal-600", "bg-orange-600",
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
    <div className={`h-9 w-9 ${getAvatarBg(initials)} rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {initials || "??"}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
        copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
      title={`Copy ${label ?? ""}`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<BranchAdmin[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ name: string; email: string; password: string; branch: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyId: "",
    branchId: "",
    password: "",
  });

  // Real-time Firestore
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
            role: d.data().role === "branch_admin" || d.data().role === "admin" ? "branch_admin" : d.data().role || "branch_admin",
            companyId: d.data().companyId || "",
            companyName: d.data().companyName || d.data().company || "",
            branchId: d.data().branchId || "",
            branchName: d.data().branchName || "",
            status: d.data().status || "Active",
            createdAt: d.data().createdAt,
          }))
        );
      })
    );
    subs.push(
      onSnapshot(collection(db, "companies"), (snap) => {
        setCompanies(snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || d.id })));
      })
    );
    subs.push(
      onSnapshot(collection(db, "branches"), (snap) => {
        setBranches(snap.docs.map((d) => ({ id: d.id, name: d.data().name || "", company: d.data().company || "" })));
      })
    );
    return () => subs.forEach((u) => u());
  }, []);

  const stats = useMemo(() => ({
    superAdmins: admins.filter((a) => a.role === "superadmin").length,
    branchAdmins: admins.filter((a) => a.role === "branch_admin").length,
  }), [admins]);

  // Company name for selected companyId
  const selectedCompanyName = useMemo(
    () => companies.find((c) => c.id === form.companyId)?.name || "",
    [companies, form.companyId]
  );

  // Branches filtered by selected company
  const filteredBranchOptions = useMemo(
    () => branches.filter((b) => !form.companyId || b.company === selectedCompanyName),
    [branches, form.companyId, selectedCompanyName]
  );

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === form.branchId)?.name || "",
    [branches, form.branchId]
  );

  const filtered = useMemo(() => {
    let list = admins.filter((a) => a.role !== "superadmin" ? true : true); // show all including super
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.branchName || "").toLowerCase().includes(q) ||
          (a.companyName || "").toLowerCase().includes(q)
      );
    }
    if (filterCompany) {
      list = list.filter((a) => a.companyId === filterCompany);
    }
    return list;
  }, [admins, search, filterCompany]);

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", companyId: "", branchId: "", password: "" });
    setCreateError("");
    setCreateSuccess(false);
    setCreatedCreds(null);
    setShowPass(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const uid = await createFirebaseUser(form.email, form.password);
      const company = companies.find((c) => c.id === form.companyId);
      const branch = branches.find((b) => b.id === form.branchId);
      await setDoc(doc(db, "admins", uid), {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: "branch_admin",
        companyId: form.companyId,
        companyName: company?.name || "",
        branchId: form.branchId,
        branchName: branch?.name || "",
        status: "Active",
        createdAt: serverTimestamp(),
      });
      setCreatedCreds({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        branch: branch?.name || "",
      });
      setCreateSuccess(true);
    } catch (err: any) {
      const code = err?.code ?? "";
      setCreateError(
        code === "auth/email-already-in-use"
          ? "An account with this email already exists."
          : code === "auth/weak-password"
          ? "Password must be at least 6 characters."
          : err?.message || "Failed to create account. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: BranchAdmin) => {
    if (!window.confirm(`Remove branch admin "${admin.name}"? This removes them from the system (Firebase Auth account remains).`)) return;
    setDeleting(admin.id);
    try {
      await deleteDoc(doc(db, "admins", admin.id));
    } finally {
      setDeleting(null);
    }
  };

  const copyAllCredentials = () => {
    if (!createdCreds) return;
    const text = `Branch Admin Credentials\n\nName: ${createdCreds.name}\nBranch: ${createdCreds.branch}\nEmail: ${createdCreds.email}\nPassword: ${createdCreds.password}\n\nLogin at the admin panel with these credentials.`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Branch Admin Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage branch admin accounts — super admin only
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-sm font-bold transition-all shadow-sm shadow-indigo-900/20"
        >
          <Plus size={15} /> Add Branch Admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Super Admins", value: stats.superAdmins, icon: Shield, color: "text-indigo-600 bg-indigo-50", ring: "ring-indigo-100" },
          { label: "Branch Admins", value: stats.branchAdmins, icon: GitBranch, color: "text-sky-600 bg-sky-50", ring: "ring-sky-100" },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 ring-1 ${s.ring}`}>
            <div className={`inline-flex p-2.5 rounded-xl ${s.color} mb-3`}>
              <s.icon size={18} />
            </div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">{s.value}</div>
            <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or branch…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Branch Admin", "Email", "Role", "Company / Branch", "Phone", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={makeAvatar(admin.name)} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{admin.name}</p>
                        {admin.branchName && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <GitBranch size={10} /> {admin.branchName}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-slate-600 flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-400 flex-shrink-0" />
                      {admin.email}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[admin.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {ROLE_LABEL[admin.role] ?? admin.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{admin.companyName || "—"}</p>
                      {admin.branchName && (
                        <p className="text-xs text-slate-400">{admin.branchName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{admin.phone || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      admin.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${admin.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {admin.role !== "superadmin" && (
                      <button
                        onClick={() => handleDelete(admin)}
                        disabled={deleting === admin.id}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        title="Remove branch admin"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <GitBranch size={28} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">
                      {admins.length === 0
                        ? "No branch admins yet. Click 'Add Branch Admin' to create one."
                        : "No results match your search."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-md"
            onClick={() => { setShowCreate(false); resetForm(); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200/60 z-10 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <GitBranch size={15} className="text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {createSuccess ? "Account Created" : "New Branch Admin"}
                </h3>
              </div>
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-6 py-5">
              {createSuccess && createdCreds ? (
                /* ── Success + Credentials ── */
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center py-2">
                    <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                      <CheckCircle2 size={28} className="text-emerald-500" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">
                      Branch Admin Created!
                    </h4>
                    <p className="text-sm text-slate-500">
                      Share these credentials securely with <span className="font-semibold text-slate-700">{createdCreds.name}</span>.
                    </p>
                  </div>

                  {/* Credentials card */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Credentials</span>
                      <button
                        onClick={copyAllCredentials}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
                      >
                        <Copy size={11} /> Copy All
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Name</p>
                          <p className="text-sm font-semibold text-slate-900">{createdCreds.name}</p>
                        </div>
                        <CopyButton text={createdCreds.name} label="name" />
                      </div>

                      {createdCreds.branch && (
                        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Branch</p>
                            <p className="text-sm font-semibold text-slate-900">{createdCreds.branch}</p>
                          </div>
                          <CopyButton text={createdCreds.branch} label="branch" />
                        </div>
                      )}

                      <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Email (Login)</p>
                          <p className="text-sm font-semibold text-slate-900">{createdCreds.email}</p>
                        </div>
                        <CopyButton text={createdCreds.email} label="email" />
                      </div>

                      <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-slate-200">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Password</p>
                          <p className="text-sm font-mono font-bold text-slate-900">{createdCreds.password}</p>
                        </div>
                        <CopyButton text={createdCreds.password} label="password" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Save or share these credentials now — passwords cannot be retrieved later.
                      The branch admin should change their password on first login.
                    </p>
                  </div>

                  <button
                    onClick={() => { setShowCreate(false); resetForm(); }}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* ── Create Form ── */
                <form onSubmit={handleCreate} className="space-y-4">
                  {createError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle size={13} className="text-red-600 flex-shrink-0" />
                      <p className="text-xs text-red-700">{createError}</p>
                    </div>
                  )}

                  <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200 flex items-start gap-2.5">
                    <Shield size={13} className="text-sky-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-sky-700 font-medium">
                      Branch Admins can manage employees, attendance, leave and analytics for their assigned branch only.
                    </p>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      autoFocus
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Ravi Kumar"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Gmail / Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Gmail / Work Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="admin@gmail.com or work@company.com"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">This email will be used to log in to the admin panel.</p>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Company */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        required
                        value={form.companyId}
                        onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value, branchId: "" }))}
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      >
                        <option value="">Select company…</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>

                  {/* Branch — only show when company selected */}
                  {form.companyId && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Branch <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <GitBranch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          required
                          value={form.branchId}
                          onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                          className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                        >
                          <option value="">Select branch…</option>
                          {filteredBranchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                      {filteredBranchOptions.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                          <AlertCircle size={11} /> No branches for this company. Add branches first.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
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
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">You will be able to copy and share this after creation.</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowCreate(false); resetForm(); }}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-70 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating…
                        </>
                      ) : (
                        "Create Branch Admin"
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
