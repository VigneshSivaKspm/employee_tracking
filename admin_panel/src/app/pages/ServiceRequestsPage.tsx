import React, { useState, useEffect } from "react";
import { Wrench, Plus, Search, X, Clock, CheckCircle2, AlertCircle, MapPin, User } from "lucide-react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

interface ServiceRequest {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  clientName: string;
  clientAddress: string;
  assignedTo: string;
  department: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Open" | "In Progress" | "Resolved" | "Closed" | "Cancelled";
  scheduledDate: string;
  resolvedDate?: string;
  visitType: "On-site" | "Remote" | "Phone";
  notes: string;
  createdAt?: any;
}

const EMPTY_FORM: Omit<ServiceRequest, "id" | "ticketNo"> = {
  title: "", description: "", clientName: "", clientAddress: "",
  assignedTo: "", department: "", priority: "Medium", status: "Open",
  scheduledDate: new Date().toISOString().slice(0, 10),
  visitType: "On-site", notes: "",
};

function genTicket() { return "SR-" + Date.now().toString().slice(-6); }

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "serviceRequests"), orderBy("createdAt", "desc")),
      snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRequest)))
    );
    return unsub;
  }, []);

  const filtered = requests.filter(r => {
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (priorityFilter !== "All" && r.priority !== priorityFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.clientName.toLowerCase().includes(search.toLowerCase()) &&
        !r.assignedTo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    open: requests.filter(r => r.status === "Open").length,
    inProgress: requests.filter(r => r.status === "In Progress").length,
    resolved: requests.filter(r => r.status === "Resolved").length,
    urgent: requests.filter(r => r.priority === "Urgent").length,
  };

  async function handleSave() {
    setSaving(true);
    try {
      if (selected) {
        await updateDoc(doc(db, "serviceRequests", selected.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "serviceRequests"), { ...form, ticketNo: genTicket(), createdAt: serverTimestamp() });
      }
      setShowForm(false); setSelected(null);
    } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: ServiceRequest["status"]) {
    const update: any = { status, updatedAt: serverTimestamp() };
    if (status === "Resolved") update.resolvedDate = new Date().toISOString().slice(0, 10);
    await updateDoc(doc(db, "serviceRequests", id), update);
  }

  const priorityColors: Record<string, string> = {
    Low: "bg-slate-100 text-slate-600",
    Medium: "bg-blue-100 text-blue-700",
    High: "bg-orange-100 text-orange-700",
    Urgent: "bg-red-100 text-red-700",
  };
  const statusColors: Record<string, string> = {
    Open: "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Resolved: "bg-green-100 text-green-700",
    Closed: "bg-slate-100 text-slate-600",
    Cancelled: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Tickets", value: stats.open, icon: AlertCircle, bg: "bg-yellow-50", text: "text-yellow-600" },
          { label: "In Progress", value: stats.inProgress, icon: Clock, bg: "bg-blue-50", text: "text-blue-600" },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle2, bg: "bg-green-50", text: "text-green-600" },
          { label: "Urgent", value: stats.urgent, icon: Wrench, bg: "bg-red-50", text: "text-red-600" },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-3`}><Icon size={18} className={text} /></div>
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
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none">
              {["All","Open","In Progress","Resolved","Closed","Cancelled"].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none">
              {["All","Low","Medium","High","Urgent"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button onClick={() => { setSelected(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> New Request
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No service requests found.</div>
          )}
          {filtered.map(r => (
            <div key={r.id} className="px-4 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{r.ticketNo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[r.priority]}`}>{r.priority}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}>{r.status}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{r.visitType}</span>
                  </div>
                  <p className="font-medium text-slate-900 text-sm mb-1">{r.title}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><User size={11} />{r.clientName}</span>
                    {r.clientAddress && <span className="flex items-center gap-1"><MapPin size={11} />{r.clientAddress}</span>}
                    <span className="flex items-center gap-1"><Clock size={11} />{r.scheduledDate}</span>
                    {r.assignedTo && <span>Assigned: {r.assignedTo}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {r.status === "Open" && (
                    <button onClick={() => updateStatus(r.id, "In Progress")}
                      className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap">
                      Start
                    </button>
                  )}
                  {r.status === "In Progress" && (
                    <button onClick={() => updateStatus(r.id, "Resolved")}
                      className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap">
                      Resolve
                    </button>
                  )}
                  <button onClick={() => { setSelected(r); setForm({ ...r }); setShowForm(true); }}
                    className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{selected ? "Edit Request" : "New Service Request"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {[["title","Title",true],["description","Description",true],["clientName","Client Name",false],["clientAddress","Client Address",true],["assignedTo","Assigned To",false],["department","Department",false],["notes","Notes",true]].map(([k,l,full]) => (
                <div key={k as string} className={full ? "col-span-2" : ""}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{l as string}</label>
                  {k === "description" || k === "notes" ? (
                    <textarea value={form[k as string] || ""} onChange={e => setForm((p: any) => ({...p, [k as string]: e.target.value}))} rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  ) : (
                    <input value={form[k as string] || ""} onChange={e => setForm((p: any) => ({...p, [k as string]: e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
                <select value={form.priority} onChange={e => setForm((p: any) => ({...p, priority: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {["Low","Medium","High","Urgent"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Visit Type</label>
                <select value={form.visitType} onChange={e => setForm((p: any) => ({...p, visitType: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {["On-site","Remote","Phone"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Scheduled Date</label>
                <input type="date" value={form.scheduledDate} onChange={e => setForm((p: any) => ({...p, scheduledDate: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm((p: any) => ({...p, status: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {["Open","In Progress","Resolved","Closed","Cancelled"].map(v => <option key={v}>{v}</option>)}
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
