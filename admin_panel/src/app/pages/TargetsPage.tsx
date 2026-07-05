import React, { useState, useEffect, useRef } from "react";
import { Target, Plus, Search, X, CheckCircle2, Clock, TrendingUp, Award, ChevronDown, User, ListTodo, MessageSquare, Send } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, arrayUnion, getDoc } from "firebase/firestore";
import { db, fbAuth } from "../../firebase";

interface TargetComment {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  role?: "employee" | "admin";
  createdAt: string;
}

interface EmployeeOption {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  branchName: string;
  designation: string;
}

interface EmployeeTarget {
  id: string;
  employeeName: string;
  employeeId: string;
  userId?: string;
  department: string;
  branch: string;
  title: string;
  description: string;
  type?: "task" | "multiple";
  targetValue: number;
  achievedValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Completed" | "Overdue" | "Draft";
  comments?: TargetComment[];
  createdAt?: any;
}

function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function sortComments(comments: TargetComment[] = []): TargetComment[] {
  return [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function isAdminComment(c: TargetComment): boolean {
  return c.role === "admin";
}

function isSentByAdmin(c: TargetComment, adminId: string): boolean {
  if (c.role === "admin") return true;
  if (c.role === "employee") return false;
  return Boolean(adminId && c.authorId === adminId);
}

// ─── Comments thread modal ────────────────────────────────────────────────────
function CommentsModal({
  target,
  adminName,
  adminId,
  onClose,
}: {
  target: EmployeeTarget;
  adminName: string;
  adminId: string;
  onClose: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const comments = sortComments(target.comments);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [comments.length]);

  async function sendReply() {
    const text = reply.trim();
    if (!text || !adminId) return;
    setSending(true);
    try {
      const comment: TargetComment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        authorName: adminName,
        authorId: adminId,
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "targets", target.id), {
        comments: arrayUnion(comment),
        updatedAt: serverTimestamp(),
      });
      setReply("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-600 flex-shrink-0" />
              <h2 className="text-base font-semibold text-slate-900 truncate">{target.title}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {target.employeeName} · {comments.length} message{comments.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/80 min-h-[200px]">
          {comments.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No messages yet</p>
              <p className="text-xs text-slate-400 mt-1">Start the conversation with your employee.</p>
            </div>
          ) : (
            comments.map(c => {
              const sent = isSentByAdmin(c, adminId);
              return (
                <div key={c.id} className={`flex ${sent ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                      sent
                        ? "bg-indigo-600 text-white rounded-br-md"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold mb-1 ${sent ? "text-indigo-100" : "text-indigo-600"}`}>
                      {c.authorName}
                      {sent ? " · You" : " · Employee"}
                      <span className={`font-normal ml-1.5 ${sent ? "text-indigo-200" : "text-slate-400"}`}>
                        · {formatCommentTime(c.createdAt)}
                      </span>
                    </p>
                    <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${sent ? "text-white" : "text-slate-700"}`}>
                      {c.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-white rounded-b-2xl">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write a reply to the employee…"
              rows={2}
              maxLength={600}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendReply();
                }
              }}
            />
            <button
              onClick={sendReply}
              disabled={!reply.trim() || sending || !adminId}
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM: Omit<EmployeeTarget, "id"> = {
  employeeName: "", employeeId: "", userId: "", department: "", branch: "",
  title: "", description: "", type: "task", targetValue: 0, achievedValue: 0, unit: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  status: "Active",
};

function resolveTargetType(t: EmployeeTarget): "task" | "multiple" {
  if (t.type === "task" || t.type === "multiple") return t.type;
  return t.targetValue > 0 || t.unit ? "multiple" : "task";
}

// ─── Searchable Employee Picker ───────────────────────────────────────────────
function EmployeePicker({
  employees,
  selected,
  onSelect,
}: {
  employees: EmployeeOption[];
  selected: EmployeeOption | null;
  onSelect: (emp: EmployeeOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = employees.filter(e =>
    !q ||
    e.name.toLowerCase().includes(q.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(q.toLowerCase()) ||
    e.department.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="relative col-span-2">
      <label className="text-xs font-medium text-slate-600 mb-1 block">
        Employee <span className="text-red-500">*</span>
      </label>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-left"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <User size={13} className="text-indigo-500 flex-shrink-0" />
            <span className="font-medium text-slate-900">{selected.name}</span>
            <span className="text-slate-400 text-xs">· {selected.employeeId} · {selected.department}</span>
          </span>
        ) : (
          <span className="text-slate-400">Search and select employee…</span>
        )}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by name, ID or department…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">No employees found</p>
            ) : filtered.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => { onSelect(emp); setOpen(false); setQ(""); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-indigo-50 transition-colors ${selected?.id === emp.id ? "bg-indigo-50" : ""}`}
              >
                <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 text-xs font-bold">
                  {emp.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{emp.name}</p>
                  <p className="text-xs text-slate-500 truncate">{emp.employeeId} · {emp.department} · {emp.branchName || "—"}</p>
                </div>
                {selected?.id === emp.id && <CheckCircle2 size={14} className="text-indigo-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TargetsPage() {
  const [targets, setTargets] = useState<EmployeeTarget[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeTarget | null>(null);
  const [form, setForm] = useState<Omit<EmployeeTarget, "id">>({ ...EMPTY_FORM });
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [isTask, setIsTask] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commentsTargetId, setCommentsTargetId] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState({ name: "Admin", id: "" });

  useEffect(() => {
    const unsub = onAuthStateChanged(fbAuth, async u => {
      if (!u) {
        setAdminInfo({ name: "Admin", id: "" });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "admins", u.uid));
        setAdminInfo({
          name: snap.data()?.name || u.email?.split("@")[0] || "Admin",
          id: u.uid,
        });
      } catch {
        setAdminInfo({ name: u.email?.split("@")[0] || "Admin", id: u.uid });
      }
    });
    return unsub;
  }, []);

  const commentsTarget = commentsTargetId ? targets.find(t => t.id === commentsTargetId) ?? null : null;

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, "targets"), orderBy("endDate", "asc")),
      snap => setTargets(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeTarget)))
    );
    const u2 = onSnapshot(collection(db, "employees"), snap => {
      setEmployees(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || "",
        employeeId: d.data().employeeId || "",
        department: d.data().department || "",
        branchName: d.data().branchName || "",
        designation: d.data().designation || "",
      })));
    });
    return () => { u1(); u2(); };
  }, []);

  const patchedTargetIds = useRef(new Set<string>());
  useEffect(() => {
    if (!employees.length || !targets.length) return;
    targets.forEach(t => {
      if (t.userId || patchedTargetIds.current.has(t.id)) return;
      const emp = employees.find(
        e =>
          (t.employeeId && e.employeeId && e.employeeId.toUpperCase() === t.employeeId.toUpperCase()) ||
          (t.employeeName && e.name && e.name.toLowerCase() === t.employeeName.toLowerCase() && t.department === e.department),
      );
      if (!emp) return;
      patchedTargetIds.current.add(t.id);
      updateDoc(doc(db, "targets", t.id), {
        userId: emp.id,
        employeeId: (emp.employeeId || t.employeeId || "").trim().toUpperCase(),
        employeeName: emp.name || t.employeeName,
      }).catch(() => patchedTargetIds.current.delete(t.id));
    });
  }, [employees, targets]);

  const depts = ["All", ...Array.from(new Set(targets.map(t => t.department).filter(Boolean)))];
  const filtered = targets.filter(t => {
    if (deptFilter !== "All" && t.department !== deptFilter) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (search && !t.employeeName.toLowerCase().includes(search.toLowerCase()) &&
        !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: targets.length,
    active: targets.filter(t => t.status === "Active").length,
    completed: targets.filter(t => t.status === "Completed").length,
    overdue: targets.filter(t => t.status === "Overdue").length,
  };

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSelectedEmployee(null);
    setIsTask(true);
    setShowForm(true);
  }
  function openEdit(t: EmployeeTarget) {
    setEditTarget(t);
    const type = resolveTargetType(t);
    setForm({ ...t, type, unit: "" });
    const emp = employees.find(
      e =>
        e.id === t.userId ||
        e.employeeId === t.employeeId ||
        (e.employeeId && t.employeeId && e.employeeId.toUpperCase() === t.employeeId.toUpperCase()),
    );
    setSelectedEmployee(emp || null);
    setIsTask(type === "task");
    setShowForm(true);
  }

  function handleSelectEmployee(emp: EmployeeOption) {
    setSelectedEmployee(emp);
    setForm(p => ({
      ...p,
      employeeName: emp.name,
      employeeId: (emp.employeeId || "").trim().toUpperCase(),
      userId: emp.id,
      department: emp.department,
      branch: emp.branchName,
    }));
  }

  async function handleSave() {
    if (!selectedEmployee && !editTarget) return;
    if (!form.title.trim()) return;
    if (!isTask && form.targetValue < 1) return;
    setSaving(true);
    try {
      const emp = selectedEmployee ?? employees.find(e => e.employeeId === editTarget?.employeeId || e.id === editTarget?.userId);
      const { comments: _drop, ...formFields } = form as Omit<EmployeeTarget, "id"> & { comments?: TargetComment[] };
      const payload = {
        ...formFields,
        type: isTask ? "task" as const : "multiple" as const,
        unit: "",
        targetValue: isTask ? 0 : form.targetValue,
        achievedValue: isTask ? 0 : (editTarget?.achievedValue ?? form.achievedValue ?? 0),
        userId: emp?.id ?? form.userId ?? editTarget?.userId ?? "",
        employeeId: (form.employeeId || emp?.employeeId || "").trim().toUpperCase(),
        employeeName: form.employeeName || emp?.name || "",
        updatedAt: serverTimestamp(),
      };
      if (editTarget) {
        await updateDoc(doc(db, "targets", editTarget.id), payload);
      } else {
        await addDoc(collection(db, "targets"), { ...payload, createdAt: serverTimestamp() });
      }
      setShowForm(false);
    } finally { setSaving(false); }
  }

  const statusColors: Record<string, string> = {
    Active: "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
    Overdue: "bg-red-100 text-red-600",
    Draft: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Targets", value: stats.total, icon: Target, color: "indigo" },
          { label: "Active", value: stats.active, icon: TrendingUp, color: "blue" },
          { label: "Completed", value: stats.completed, icon: Award, color: "green" },
          { label: "Overdue", value: stats.overdue, icon: Clock, color: "red" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`h-9 w-9 rounded-lg bg-${color}-50 flex items-center justify-center mb-3`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
            </div>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {depts.map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {["All","Active","Completed","Overdue","Draft"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> Set Target
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No targets found.</div>
          )}
          {filtered.map(t => {
            const type = resolveTargetType(t);
            const pct = type === "multiple" && t.targetValue > 0
              ? Math.min(100, Math.round((t.achievedValue / t.targetValue) * 100))
              : t.status === "Completed" ? 100 : 0;
            return (
              <div key={t.id} className="px-4 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm">{t.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status]}`}>{t.status}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${type === "task" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>
                        {type === "task" ? "Task" : "Multiple"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{t.employeeName} · {t.department} · {t.branch}</p>
                    {type === "multiple" ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-orange-400"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {t.achievedValue} / {t.targetValue} ({pct}%)
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">{t.description || "Simple task — mark complete when done."}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{t.startDate} → {t.endDate}</p>
                    {(t.comments?.length ?? 0) > 0 && (() => {
                      const latest = sortComments(t.comments)[t.comments!.length - 1];
                      return (
                        <button
                          type="button"
                          onClick={() => setCommentsTargetId(t.id)}
                          className="mt-2 w-full text-left rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 hover:bg-indigo-50 transition-colors"
                        >
                          <p className="text-[11px] font-semibold text-indigo-600 mb-0.5">
                            {t.comments!.length} message{t.comments!.length !== 1 ? "s" : ""}
                            {latest && (
                              <span className="font-normal text-slate-400 ml-1">
                                · latest {isAdminComment(latest) ? "from you" : "from employee"}
                              </span>
                            )}
                          </p>
                          {latest && (
                            <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap">{latest.text}</p>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setCommentsTargetId(t.id)}
                      className="relative px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare size={13} />
                      Comments
                      {(t.comments?.length ?? 0) > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {t.comments!.length}
                        </span>
                      )}
                    </button>
                    <button onClick={() => openEdit(t)}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                      Update
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editTarget ? "Update Target" : "Set New Target"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
              {/* Task / Multiple Target toggle */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                <button type="button"
                  onClick={() => { setIsTask(true); setForm(p => ({ ...p, type: "task", unit: "", targetValue: 0, achievedValue: 0 })); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${isTask ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <ListTodo size={14} /> Task
                </button>
                <button type="button"
                  onClick={() => { setIsTask(false); setForm(p => ({ ...p, type: "multiple", unit: "", achievedValue: 0, targetValue: p.targetValue || 1 })); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${!isTask ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <Target size={14} /> Multiple Target
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {isTask
                  ? "A simple one-off task — no count tracking."
                  : "Track progress by count — set how many items need to be completed."}
              </p>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{isTask ? "Task Title" : "Target Title"} <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                  placeholder={isTask ? "e.g. Submit weekly report, Follow up with client…" : "e.g. Client visits, Sales calls, Deliverables…"}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              {/* Employee picker */}
              <div className="grid grid-cols-1 gap-3">
                <EmployeePicker employees={employees} selected={selectedEmployee} onSelect={handleSelectEmployee} />
              </div>
              {selectedEmployee && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
                  <CheckCircle2 size={13} className="text-indigo-500 flex-shrink-0" />
                  <span>{selectedEmployee.designation || "Employee"} · {selectedEmployee.branchName || "—"}</span>
                </div>
              )}

              {/* Multiple target — count only */}
              {!isTask && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Target Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.targetValue || ""}
                    onChange={e => setForm(p => ({ ...p, targetValue: Math.max(1, +e.target.value || 0) }))}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">How many items the employee needs to complete.</p>
                </div>
              )}

              {/* Dates + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({...p, endDate: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value as any}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {["Active","Completed","Overdue","Draft"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || (!selectedEmployee && !editTarget) || !form.title.trim() || (!isTask && form.targetValue < 1)}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {commentsTarget && (
        <CommentsModal
          target={commentsTarget}
          adminName={adminInfo.name}
          adminId={adminInfo.id}
          onClose={() => setCommentsTargetId(null)}
        />
      )}
    </div>
  );
}
