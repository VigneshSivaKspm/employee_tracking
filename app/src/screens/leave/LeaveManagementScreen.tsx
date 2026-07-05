import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAttendance } from '../../context/AttendanceContext';
import StatusBadge from '../../components/common/StatusBadge';
import { Colors, Spacing, BorderRadius, Typography, Shadow } from '../../theme/colors';
import type { LeaveRequest, LeaveStatus, RootStackParamList } from '../../types';
import { useTabScreenBottomPadding } from '../../hooks/useBottomSpacing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── helpers ────────────────────────────────────────────────────────────────

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  earned: 'Earned Leave',
  personal: 'Personal Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  unpaid: 'Unpaid Leave',
};

const STATUS_BAR_COLOR: Record<LeaveStatus, string> = {
  approved: Colors.success,
  pending: Colors.warning,
  rejected: Colors.danger,
};

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[parseInt(m, 10) - 1]} ${y}`;
  };
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

// ─── Leave Card ─────────────────────────────────────────────────────────────

function UpcomingLeaveCard({ leave }: { leave: LeaveRequest }) {
  const barColor = STATUS_BAR_COLOR[leave.status] ?? Colors.text.muted;
  const typeLabel = LEAVE_TYPE_LABELS[leave.type] ?? leave.type;

  return (
    <View style={styles.leaveCard}>
      {/* Left accent bar */}
      <View style={[styles.leaveAccentBar, { backgroundColor: barColor }]} />

      {/* Content */}
      <View style={styles.leaveCardContent}>
        <View style={styles.leaveCardTop}>
          <View style={styles.leaveCardLeft}>
            <Text style={styles.leaveDateRange}>{formatDateRange(leave.startDate, leave.endDate)}</Text>
            <Text style={styles.leaveTypeLine} numberOfLines={1}>
              {typeLabel}
              {leave.reason ? ` · ${leave.reason}` : ''}
            </Text>
          </View>

          <View style={styles.leaveCardRight}>
            <View style={styles.daysCountBadge}>
              <Text style={styles.daysCountNumber}>{leave.totalDays}</Text>
              <Text style={styles.daysCountLabel}>{leave.totalDays === 1 ? 'Day' : 'Days'}</Text>
            </View>
            <View style={styles.statusBadgeWrap}>
              <StatusBadge variant={leave.status} size="sm" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function LeaveManagementScreen() {
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabScreenBottomPadding();
  const navigation = useNavigation<Nav>();
  const { leaveRequests, leaveBalance } = useAttendance();

  // Show upcoming / recent leaves (pending or approved future)
  const upcomingLeaves = leaveRequests.slice(0, 5);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Blue Gradient Header ── */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Leave</Text>
            <TouchableOpacity
              style={styles.applyPillBtn}
              onPress={() => navigation.navigate('ApplyLeave')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#2563EB" />
              <Text style={styles.applyPillBtnText}>Apply Leave</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Available Balance Card ── */}
        <View style={[styles.balanceCard, { marginTop: -1 }]}>
          <Text style={styles.balanceCardTitle}>Available Balance</Text>
          <View style={styles.balancePillRow}>
            {/* Casual */}
            <View style={[styles.balancePill, { backgroundColor: Colors.primaryLight }]}>
              <Text style={[styles.balancePillNumber, { color: Colors.primary }]}>
                {String(leaveBalance.casual ?? 5).padStart(2, '0')}
              </Text>
              <Text style={[styles.balancePillLabel, { color: Colors.text.secondary }]}>Casual</Text>
            </View>
            {/* Sick */}
            <View style={[styles.balancePill, { backgroundColor: Colors.warningLight }]}>
              <Text style={[styles.balancePillNumber, { color: Colors.warning }]}>
                {String(leaveBalance.sick ?? 3).padStart(2, '0')}
              </Text>
              <Text style={[styles.balancePillLabel, { color: Colors.text.secondary }]}>Sick</Text>
            </View>
            {/* Earned */}
            <View style={[styles.balancePill, { backgroundColor: Colors.successLight }]}>
              <Text style={[styles.balancePillNumber, { color: Colors.success }]}>
                {String(leaveBalance.earned ?? 7).padStart(2, '0')}
              </Text>
              <Text style={[styles.balancePillLabel, { color: Colors.text.secondary }]}>Earned</Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions Card ── */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionHeading}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionBtnFill}
              onPress={() => navigation.navigate('ApplyLeave')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.quickActionBtnFillText}>Apply Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtnOutline}
              onPress={() => navigation.navigate('LeaveHistory')}
              activeOpacity={0.85}
            >
              <Ionicons name="list-outline" size={18} color={Colors.primary} />
              <Text style={styles.quickActionBtnOutlineText}>Leave History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Upcoming Leaves ── */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionHeading}>Upcoming Leaves</Text>
          {upcomingLeaves.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color={Colors.text.muted} />
              <Text style={styles.emptyText}>No leave requests yet</Text>
            </View>
          ) : (
            upcomingLeaves.map(leave => (
              <UpcomingLeaveCard key={leave.id} leave={leave} />
            ))
          )}

          {leaveRequests.length > 5 && (
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => navigation.navigate('LeaveHistory')}
              activeOpacity={0.75}
            >
              <Text style={styles.viewAllBtnText}>View All Requests</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scroll: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  applyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  applyPillBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Balance Card
  balanceCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    ...Shadow.md,
    padding: 20,
  },
  balanceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  balancePillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  balancePill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balancePillNumber: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  balancePillLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },

  // Quick Actions
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    ...Shadow.md,
    padding: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  quickActionBtnFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
  },
  quickActionBtnFillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  quickActionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Section heading (shared)
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },

  // Upcoming Leaves section
  upcomingSection: {
    marginHorizontal: 16,
    marginTop: 22,
    gap: 8,
  },

  // Leave Card
  leaveCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  leaveAccentBar: {
    width: 4,
  },
  leaveCardContent: {
    flex: 1,
    padding: 14,
  },
  leaveCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  leaveCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  leaveDateRange: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 3,
  },
  leaveTypeLine: {
    fontSize: 12,
    color: '#64748B',
  },
  leaveCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  daysCountBadge: {
    alignItems: 'center',
  },
  daysCountNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 20,
  },
  daysCountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  statusBadgeWrap: {
    alignItems: 'flex-end',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },

  // View all button
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 4,
  },
  viewAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
});
