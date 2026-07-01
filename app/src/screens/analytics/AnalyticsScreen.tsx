import React, { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_ANALYTICS } from '../../data/mockData';

const { width } = Dimensions.get('window');
const BAR_WIDTH = (width - 64 - 48) / 7;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const WEEKLY_DATA = [
  { label: 'M', hours: 8.5, week: 1 },
  { label: 'T', hours: 9.0, week: 1 },
  { label: 'W', hours: 8.0, week: 1 },
  { label: 'T', hours: 9.5, week: 1 },
  { label: 'F', hours: 7.5, week: 1 },
  { label: 'S', hours: 0,   week: 1 },
  { label: 'S', hours: 0,   week: 1 },
];

const WEEKLY_DATA_BY_WEEK: Record<number, typeof WEEKLY_DATA> = {
  1: [
    { label:'M', hours:8.5, week:1 },{ label:'T', hours:9.0, week:1 },
    { label:'W', hours:8.0, week:1 },{ label:'T', hours:9.5, week:1 },
    { label:'F', hours:7.5, week:1 },{ label:'S', hours:0,   week:1 },
    { label:'S', hours:0,   week:1 },
  ],
  2: [
    { label:'M', hours:8.0, week:2 },{ label:'T', hours:7.5, week:2 },
    { label:'W', hours:9.0, week:2 },{ label:'T', hours:8.5, week:2 },
    { label:'F', hours:9.0, week:2 },{ label:'S', hours:0,   week:2 },
    { label:'S', hours:4.0, week:2 },
  ],
  3: [
    { label:'M', hours:9.5, week:3 },{ label:'T', hours:9.0, week:3 },
    { label:'W', hours:8.0, week:3 },{ label:'T', hours:0,   week:3 },
    { label:'F', hours:8.5, week:3 },{ label:'S', hours:0,   week:3 },
    { label:'S', hours:0,   week:3 },
  ],
  4: [
    { label:'M', hours:8.0, week:4 },{ label:'T', hours:9.0, week:4 },
    { label:'W', hours:7.5, week:4 },{ label:'T', hours:8.5, week:4 },
    { label:'F', hours:6.5, week:4 },{ label:'S', hours:0,   week:4 },
    { label:'S', hours:0,   week:4 },
  ],
};

function CircleProgress({ percent }: { percent: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background circle */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: '#E2E8F0',
      }} />
      {/* We'll approximate the progress with a clipped view */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: '#2563EB',
        borderRightColor: percent < 75 ? 'transparent' : '#2563EB',
        borderBottomColor: percent < 50 ? 'transparent' : '#2563EB',
        borderLeftColor: percent < 25 ? 'transparent' : '#2563EB',
        transform: [{ rotate: '-90deg' }],
      }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B' }}>{percent}%</Text>
        <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '500' }}>Attendance</Text>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [currentMonthIdx, setCurrentMonthIdx] = useState(5); // June
  const [activeWeek, setActiveWeek] = useState(1);

  const analytics = MOCK_ANALYTICS;
  const weekData = WEEKLY_DATA_BY_WEEK[activeWeek] ?? WEEKLY_DATA;
  const maxHours = Math.max(...weekData.map(d => d.hours), 1);

  const summaryCards = [
    { label: 'Present Days', value: `${analytics.presentDays}`, bg: '#DCFCE7', text: '#16A34A', icon: 'checkmark-circle-outline' },
    { label: 'Leave Days',   value: `${analytics.leaveDays}`,   bg: '#FEF3C7', text: '#D97706', icon: 'calendar-outline' },
    { label: 'Working Hrs',  value: `${analytics.totalWorkingHours.toFixed(0)}h`, bg: '#EFF6FF', text: '#2563EB', icon: 'time-outline' },
    { label: 'Attendance',   value: `${analytics.attendancePercentage.toFixed(0)}%`, bg: '#EDE9FE', text: '#7C3AED', icon: 'bar-chart-outline' },
  ];

  function prevMonth() {
    setCurrentMonthIdx(i => (i > 0 ? i - 1 : 11));
  }
  function nextMonth() {
    setCurrentMonthIdx(i => (i < 11 ? i + 1 : 0));
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.monthText}>{MONTHS[currentMonthIdx]} 2026</Text>
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
                  <Text style={styles.statValue}>{analytics.absentDays}</Text>
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

          {/* Week tabs */}
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

          {/* Bar chart */}
          <View style={styles.barChart}>
            {weekData.map((day, idx) => {
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
  scrollContent: { paddingBottom: 40 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  monthNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', minWidth: 90, textAlign: 'center' },
  // Main card
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  // Generic card
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  // Week tabs
  weekTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  weekTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  activeWeekTab: { backgroundColor: '#2563EB' },
  weekTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  activeWeekTabText: { color: '#FFFFFF' },
  // Bar chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barHoursLabel: { fontSize: 9, color: '#94A3B8', marginBottom: 3 },
  barBg: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barDayLabel: { fontSize: 11, color: '#94A3B8', marginTop: 5, fontWeight: '500' },
  // Summary grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  summaryCard: {
    width: (width - 48) / 2,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  // Overview
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  overviewLabel: { fontSize: 14, color: '#64748B', flex: 1 },
  overviewValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  overviewDivider: { height: 1, backgroundColor: '#F8FAFC', marginVertical: 8 },
});
