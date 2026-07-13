import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAttendance } from '../../context/AttendanceContext';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';
import { LOGO } from '../../constants/brand';

type RootStackParamList = {
  Main: undefined;
  Attendance: undefined;
  ApplyLeave: undefined;
  AttendanceHistory: undefined;
  Notifications: undefined;
  AnnouncementDetail: { announcementId: string };
  LeaveHistory: undefined;
  Analytics: undefined;
  AudioRecordings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

function getGreeting(): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: 'Good Morning', subtitle: 'Ready to conquer the day?' };
  if (hour < 17) return { greeting: 'Good Afternoon', subtitle: 'Keep up the great work!' };
  return { greeting: 'Good Evening', subtitle: 'Hope you had a productive day.' };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatElapsed(seconds: number): string {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return `${padTwo(hh)}:${padTwo(mm)}:${padTwo(ss)}`;
}

function formatClockInDisplay(clockIn: string): string {
  const parts = clockIn.split(':').map(Number);
  const [h24, m] = parts;
  if (Number.isNaN(h24) || Number.isNaN(m)) return clockIn;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${padTwo(h12)}:${padTwo(m)} ${ampm}`;
}

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  General: 'megaphone-outline',
  Leave: 'calendar-outline',
  HR: 'people-outline',
  Finance: 'card-outline',
  Operations: 'settings-outline',
  Announcement: 'notifications-outline',
};

const CATEGORY_COLOR: Record<string, { bg: string; icon: string }> = {
  General:      { bg: '#EFF6FF', icon: '#2563EB' },
  Leave:        { bg: '#DCFCE7', icon: '#16A34A' },
  HR:           { bg: '#FEF3C7', icon: '#D97706' },
  Finance:      { bg: '#EDE9FE', icon: '#7C3AED' },
  Operations:   { bg: '#FFF1F2', icon: '#BE123C' },
  Announcement: { bg: '#EFF6FF', icon: '#2563EB' },
};

export default function DashboardScreen() {
  const headerTop = useTopInset(16);
  const navigation = useNavigation<NavigationProp>();
  const { status, todayRecord, workingSeconds, attendanceHistory } = useAttendance();
  const { user } = useAuth();

  const { greeting, subtitle } = useMemo(() => getGreeting(), []);
  const bottomPadding = useTabScreenBottomPadding();
  const userName = user?.name || 'Employee';
  const initials = getInitials(userName);
  const firstName = userName.split(' ')[0];

  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(q, snap => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const punchInTime = todayRecord?.clockIn ?? null;
  const isClockedIn = status === 'active';
  const isClockedOut = status === 'clocked_out';
  const workingHoursStr = isClockedIn
    ? formatElapsed(workingSeconds)
    : isClockedOut && todayRecord?.totalHours
    ? `${todayRecord.totalHours.toFixed(1)}h total`
    : '—';

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7);
    const monthRecords = attendanceHistory.filter(r => r.date?.startsWith(monthStr));
    const presentDays = monthRecords.filter(r => r.clockIn && r.status !== 'absent').length;
    const totalMinutes = monthRecords.reduce((sum, r) => {
      if (!r.clockIn || !r.clockOut) return sum;
      const [ih, im] = r.clockIn.split(':').map(Number);
      const [oh, om] = r.clockOut.split(':').map(Number);
      return sum + (oh * 60 + om) - (ih * 60 + im);
    }, 0);
    const totalH = Math.floor(totalMinutes / 60);
    const workingDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const attendancePct = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
    const leaveDays = monthRecords.filter(r => (r.status as string) === 'on_leave' || (r.status as string) === 'Leave').length;
    return {
      presentDays,
      leaveDays,
      workingHours: totalH > 0 ? `${totalH}h` : '0h',
      attendancePercentage: attendancePct,
    };
  }, [attendanceHistory]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const quickActions = [
    {
      label: 'Attendance',
      icon: 'finger-print' as const,
      gradient: ['#2563EB', '#1D4ED8'] as [string, string],
      onPress: () => navigation.navigate('Attendance'),
    },
    {
      label: 'Apply Leave',
      icon: 'calendar' as const,
      gradient: ['#059669', '#047857'] as [string, string],
      onPress: () => navigation.navigate('ApplyLeave'),
    },
    {
      label: 'History',
      icon: 'time' as const,
      gradient: ['#7C3AED', '#6D28D9'] as [string, string],
      onPress: () => navigation.navigate('AttendanceHistory'),
    },
    {
      label: 'Leaves',
      icon: 'document-text' as const,
      gradient: ['#D97706', '#B45309'] as [string, string],
      onPress: () => navigation.navigate('LeaveHistory'),
    },
    {
      label: 'Analytics',
      icon: 'bar-chart' as const,
      gradient: ['#0891B2', '#0E7490'] as [string, string],
      onPress: () => navigation.navigate('Analytics'),
    },
    {
      label: 'Voice Notes',
      icon: 'mic' as const,
      gradient: ['#DB2777', '#BE185D'] as [string, string],
      onPress: () => navigation.navigate('AudioRecordings'),
    },
  ];

  const summaryStats = [
    { label: 'Present', value: monthlySummary.presentDays, unit: 'days', color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' as const },
    { label: 'Leave', value: monthlySummary.leaveDays, unit: 'days', color: '#D97706', bg: '#FFFBEB', icon: 'calendar-clear' as const },
    { label: 'Hours', value: monthlySummary.workingHours, unit: 'total', color: '#2563EB', bg: '#EFF6FF', icon: 'timer' as const },
    { label: 'Rate', value: `${monthlySummary.attendancePercentage}%`, unit: 'attend.', color: '#7C3AED', bg: '#F5F3FF', icon: 'trending-up' as const },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#1E3A8A', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: headerTop }]}
        >
          {/* Decorative circles */}
          <View style={styles.decor1} />
          <View style={styles.decor2} />

          {/* Top row */}
          <View style={styles.headerTopRow}>
            <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateText}>{dateStr}</Text>
              <Text style={styles.greetingText}>{greeting}, {firstName}!</Text>
              <Text style={styles.subtitleText}>{subtitle}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Notifications')}
                style={styles.notificationBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarCircle} activeOpacity={0.85}>
                <Text style={styles.avatarText}>{initials}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusCardTop}>
              <View style={styles.statusLeft}>
                <View style={[
                  styles.statusIndicator,
                  isClockedIn && styles.statusIndicatorPulse,
                  { backgroundColor: isClockedIn ? '#22C55E' : isClockedOut ? '#60A5FA' : '#FBD040' }
                ]} />
                <View>
                  <Text style={styles.statusCardLabel}>Today's Status</Text>
                  <Text style={styles.statusCardValue}>
                    {isClockedIn ? 'Clocked In' : isClockedOut ? 'Day Complete' : 'Not Started'}
                  </Text>
                </View>
              </View>
              {isClockedIn && (
                <View style={styles.liveTimerBlock}>
                  <Text style={styles.liveTimerValue}>{workingHoursStr}</Text>
                  <Text style={styles.liveTimerLabel}>Working Time</Text>
                </View>
              )}
            </View>
            {(punchInTime || isClockedOut) && (
              <View style={styles.statusCardBottom}>
                {punchInTime ? (
                  <View style={styles.statusInfoItem}>
                    <Ionicons name="log-in-outline" size={14} color="rgba(255,255,255,0.65)" />
                    <Text style={styles.statusInfoText}>In at {formatClockInDisplay(punchInTime)}</Text>
                  </View>
                ) : null}
                {isClockedOut && todayRecord?.clockOut ? (
                  <View style={styles.statusInfoItem}>
                    <Ionicons name="log-out-outline" size={14} color="rgba(255,255,255,0.65)" />
                    <Text style={styles.statusInfoText}>Out at {formatClockInDisplay(todayRecord.clockOut)}</Text>
                  </View>
                ) : isClockedIn ? (
                  <View style={styles.statusInfoItem}>
                    <Ionicons name="pulse-outline" size={14} color="#86EFAC" />
                    <Text style={[styles.statusInfoText, styles.statusLiveText]}>Timer running</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickActionItem}
                onPress={action.onPress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={action.gradient}
                  style={styles.quickActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={action.icon} size={26} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Monthly Summary ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Monthly Summary</Text>
            <Text style={styles.sectionMeta}>
              {now.toLocaleString('en-US', { month: 'long' })} {now.getFullYear()}
            </Text>
          </View>
          <View style={styles.statsGrid}>
            {summaryStats.map((stat, idx) => (
              <View key={idx} style={[styles.statCard, { backgroundColor: stat.bg }]}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.color + '20' }]}>
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: stat.color + 'AA' }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {/* Attendance progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Attendance Rate</Text>
              <Text style={styles.progressValue}>{monthlySummary.attendancePercentage}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(monthlySummary.attendancePercentage, 100)}%` as any,
                  backgroundColor: monthlySummary.attendancePercentage >= 80
                    ? '#16A34A'
                    : monthlySummary.attendancePercentage >= 60
                    ? '#D97706'
                    : '#DC2626',
                }
              ]} />
            </View>
          </View>
        </View>

        {/* ── Announcements ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {announcements.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{announcements.length}</Text>
              </View>
            )}
          </View>

          {announcements.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="megaphone-outline" size={28} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No announcements</Text>
              <Text style={styles.emptySubtitle}>Check back later for updates from your team.</Text>
            </View>
          ) : (
            announcements.map((item) => {
              const cat = item.category || 'General';
              const catColor = CATEGORY_COLOR[cat] ?? { bg: '#F1F5F9', icon: '#64748B' };
              const catIcon = CATEGORY_ICON[cat] ?? 'megaphone-outline';
              const timeAgo = item.createdAt?.toDate ? getTimeAgo(item.createdAt.toDate()) : '';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.announcementCard}
                  activeOpacity={0.75}
                >
                  <View style={[styles.announcementIcon, { backgroundColor: catColor.bg }]}>
                    <Ionicons name={catIcon} size={18} color={catColor.icon} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.announcementTopRow}>
                      <Text style={styles.announcementTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.announcementTime}>{timeAgo}</Text>
                    </View>
                    <Text style={styles.announcementBody} numberOfLines={2}>
                      {item.body || item.snippet || ''}
                    </Text>
                    <View style={[styles.categoryPill, { backgroundColor: catColor.bg }]}>
                      <Text style={[styles.categoryPillText, { color: catColor.icon }]}>{cat}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
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

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  decor1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decor2: {
    position: 'absolute',
    bottom: -40,
    right: 60,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginTop: 2,
    flexShrink: 0,
  },
  dateText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  greetingText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Status Card
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusIndicatorPulse: {
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  liveTimerBlock: {
    alignItems: 'flex-end',
  },
  liveTimerValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  liveTimerLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusCardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statusCardValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusInfoText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  statusLiveText: {
    color: '#86EFAC',
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
  },

  // Monthly Summary
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: (width - 32 - 10) / 2,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Progress Bar
  progressContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Count badge
  countBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Empty State
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Announcement Cards
  announcementCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  announcementIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  announcementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
    lineHeight: 18,
  },
  announcementTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    flexShrink: 0,
  },
  announcementBody: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 8,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
