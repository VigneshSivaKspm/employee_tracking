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
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAttendance } from '../../context/AttendanceContext';
import type { AttendanceRecord } from '../../types';

type RootStackParamList = {
  Main: undefined;
  ApplyLeave: undefined;
  AttendanceHistory: undefined;
  Notifications: undefined;
  AnnouncementDetail: { announcementId: string };
  LeaveHistory: undefined;
  SubscriptionPlans: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

type DayStatus = 'present' | 'absent' | 'leave' | 'today' | 'weekend' | 'future' | 'empty';

interface CalendarDay {
  day: number | null;
  status: DayStatus;
  date?: Date;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime12Short(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

type StatusKey = 'on-time' | 'late' | 'absent' | 'half-day' | 'leave';

const STATUS_STYLES: Record<StatusKey, { bg: string; text: string; label: string }> = {
  'on-time': { bg: '#DCFCE7', text: '#16A34A', label: 'On Time' },
  'late': { bg: '#FEF3C7', text: '#D97706', label: 'Late' },
  'absent': { bg: '#FEE2E2', text: '#DC2626', label: 'Absent' },
  'half-day': { bg: '#EDE9FE', text: '#7C3AED', label: 'Half Day' },
  'leave': { bg: '#FEF3C7', text: '#D97706', label: 'Leave' },
};

function resolveRecordStatus(record: AttendanceRecord): StatusKey {
  const s = (record as any).status as string | undefined;
  if (s && s in STATUS_STYLES) return s as StatusKey;
  if (!(record as any).punchIn) return 'absent';
  // Determine late: punch in after 09:15
  if ((record as any).punchIn) {
    const punchDate = new Date((record as any).punchIn);
    const threshold = new Date(punchDate);
    threshold.setHours(9, 15, 0, 0);
    if (punchDate > threshold) return 'late';
  }
  return 'on-time';
}

export default function AttendanceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { attendanceHistory } = useAttendance();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // Build calendar grid
  const calendarDays: CalendarDay[] = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const days: CalendarDay[] = [];

    // Leading empties
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, status: 'empty' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const isToday = isSameDay(date, today);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isFuture = date > today;

      let status: DayStatus = 'future';

      if (isToday) {
        status = 'today';
      } else if (!isFuture) {
        // Check history
        const record = attendanceHistory.find((r) => {
          const rDate = new Date((r as any).date ?? (r as any).punchIn ?? 0);
          return isSameDay(rDate, date);
        });

        if (record) {
          const rStatus = resolveRecordStatus(record);
          if (rStatus === 'leave') status = 'leave';
          else if (rStatus === 'absent') status = 'absent';
          else status = 'present';
        } else if (!isWeekend) {
          status = 'absent';
        } else {
          status = 'weekend';
        }
      }

      days.push({ day: d, date, status });
    }

    // Trailing empties to complete last row
    const remainder = days.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push({ day: null, status: 'empty' });
      }
    }

    return days;
  }, [viewYear, viewMonth, attendanceHistory]);

  // Filter history for current month
  const monthlyHistory = useMemo(() => {
    return attendanceHistory.filter((r) => {
      const rDate = new Date((r as any).date ?? (r as any).punchIn ?? 0);
      return rDate.getFullYear() === viewYear && rDate.getMonth() === viewMonth;
    });
  }, [attendanceHistory, viewYear, viewMonth]);

  function getDayCellStyle(status: DayStatus) {
    switch (status) {
      case 'present':
        return { bg: '#EFF6FF', text: '#2563EB' };
      case 'absent':
        return { bg: '#FEE2E2', text: '#DC2626' };
      case 'leave':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'today':
        return { bg: '#2563EB', text: '#FFFFFF' };
      case 'weekend':
        return { bg: '#F1F5F9', text: '#94A3B8' };
      case 'future':
        return { bg: 'transparent', text: '#CBD5E1' };
      default:
        return { bg: 'transparent', text: 'transparent' };
    }
  }

  const cellSize = Math.floor((width - 32 - 32 - 6 * 4) / 7);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Blue Gradient Header ── */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Attendance History</Text>
            <View style={styles.headerPlaceholder} />
          </View>
        </LinearGradient>

        {/* ── Month Navigation + Calendar ── */}
        <View style={styles.calendarCard}>
          {/* Month nav */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={20} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.monthNavTitle}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-forward" size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaderRow}>
            {DAY_HEADERS.map((d, i) => (
              <View key={i} style={[styles.dayHeaderCell, { width: cellSize }]}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((cell, idx) => {
              if (cell.day === null) {
                return (
                  <View
                    key={idx}
                    style={[styles.dayCellWrapper, { width: cellSize }]}
                  />
                );
              }
              const colors = getDayCellStyle(cell.status);
              const isToday = cell.status === 'today';
              return (
                <View
                  key={idx}
                  style={[styles.dayCellWrapper, { width: cellSize }]}
                >
                  <View
                    style={[
                      styles.dayCell,
                      {
                        width: cellSize - 4,
                        height: cellSize - 4,
                        backgroundColor: colors.bg,
                        borderRadius: isToday ? (cellSize - 4) / 2 : 6,
                      },
                    ]}
                  >
                    <Text style={[styles.dayCellText, { color: colors.text }]}>
                      {cell.day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
              <Text style={styles.legendText}>Leave</Text>
            </View>
          </View>
        </View>

        {/* ── History List ── */}
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>
            {MONTH_SHORT[viewMonth]} {viewYear} Records
          </Text>

          {monthlyHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No records for this month</Text>
            </View>
          ) : (
            monthlyHistory.map((record, idx) => {
              const recordDate = new Date((record as any).date ?? (record as any).punchIn ?? 0);
              const dayNum = recordDate.getDate();
              const monthAbbr = MONTH_SHORT[recordDate.getMonth()];
              const dayName = recordDate.toLocaleDateString('en-US', { weekday: 'long' });
              const fullDateStr = recordDate.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const status = resolveRecordStatus(record);
              const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES['on-time'];
              const isRemote = (record as any).isRemote ?? false;

              const punchIn = (record as any).punchIn
                ? formatTime12Short(new Date((record as any).punchIn))
                : '--:--';
              const punchOut = (record as any).punchOut
                ? formatTime12Short(new Date((record as any).punchOut))
                : '--:--';
              const totalHours = (record as any).workingHours ?? '--';

              return (
                <View key={idx} style={styles.historyCard}>
                  {/* Left: date circle */}
                  <View style={styles.dateCircle}>
                    <Text style={styles.dateCircleDay}>{dayNum}</Text>
                    <Text style={styles.dateCircleMonth}>{monthAbbr}</Text>
                  </View>

                  {/* Separator */}
                  <View style={styles.verticalSeparator} />

                  {/* Content */}
                  <View style={styles.historyContent}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyDayName}>{dayName}</Text>
                      <View style={styles.historyBadgesRow}>
                        {isRemote && (
                          <View style={styles.remoteBadge}>
                            <Text style={styles.remoteBadgeText}>Remote</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusStyle.bg },
                          ]}
                        >
                          <Text
                            style={[styles.statusBadgeText, { color: statusStyle.text }]}
                          >
                            {statusStyle.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.historyDateStr}>{fullDateStr}</Text>

                    {status !== 'absent' && status !== 'leave' && (
                      <View style={styles.historyTimesRow}>
                        <View style={styles.historyTimeItem}>
                          <Ionicons name="log-in-outline" size={13} color="#16A34A" />
                          <Text style={styles.historyTimeText}>{punchIn}</Text>
                        </View>
                        <View style={styles.historyTimeDot} />
                        <View style={styles.historyTimeItem}>
                          <Ionicons name="log-out-outline" size={13} color="#DC2626" />
                          <Text style={styles.historyTimeText}>{punchOut}</Text>
                        </View>
                        <View style={styles.historyTimeDot} />
                        <View style={styles.historyTimeItem}>
                          <Ionicons name="time-outline" size={13} color="#2563EB" />
                          <Text style={styles.historyTimeText}>{totalHours}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollView: {
    flex: 1,
  },
  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  // Calendar card
  calendarCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayHeaderCell: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  dayCellWrapper: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  // History list
  historySection: {
    marginHorizontal: 16,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 12,
  },
  dateCircleDay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 18,
  },
  dateCircleMonth: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  verticalSeparator: {
    width: 1,
    height: 52,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  historyDayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  historyBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  remoteBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  remoteBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C3AED',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyDateStr: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  historyTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  historyTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  historyTimeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  historyTimeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
});
