import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAttendance } from '../../context/AttendanceContext';
import { useTabScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';

const { width } = Dimensions.get('window');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function CircleProgress({ percent }: { percent: number }) {
  const size = 120;
  const strokeWidth = 10;
  const clipped = Math.min(100, Math.max(0, percent));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth, borderColor: '#E2E8F0',
      }} />
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth, borderColor: '#2563EB',
        borderRightColor: clipped < 75 ? 'transparent' : '#2563EB',
        borderBottomColor: clipped < 50 ? 'transparent' : '#2563EB',
        borderLeftColor: clipped < 25 ? 'transparent' : '#2563EB',
        transform: [{ rotate: '-90deg' }],
      }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B' }}>{clipped}%</Text>
        <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '500' }}>Attendance</Text>
      </View>
    </View>
  );
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === '—') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return 0;
  return h * 60 + (m || 0);
}

export default function AnalyticsScreen() {
  const headerTop = useTopInset(16);
  const bottomPadding = useTabScreenBottomPadding();
  const { attendanceHistory } = useAttendance();

  const now = new Date();
  const [currentMonthIdx, setCurrentMonthIdx] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [activeWeek, setActiveWeek] = useState(1);

  const monthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;

  const monthRecords = useMemo(
    () => attendanceHistory.filter(r => r.date?.startsWith(monthStr)),
    [attendanceHistory, monthStr],
  );

  const analytics = useMemo(() => {
    const presentDays = monthRecords.filter(r => r.clockIn && r.status !== 'absent').length;
    const absentDays = monthRecords.filter(r => !r.clockIn || r.status === 'absent').length;
    const leaveDays = monthRecords.filter(r => r.status === 'on_leave' || r.status === 'Leave').length;
    const lateDays = monthRecords.filter(r => r.status === 'late' || r.status === 'Late').length;

    let totalMinutes = 0;
    let clockInMinTotal = 0;
    let clockOutMinTotal = 0;
    let validDays = 0;

    monthRecords.forEach(r => {
      if (r.clockIn && r.clockOut) {
        const inM = parseTimeToMinutes(r.clockIn);
        const outM = parseTimeToMinutes(r.clockOut);
        if (outM > inM) {
          totalMinutes += outM - inM;
          clockInMinTotal += inM;
          clockOutMinTotal += outM;
          validDays++;
        }
      }
    });

    const totalWorkingHours = totalMinutes / 60;
    const workingDays = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    const attendancePercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

    function minsToStr(mins: number): string {
      if (!mins) return '—';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const avgClockIn = validDays > 0 ? minsToStr(Math.round(clockInMinTotal / validDays)) : '—';
    const avgClockOut = validDays > 0 ? minsToStr(Math.round(clockOutMinTotal / validDays)) : '—';

    return { presentDays, absentDays, leaveDays, lateDays, totalWorkingHours, attendancePercentage, avgClockIn, avgClockOut };
  }, [monthRecords, currentMonthIdx, currentYear]);

  // Build week data from real records
  const weekData = useMemo(() => {
    const days = monthRecords.map(r => {
      const d = new Date(r.date + 'T00:00:00');
      const dayOfWeek = (d.getDay() + 6) % 7; // 0=Mon, 6=Sun
      let hours = 0;
      if (r.clockIn && r.clockOut) {
        const diff = parseTimeToMinutes(r.clockOut) - parseTimeToMinutes(r.clockIn);
        hours = diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
      }
      const week = Math.ceil(d.getDate() / 7);
      return { dayOfWeek, hours, week, date: r.date };
    });

    const byWeek: Record<number, { label: string; hours: number }[]> = { 1: [], 2: [], 3: [], 4: [] };
    [1, 2, 3, 4].forEach(w => {
      const weekDays: { label: string; hours: number }[] = WEEK_DAY_LABELS.map(l => ({ label: l, hours: 0 }));
      days.filter(d => d.week === w).forEach(d => {
        if (d.dayOfWeek < 7) weekDays[d.dayOfWeek].hours = d.hours;
      });
      byWeek[w] = weekDays;
    });
    return byWeek;
  }, [monthRecords]);

  const currentWeekData = weekData[activeWeek] ?? WEEK_DAY_LABELS.map(l => ({ label: l, hours: 0 }));
  const maxHours = Math.max(...currentWeekData.map(d => d.hours), 1);

  function prevMonth() {
    if (currentMonthIdx === 0) { setCurrentMonthIdx(11); setCurrentYear(y => y - 1); }
    else setCurrentMonthIdx(i => i - 1);
  }
  function nextMonth() {
    if (currentMonthIdx === 11) { setCurrentMonthIdx(0); setCurrentYear(y => y + 1); }
    else setCurrentMonthIdx(i => i + 1);
  }

  const summaryCards = [
    { label: 'Present Days', value: `${analytics.presentDays}`, bg: '#DCFCE7', text: '#16A34A', icon: 'checkmark-circle-outline' },
    { label: 'Leave Days',   value: `${analytics.leaveDays}`,   bg: '#FEF3C7', text: '#D97706', icon: 'calendar-outline' },
    { label: 'Working Hrs',  value: `${analytics.totalWorkingHours.toFixed(0)}h`, bg: '#EFF6FF', text: '#2563EB', icon: 'time-outline' },
    { label: 'Attendance',   value: `${analytics.attendancePercentage}%`, bg: '#EDE9FE', text: '#7C3AED', icon: 'bar-chart-outline' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={[styles.header, { paddingTop: headerTop }]}
        >
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.monthText}>{MONTHS[currentMonthIdx]} {currentYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Main Stats Card */}
        <View style={[styles.mainCard, { marginTop: -20 }]}>
          <View style={styles.mainCardContent}>
            <CircleProgress percent={analytics.attendancePercentage} />
            <View style={styles.mainCardStats}>
              <View style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: '#16A34A' }]} />
                <View>
                  <Text style={styles.statValue}>{analytics.presentDays}</Text>
                  <Text style={styles.statLabel}>Present</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: '#D97706' }]} />
                <View>
                  <Text style={styles.statValue}>{analytics.leaveDays}</Text>
                  <Text style={styles.statLabel}>Leaves</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: '#DC2626' }]} />
                <View>
                  <Text style={styles.statValue}>{analytics.lateDays}</Text>
                  <Text style={styles.statLabel}>Late Arrivals</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.mainCardDivider} />

          <View style={styles.totalHoursRow}>
            <View style={styles.totalHoursLeft}>
              <Text style={styles.totalHoursValue}>{analytics.totalWorkingHours.toFixed(0)}</Text>
              <Text style={styles.totalHoursUnit}>hrs</Text>
            </View>
            <Text style={styles.totalHoursLabel}>Total Working Hours</Text>
          </View>
        </View>

        {/* Working Hours Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Working Hours Overview</Text>
          <View style={styles.weekTabs}>
            {[1, 2, 3, 4].map(w => (
              <TouchableOpacity
                key={w}
                style={[styles.weekTab, activeWeek === w && styles.activeWeekTab]}
                onPress={() => setActiveWeek(w)}
              >
                <Text style={[styles.weekTabText, activeWeek === w && styles.activeWeekTabText]}>
                  Week {w}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.barChart}>
            {currentWeekData.map((day, idx) => {
              const heightPct = day.hours > 0 ? (day.hours / maxHours) : 0;
              const barH = Math.round(heightPct * 100);
              const barColor = day.hours === 0 ? '#E2E8F0'
                : day.hours >= 9 ? '#16A34A'
                : day.hours >= 7 ? '#2563EB'
                : '#D97706';
              return (
                <View key={idx} style={styles.barCol}>
                  {day.hours > 0 && (
                    <Text style={styles.barHoursLabel}>{day.hours}h</Text>
                  )}
                  <View style={styles.barBg}>
                    <View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.barDayLabel}>{day.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Summary Grid */}
        <View style={styles.summaryGrid}>
          {summaryCards.map((item, idx) => (
            <View key={idx} style={[styles.summaryCard, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon as any} size={22} color={item.text} />
              <Text style={[styles.summaryValue, { color: item.text }]}>{item.value}</Text>
              <Text style={[styles.summaryLabel, { color: item.text }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Monthly Overview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Overview</Text>
          <View style={styles.overviewRow}>
            <Ionicons name="log-in-outline" size={18} color="#64748B" />
            <Text style={styles.overviewLabel}>Avg Clock In</Text>
            <Text style={styles.overviewValue}>{analytics.avgClockIn}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewRow}>
            <Ionicons name="log-out-outline" size={18} color="#64748B" />
            <Text style={styles.overviewLabel}>Avg Clock Out</Text>
            <Text style={styles.overviewValue}>{analytics.avgClockOut}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewRow}>
            <Ionicons name="calendar-outline" size={18} color="#64748B" />
            <Text style={styles.overviewLabel}>Total Working Days</Text>
            <Text style={styles.overviewValue}>{analytics.presentDays} days</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  scrollView: { flex: 1 },
  scrollContent: {},
  header: { paddingHorizontal: 20, paddingBottom: 48, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  monthNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', minWidth: 90, textAlign: 'center' },
  mainCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  mainCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mainCardStats: { gap: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statDot: { width: 10, height: 10, borderRadius: 5 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  statLabel: { fontSize: 12, color: '#94A3B8' },
  mainCardDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  totalHoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalHoursLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  totalHoursValue: { fontSize: 32, fontWeight: '800', color: '#2563EB' },
  totalHoursUnit: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  totalHoursLabel: { fontSize: 14, color: '#64748B', flex: 1 },
  card: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  weekTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  weekTab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8, backgroundColor: '#F1F5F9' },
  activeWeekTab: { backgroundColor: '#2563EB' },
  weekTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  activeWeekTabText: { color: '#FFFFFF' },
  barChart: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', height: 130, gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barHoursLabel: { fontSize: 9, color: '#94A3B8', marginBottom: 3 },
  barBg: { width: '100%', height: 100, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barDayLabel: { fontSize: 11, color: '#94A3B8', marginTop: 5, fontWeight: '500' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, marginTop: 16, gap: 10 },
  summaryCard: { width: (width - 48) / 2, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8 },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  overviewLabel: { flex: 1, fontSize: 14, color: '#64748B' },
  overviewValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  overviewDivider: { height: 1, backgroundColor: '#F1F5F9' },
});
