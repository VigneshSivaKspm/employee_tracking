import React, { useState, useEffect } from "react";
import { Target, Plus, Search, X, CheckCircle2, Clock, TrendingUp, Award } from "lucide-react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

interface EmployeeTarget {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  branch: string;
  title: string;
  description: string;
  targetValue: number;
  achievedValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Completed" | "Overdue" | "Draft";
  createdAt?: any;
}

const EMPTY_FORM: Omit<EmployeeTarget, "id"> = {
  employeeName: "", employeeId: "", department: "", branch: "",
  title: "", description: "", targetValue: 0, achievedValue: 0, unit: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  status: "Active",
};

export default function TargetsPage() {
  const [targets, setTargets] = useState<EmployeeTarget[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeTarget | null>(null);
  const [form, setForm] = useState<Omit<EmployeeTarget, "id">>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "targets"), orderBy("endDate", "asc")),
      snap => setTargets(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeTarget)))
    );
    return unsub;
  }, []);

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

  function openCreate() { setEditTarget(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }
  function openEdit(t: EmployeeTarget) { setEditTarget(t); setForm({ ...t }); setShowForm(true); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        await updateDoc(doc(db, "targets", editTarget.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "targets"), { ...form, createdAt: serverTimestamp() });
      }
      setShowForm(false);
    } finally { setSaving(false); }
  }

  async function updateAchieved(id: string, value: number) {
    const status = targets.find(t => t.id === id);
    if (!status) return;
    const newStatus = value >= status.targetValue ? "Completed" : status.status;
    await updateDoc(doc(db, "targets", id), { achievedValue: value, status: newStatus, updatedAt: serverTimestamp() });
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
            const pct = t.targetValue > 0 ? Math.min(100, Math.round((t.achievedValue / t.targetValue) * 100)) : 0;
            return (
              <div key={t.id} className="px-4 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm">{t.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status]}`}>{t.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{t.employeeName} · {t.department} · {t.branch}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-orange-400"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {t.achievedValue}{t.unit} / {t.targetValue}{t.unit} ({pct}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{t.startDate} → {t.endDate}</p>
                  </div>
                  <div className="flex items-center gap-1">
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
            <div className="px-6 py-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {[["title","Target Title", true],["description","Description", true],["employeeName","Employee Name", false],["employeeId","Employee ID", false],["department","Department", false],["branch","Branch", false],["unit","Unit (e.g. ₹, calls, visits)", false]].map(([k,l,full]) => (
                <div key={k as string} className={full ? "col-span-2" : ""}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{l as string}</label>
                  <input value={(form as any)[k as string] || ""} onChange={e => setForm(p => ({...p, [k as string]: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Target Value</label>
                <input type="number" value={form.targetValue} onChange={e => setForm(p => ({...p, targetValue: +e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Achieved Value</label>
                <input type="number" value={form.achievedValue} onChange={e => setForm(p => ({...p, achievedValue: +e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
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
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
