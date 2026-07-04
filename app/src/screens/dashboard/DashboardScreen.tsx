import React, { useMemo, useEffect, useState } from 'react';
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
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAttendance } from '../../context/AttendanceContext';
import { useAuth } from '../../context/AuthContext';

type RootStackParamList = {
  Main: undefined;
  ApplyLeave: undefined;
  AttendanceHistory: undefined;
  Notifications: undefined;
  AnnouncementDetail: { announcementId: string };
  LeaveHistory: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  General:     { bg: '#EFF6FF', text: '#2563EB' },
  Leave:       { bg: '#DCFCE7', text: '#16A34A' },
  HR:          { bg: '#FEF3C7', text: '#D97706' },
  Finance:     { bg: '#EDE9FE', text: '#7C3AED' },
  Operations:  { bg: '#FFF1F2', text: '#BE123C' },
  Announcement:{ bg: '#EFF6FF', text: '#2563EB' },
};

function getGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: 'Good Morning', emoji: '🌅' };
  if (hour < 17) return { greeting: 'Good Afternoon', emoji: '☀️' };
  return { greeting: 'Good Evening', emoji: '🌙' };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { status, todayRecord, workingSeconds, attendanceHistory } = useAttendance();
  const { user } = useAuth();

  const { greeting, emoji } = useMemo(() => getGreeting(), []);
  const userName = user?.name || 'Employee';
  const initials = getInitials(userName);

  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(q, snap => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const punchInTime = todayRecord?.clockIn ?? '--:--';
  const hh = Math.floor(workingSeconds / 3600);
  const mm = Math.floor((workingSeconds % 3600) / 60);
  const workingHours = workingSeconds > 0 ? `${hh}h ${mm}m` : '0h 0m';

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
    const leaveDays = monthRecords.filter(r => r.status === 'on_leave' || r.status === 'Leave').length;
    return {
      presentDays,
      leaveDays,
      workingHours: totalH > 0 ? `${totalH}h` : '0h',
      attendancePercentage: attendancePct,
    };
  }, [attendanceHistory]);

  const isClockedIn = status === 'active';
  const isClockedOut = status === 'clocked_out';
  const todayStatusLabel = isClockedIn ? 'Present' : isClockedOut ? 'Completed' : 'Not In';
  const todayStatusColor = isClockedIn ? '#16A34A' : isClockedOut ? '#2563EB' : '#D97706';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingText}>{greeting}, {emoji}</Text>
              <Text style={styles.userNameText}>{userName}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Notifications')}
                style={styles.notificationBtn}
              >
                <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
          </View>

          <View style={styles.todayStatusCard}>
            <View style={styles.todayStatusRow}>
              <Text style={styles.todayStatusLabel}>Today's Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: todayStatusColor }]}>
                <Text style={styles.statusBadgeText}>{todayStatusLabel}</Text>
              </View>
            </View>
            <View style={styles.todayStatusInfoRow}>
              <View style={styles.todayInfoItem}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.todayInfoText}>In: {punchInTime}</Text>
              </View>
              <View style={styles.todayStatusDivider} />
              <View style={styles.todayInfoItem}>
                <Ionicons name="timer-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.todayInfoText}>{workingHours}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => (navigation as any).navigate('Main', { screen: 'Attendance' })}
            >
              <View style={[styles.quickActionCircle, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="finger-print" size={28} color="#2563EB" />
              </View>
              <Text style={styles.quickActionLabel}>Punch In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => (navigation as any).navigate('Main', { screen: 'Attendance' })}
            >
              <View style={[styles.quickActionCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={28} color="#DC2626" />
              </View>
              <Text style={styles.quickActionLabel}>Punch Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => navigation.navigate('ApplyLeave')}
            >
              <View style={[styles.quickActionCircle, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="calendar-outline" size={28} color="#16A34A" />
              </View>
              <Text style={styles.quickActionLabel}>Apply Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => navigation.navigate('AttendanceHistory')}
            >
              <View style={[styles.quickActionCircle, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="time-outline" size={28} color="#7C3AED" />
              </View>
              <Text style={styles.quickActionLabel}>Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Announcements ── */}
        <View style={styles.announcementsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Announcements</Text>
          </View>

          {announcements.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="megaphone-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          )}

          {announcements.map((item) => {
            const catColors = CATEGORY_COLORS[item.category] ?? { bg: '#F1F5F9', text: '#64748B' };
            const timeAgo = item.createdAt?.toDate
              ? getTimeAgo(item.createdAt.toDate())
              : '';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.announcementCard}
                activeOpacity={0.75}
              >
                <View style={styles.announcementTopRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: catColors.bg }]}>
                    <Text style={[styles.categoryBadgeText, { color: catColors.text }]}>
                      {item.category || 'General'}
                    </Text>
                  </View>
                  <Text style={styles.announcementDate}>{timeAgo}</Text>
                </View>
                <Text style={styles.announcementTitle}>{item.title}</Text>
                <Text style={styles.announcementSnippet} numberOfLines={2}>
                  {item.body || item.snippet || ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Monthly Summary ── */}
        <View style={styles.monthlySummaryCard}>
          <Text style={styles.sectionTitle}>Monthly Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryBox, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{monthlySummary.presentDays}</Text>
              <Text style={[styles.summaryLabel, { color: '#16A34A' }]}>Present Days</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.summaryValue, { color: '#D97706' }]}>{monthlySummary.leaveDays}</Text>
              <Text style={[styles.summaryLabel, { color: '#D97706' }]}>Leave Days</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.summaryValue, { color: '#2563EB' }]}>{monthlySummary.workingHours}</Text>
              <Text style={[styles.summaryLabel, { color: '#2563EB' }]}>Working Hrs</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.summaryValue, { color: '#7C3AED' }]}>{monthlySummary.attendancePercentage}%</Text>
              <Text style={[styles.summaryLabel, { color: '#7C3AED' }]}>Attendance</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  scrollView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 32 },
  headerTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  greetingContainer: { flex: 1 },
  greetingText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  userNameText: { fontSize: 20, color: '#FFFFFF', fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#2563EB' },
  todayStatusCard: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12,
  },
  todayStatusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  todayStatusLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  todayStatusInfoRow: { flexDirection: 'row', alignItems: 'center' },
  todayInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayInfoText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  todayStatusDivider: {
    width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 14,
  },
  quickActionsCard: {
    backgroundColor: '#FFFFFF', margin: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 8 },
  quickActionItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  quickActionCircle: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  quickActionLabel: { fontSize: 11, color: '#64748B', textAlign: 'center', fontWeight: '500' },
  announcementsSection: { marginHorizontal: 16, marginBottom: 4 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 8,
  },
  emptyText: { fontSize: 13, color: '#94A3B8' },
  announcementCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  announcementTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  categoryBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  categoryBadgeText: { fontSize: 11, fontWeight: '600' },
  announcementDate: { fontSize: 11, color: '#94A3B8' },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  announcementSnippet: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  monthlySummaryCard: {
    backgroundColor: '#FFFFFF', margin: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryBox: { width: '47%', borderRadius: 12, padding: 14, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  summaryLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
});
