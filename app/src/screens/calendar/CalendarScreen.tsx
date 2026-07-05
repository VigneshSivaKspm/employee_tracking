import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useTopInset } from '../../hooks/useBottomSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAttendance } from '../../context/AttendanceContext';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'meeting' | 'reminder' | 'holiday' | 'deadline' | 'training' | 'leave';
}

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  meeting:   { bg: '#EFF6FF', text: '#2563EB', dot: '#2563EB' },
  reminder:  { bg: '#FEF3C7', text: '#D97706', dot: '#D97706' },
  holiday:   { bg: '#DCFCE7', text: '#16A34A', dot: '#16A34A' },
  deadline:  { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
  training:  { bg: '#EDE9FE', text: '#7C3AED', dot: '#7C3AED' },
  leave:     { bg: '#FFF1F2', text: '#BE123C', dot: '#BE123C' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['S','M','T','W','T','F','S'];

export default function CalendarScreen() {
  const headerTop = useTopInset(12);
  const navigation = useNavigation();
  const { attendanceHistory, leaveRequests } = useAttendance();

  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'calendarEvents'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    });
    return unsub;
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today.toISOString().slice(0, 10);

  // Build dot map from events + attendance + leaves
  const dotsByDate: Record<string, string[]> = {};

  events.forEach(e => {
    if (!dotsByDate[e.date]) dotsByDate[e.date] = [];
    dotsByDate[e.date].push(TYPE_COLORS[e.type]?.dot || '#64748B');
  });

  attendanceHistory.forEach(r => {
    if (!r.date || !r.clockIn) return;
    if (!dotsByDate[r.date]) dotsByDate[r.date] = [];
    dotsByDate[r.date].push('#16A34A');
  });

  leaveRequests.filter(l => l.status === 'approved' || l.status === 'Approved').forEach(l => {
    if (l.startDate) {
      if (!dotsByDate[l.startDate]) dotsByDate[l.startDate] = [];
      dotsByDate[l.startDate].push('#D97706');
    }
  });

  // Selected date events
  const selectedEvents = events.filter(e => e.date === selectedDate);
  const selectedAttendance = attendanceHistory.find(r => r.date === selectedDate);
  const selectedLeave = leaveRequests.find(l =>
    l.startDate <= selectedDate && l.endDate >= selectedDate
  );

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: headerTop }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.dayHeaders}>
          {DAYS_SHORT.map((d, i) => (
            <View key={i} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.grid}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <View key={`e${i}`} style={styles.dayCell} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dots = dotsByDate[dateStr] || [];
            return (
              <TouchableOpacity
                key={day}
                style={styles.dayCell}
                onPress={() => setSelectedDate(dateStr)}
              >
                <View style={[
                  styles.dayCircle,
                  isSelected && styles.selectedCircle,
                  isToday && !isSelected && styles.todayCircle,
                ]}>
                  <Text style={[
                    styles.dayText,
                    isSelected && styles.selectedDayText,
                    isToday && !isSelected && styles.todayDayText,
                  ]}>{day}</Text>
                </View>
                {dots.length > 0 && (
                  <View style={styles.dotsRow}>
                    {dots.slice(0, 3).map((color, di) => (
                      <View key={di} style={[styles.dot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : color }]} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Selected Day Details */}
      <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.selectedDateLabel}>
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>

        {/* Attendance info */}
        {selectedAttendance && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="time-outline" size={18} color="#2563EB" />
              <Text style={styles.infoCardTitle}>Attendance</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Clock In</Text>
              <Text style={styles.infoValue}>{selectedAttendance.clockIn || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Clock Out</Text>
              <Text style={styles.infoValue}>{selectedAttendance.clockOut || '—'}</Text>
            </View>
          </View>
        )}

        {/* Leave info */}
        {selectedLeave && (
          <View style={[styles.infoCard, { borderLeftColor: '#D97706' }]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="calendar-outline" size={18} color="#D97706" />
              <Text style={[styles.infoCardTitle, { color: '#D97706' }]}>Leave</Text>
            </View>
            <Text style={styles.infoValue}>{(selectedLeave as any).type || 'Leave'} · {selectedLeave.status}</Text>
          </View>
        )}

        {/* Events */}
        {selectedEvents.length === 0 && !selectedAttendance && !selectedLeave && (
          <View style={styles.emptyDay}>
            <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyDayText}>No events on this day</Text>
          </View>
        )}

        {selectedEvents.map(e => {
          const cfg = TYPE_COLORS[e.type] || TYPE_COLORS.reminder;
          return (
            <View key={e.id} style={[styles.eventCard, { borderLeftColor: cfg.dot }]}>
              <View style={[styles.eventTypeBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.eventTypeText, { color: cfg.text }]}>{e.type}</Text>
              </View>
              <Text style={styles.eventTitle}>{e.title}</Text>
              {e.time && <Text style={styles.eventTime}>{e.time}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingBottom: 16 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, marginBottom: 12,
  },
  navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', minWidth: 140, textAlign: 'center' },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedCircle: { backgroundColor: '#FFFFFF' },
  todayCircle: { backgroundColor: 'rgba(255,255,255,0.2)' },
  dayText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.9)' },
  selectedDayText: { color: '#2563EB', fontWeight: '800' },
  todayDayText: { color: '#FFFFFF', fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  detailsContent: { padding: 16, gap: 12 },
  selectedDateLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#2563EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { fontSize: 13, color: '#64748B' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  emptyDay: { alignItems: 'center', paddingVertical: 40 },
  emptyDayText: { fontSize: 13, color: '#94A3B8', marginTop: 10 },
  eventCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderLeftWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  eventTypeBadge: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  eventTypeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  eventTime: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
});
