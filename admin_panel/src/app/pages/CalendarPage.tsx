import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Bell, Calendar, Clock, Users } from "lucide-react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: "meeting" | "reminder" | "holiday" | "deadline" | "training";
  attendees: string;
  createdBy: string;
  createdAt?: any;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  meeting: { color: "text-blue-700", bg: "bg-blue-100", label: "Meeting" },
  reminder: { color: "text-orange-700", bg: "bg-orange-100", label: "Reminder" },
  holiday: { color: "text-green-700", bg: "bg-green-100", label: "Holiday" },
  deadline: { color: "text-red-700", bg: "bg-red-100", label: "Deadline" },
  training: { color: "text-purple-700", bg: "bg-purple-100", label: "Training" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", date: selectedDate,
    time: "09:00", type: "meeting" as CalendarEvent["type"],
    attendees: "", createdBy: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "calendarEvents"), orderBy("date", "asc")),
      snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)))
    );
    return unsub;
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today.toISOString().slice(0, 10);

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const selectedEvents = eventsByDate[selectedDate] || [];
  const upcomingEvents = events.filter(e => e.date >= todayStr).slice(0, 8);

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  async function handleSave() {
    if (!form.title || !form.date) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "calendarEvents"), { ...form, createdAt: serverTimestamp() });
      setShowForm(false);
      setForm(f => ({ ...f, title: "", description: "", attendees: "" }));
    } finally { setSaving(false); }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "calendarEvents", id));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => setViewDate(new Date())} className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Today</button>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasEvents = !!eventsByDate[dateStr];
                const evTypes = eventsByDate[dateStr]?.map(e => e.type) || [];
                return (
                  <button key={day} onClick={() => setSelectedDate(dateStr)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors
                      ${isSelected ? "bg-indigo-600 text-white" : isToday ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"}`}>
                    {day}
                    {hasEvents && (
                      <div className="flex gap-0.5 mt-0.5">
                        {evTypes.slice(0, 3).map((t, ti) => (
                          <div key={ti} className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : TYPE_CONFIG[t]?.bg.replace("bg-","bg-").replace("100","500") || "bg-indigo-500"}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Selected Day Events */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </h3>
              <button onClick={() => { setForm(f => ({...f, date: selectedDate})); setShowForm(true); }}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="p-3 space-y-2 min-h-[120px]">
              {selectedEvents.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">No events on this day</div>
              )}
              {selectedEvents.map(e => {
                const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.reminder;
                return (
                  <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color} whitespace-nowrap`}>{cfg.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{e.title}</p>
                      <p className="text-xs text-slate-500">{e.time}{e.attendees ? ` · ${e.attendees}` : ""}</p>
                    </div>
                    <button onClick={() => deleteEvent(e.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Upcoming Events</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {upcomingEvents.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">No upcoming events</div>
              )}
              {upcomingEvents.map(e => {
                const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.reminder;
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`h-7 w-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <Calendar size={13} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{e.title}</p>
                      <p className="text-xs text-slate-500">{e.date} · {e.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Event / Reminder</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Title</label>
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Event title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Time</label>
                  <input type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <button key={k} onClick={() => setForm(p => ({...p, type: k as CalendarEvent["type"]}))}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${form.type === k ? `${v.bg} ${v.color}` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Attendees</label>
                <input value={form.attendees} onChange={e => setForm(p => ({...p, attendees: e.target.value}))} placeholder="Names or emails, comma-separated"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                {saving ? "Saving..." : "Save Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
