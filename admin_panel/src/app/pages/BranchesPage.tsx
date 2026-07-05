import React, { useState, useEffect } from "react";
import { Building2, Plus, Search, Users, MapPin, Phone, Edit2, Trash2, X, Check } from "lucide-react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

interface Branch {
  id: string;
  name: string;
  code: string;
  company: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  manager: string;
  employeeCount: number;
  status: "Active" | "Inactive";
  createdAt?: any;
}

interface Company {
  id: string;
  name: string;
  industry: string;
  gst: string;
  website: string;
  status: "Active" | "Inactive" | string;
}

const EMPTY_BRANCH: Omit<Branch, "id"> = {
  name: "", code: "", company: "", city: "", state: "", address: "",
  phone: "", manager: "", employeeCount: 0, status: "Active",
};
const EMPTY_COMPANY: Omit<Company, "id"> = {
  name: "", industry: "", gst: "", website: "", status: "Active",
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tab, setTab] = useState<"branches" | "companies">("branches");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Branch | Company | null>(null);
  const [form, setForm] = useState<any>(EMPTY_BRANCH);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });
    const u2 = onSnapshot(collection(db, "companies"), snap => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });
    return () => { u1(); u2(); };
  }, []);

  const isCompanyTab = tab === "companies";
  const colName = isCompanyTab ? "companies" : "branches";

  function openCreate() {
    setEditItem(null);
    setForm(isCompanyTab ? EMPTY_COMPANY : EMPTY_BRANCH);
    setShowForm(true);
  }
  function openEdit(item: Branch | Company) {
    setEditItem(item);
    setForm({ ...item });
    setShowForm(true);
  }
  async function handleSave() {
    setSaving(true);
    try {
      if (editItem) {
        const { id, ...rest } = form;
        await updateDoc(doc(db, colName, (editItem as any).id), { ...rest, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, colName), { ...form, createdAt: serverTimestamp() });
      }
      setShowForm(false);
    } finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    await deleteDoc(doc(db, colName, id));
  }

  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.company.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Companies", value: companies.length, icon: Building2, color: "indigo" },
          { label: "Total Branches", value: branches.length, icon: MapPin, color: "blue" },
          { label: "Active Branches", value: branches.filter(b => b.status === "Active").length, icon: Check, color: "green" },
          { label: "Total Employees", value: branches.reduce((s, b) => s + (b.employeeCount || 0), 0), icon: Users, color: "purple" },
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

      {/* Tabs + Actions */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex gap-1">
            {(["branches", "companies"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setSearch(""); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={14} /> Add {isCompanyTab ? "Company" : "Branch"}
            </button>
          </div>
        </div>

        {/* Branches Table */}
        {tab === "branches" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Branch", "Company", "Location", "Manager", "Employees", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBranches.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                    No branches yet. Click "Add Branch" to create one.
                  </td></tr>
                )}
                {filteredBranches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500">{b.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{b.company || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{b.city}</p>
                      <p className="text-xs text-slate-500">{b.state}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{b.manager || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{b.employeeCount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Companies Table */}
        {tab === "companies" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Company", "Industry", "GST", "Website", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    No companies yet. Click "Add Company" to create one.
                  </td></tr>
                )}
                {filteredCompanies.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-700">{c.industry}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.gst || "—"}</td>
                    <td className="px-4 py-3 text-blue-600 text-xs">{c.website || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editItem ? "Edit" : "Add"} {isCompanyTab ? "Company" : "Branch"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {isCompanyTab ? (
                <>
                  {[["name","Company Name"],["industry","Industry"],["gst","GST Number"],["website","Website"]].map(([k,l]) => (
                    <div key={k} className={k === "name" ? "col-span-2" : ""}>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">{l}</label>
                      <input value={form[k] || ""} onChange={e => setForm((p: any) => ({...p, [k]: e.target.value}))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                    <select value={form.status} onChange={e => setForm((p: any) => ({...p, status: e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Company dropdown — must pick an existing company */}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Company <span className="text-red-500">*</span></label>
                    <select value={form.company || ""} onChange={e => setForm((p: any) => ({...p, company: e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="">— Select a company —</option>
                      {companies.filter(c => c.status === "Active").map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {companies.filter(c => c.status === "Active").length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No active companies found. Create a company first.</p>
                    )}
                  </div>
                  {[["name","Branch Name"],["code","Branch Code"],["city","City"],["state","State"],["address","Address"],["phone","Phone"],["manager","Manager Name"]].map(([k,l]) => (
                    <div key={k} className={["name","address"].includes(k) ? "col-span-2" : ""}>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">{l}</label>
                      <input value={form[k] || ""} onChange={e => setForm((p: any) => ({...p, [k]: e.target.value}))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Employee Count</label>
                    <input type="number" value={form.employeeCount || 0} onChange={e => setForm((p: any) => ({...p, employeeCount: +e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                    <select value={form.status} onChange={e => setForm((p: any) => ({...p, status: e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
