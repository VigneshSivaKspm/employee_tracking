import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Plus, Search, Download, X, DollarSign, ShoppingCart, Receipt, Filter } from "lucide-react";
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SalesEntry {
  id: string;
  type: "sale" | "expense";
  title: string;
  category: string;
  amount: number;
  employeeName: string;
  branch: string;
  date: string;
  notes: string;
  createdAt?: any;
}

const SALE_CATEGORIES = ["Product Sale", "Service Sale", "Subscription", "Consulting", "Other"];
const EXPENSE_CATEGORIES = ["Travel", "Office Supplies", "Marketing", "Software", "Utilities", "Maintenance", "Other"];

const EMPTY_FORM = {
  type: "sale" as "sale" | "expense",
  title: "", category: "", amount: 0,
  employeeName: "", branch: "", date: new Date().toISOString().slice(0, 10), notes: "",
};

export default function SalesPage() {
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "sale" | "expense">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "salesExpenses"), orderBy("date", "desc")),
      snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesEntry)))
    );
    return unsub;
  }, []);

  const filtered = entries.filter(e => {
    if (filter !== "all" && e.type !== filter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) &&
        !e.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSales = entries.filter(e => e.type === "sale").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const netRevenue = totalSales - totalExpenses;

  // Last 6 months chart data
  const monthlyData = (() => {
    const months: Record<string, { month: string; sales: number; expenses: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      months[key] = { month: d.toLocaleString("default", { month: "short" }), sales: 0, expenses: 0 };
    }
    entries.forEach(e => {
      const key = e.date?.slice(0, 7);
      if (months[key]) {
        if (e.type === "sale") months[key].sales += e.amount;
        else months[key].expenses += e.amount;
      }
    });
    return Object.values(months);
  })();

  async function handleSave() {
    if (!form.title || !form.amount) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "salesExpenses"), { ...form, createdAt: serverTimestamp() });
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    } finally { setSaving(false); }
  }

  function fmt(n: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  }

  function exportCSV() {
    const rows = [["Date","Type","Title","Category","Employee","Branch","Amount","Notes"],
      ...filtered.map(e => [e.date, e.type, e.title, e.category, e.employeeName, e.branch, e.amount, e.notes])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv," + encodeURIComponent(csv);
    a.download = "sales_expenses.csv"; a.click();
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 bg-green-50 rounded-lg flex items-center justify-center"><TrendingUp size={18} className="text-green-600" /></div>
            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(totalSales)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Sales</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 bg-red-50 rounded-lg flex items-center justify-center"><TrendingDown size={18} className="text-red-500" /></div>
            <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(totalExpenses)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Expenses</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${netRevenue >= 0 ? "bg-indigo-50" : "bg-orange-50"}`}>
              <DollarSign size={18} className={netRevenue >= 0 ? "text-indigo-600" : "text-orange-600"} />
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${netRevenue >= 0 ? "bg-indigo-50 text-indigo-600" : "bg-orange-50 text-orange-600"}`}>Net</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(netRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">Net Revenue</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Sales vs Expenses</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sales" name="Sales" fill="#4f46e5" radius={[4,4,0,0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-100 gap-2">
          <div className="flex gap-1">
            {(["all","sale","expense"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {f === "all" ? "All" : f === "sale" ? "Sales" : "Expenses"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
              <Download size={13} /> Export
            </button>
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={13} /> Add Entry
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Date","Type","Title","Category","Employee","Branch","Amount"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No entries yet.</td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.type === "sale" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {e.type === "sale" ? "Sale" : "Expense"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{e.title}</td>
                  <td className="px-4 py-3 text-slate-600">{e.category}</td>
                  <td className="px-4 py-3 text-slate-700">{e.employeeName}</td>
                  <td className="px-4 py-3 text-slate-600">{e.branch || "—"}</td>
                  <td className={`px-4 py-3 font-semibold ${e.type === "sale" ? "text-green-600" : "text-red-500"}`}>
                    {e.type === "expense" ? "-" : "+"}{fmt(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Sales / Expense Entry</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                <div className="flex gap-2">
                  {(["sale","expense"] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({...p, type: t, category: ""}))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${form.type === t ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      {t === "sale" ? "💰 Sale" : "💸 Expense"}
                    </button>
                  ))}
                </div>
              </div>
              {[["title","Title / Description"],["employeeName","Employee Name"],["branch","Branch"]].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{l}</label>
                  <input value={(form as any)[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select category</option>
                  {(form.type === "sale" ? SALE_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Amount (₹)</label>
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: +e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.amount}
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
