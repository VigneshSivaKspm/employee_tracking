import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAttendance } from '../../context/AttendanceContext';
import type { LeaveRequest, LeaveStatus } from '../../types';

type FilterTab = 'All' | 'Pending' | 'Approved' | 'Rejected';

const TABS: FilterTab[] = ['All', 'Pending', 'Approved', 'Rejected'];

const LEAVE_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  casual:    { icon: 'sunny-outline',     bg: '#EFF6FF', color: '#2563EB' },
  sick:      { icon: 'medical-outline',   bg: '#FEE2E2', color: '#DC2626' },
  earned:    { icon: 'star-outline',      bg: '#DCFCE7', color: '#16A34A' },
  annual:    { icon: 'umbrella-outline',  bg: '#EDE9FE', color: '#7C3AED' },
  personal:  { icon: 'person-outline',   bg: '#FEF3C7', color: '#D97706' },
  maternity: { icon: 'heart-outline',    bg: '#FDF2F8', color: '#DB2777' },
  paternity: { icon: 'people-outline',   bg: '#EFF6FF', color: '#2563EB' },
  unpaid:    { icon: 'cash-outline',     bg: '#F9FAFB', color: '#6B7280' },
};

const STATUS_CONFIG = {
  approved: { bg: '#DCFCE7', text: '#16A34A', label: 'Approved' },
  pending:  { bg: '#FEF3C7', text: '#D97706', label: 'Pending' },
  rejected: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function LeaveCard({ leave }: { leave: LeaveRequest }) {
  const icon = LEAVE_ICONS[leave.type] ?? LEAVE_ICONS.casual;
  const statusKey = (leave.status || 'pending').toLowerCase() as LeaveStatus;
  const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const typeName = leave.type.charAt(0).toUpperCase() + leave.type.slice(1) + ' Leave';

  return (
    <View style={styles.leaveCard}>
      <View style={styles.leaveCardTop}>
        <View style={styles.leaveCardLeft}>
          <View style={[styles.leaveIconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.icon as any} size={20} color={icon.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.leaveTypeName}>{typeName}</Text>
            <View style={styles.leaveDateRow}>
              <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
              <Text style={styles.leaveDateText}>
                {formatDate(leave.startDate)}{leave.startDate !== leave.endDate ? ` – ${formatDate(leave.endDate)}` : ''}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusBadgeText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.leaveDivider} />

      <Text style={styles.leaveReason} numberOfLines={2}>{leave.reason}</Text>

      <View style={styles.leaveCardBottom}>
        <Text style={styles.leaveAppliedOn}>Applied: {formatDate(leave.appliedOn)}</Text>
        <View style={styles.leaveCardBottomRight}>
          <Text style={styles.leaveDays}>{leave.totalDays} {leave.totalDays === 1 ? 'Day' : 'Days'}</Text>
          {leave.hasDocument && (
            <View style={styles.docBadge}>
              <Ionicons name="attach-outline" size={12} color="#7C3AED" />
              <Text style={styles.docBadgeText}>Doc</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function LeaveHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { leaveRequests } = useAttendance();
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

  const filtered = activeTab === 'All'
    ? leaveRequests
    : leaveRequests.filter(l => l.status === activeTab.toLowerCase() as LeaveStatus);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave History</Text>
          <View style={styles.backBtn} />
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Leave List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No leaves found</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'All' ? 'You have no leave requests.' : `No ${activeTab.toLowerCase()} leaves.`}
            </Text>
          </View>
        ) : (
          filtered.map((leave) => <LeaveCard key={leave.id} leave={leave} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  leaveCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leaveCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  leaveIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveTypeName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  leaveDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leaveDateText: { fontSize: 12, color: '#64748B' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  leaveDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  leaveReason: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 12 },
  leaveCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leaveAppliedOn: { fontSize: 12, color: '#94A3B8' },
  leaveCardBottomRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaveDays: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  docBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  docBadgeText: { fontSize: 11, fontWeight: '600', color: '#7C3AED' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 6 },
});
