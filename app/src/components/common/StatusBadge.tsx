import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Typography } from '../../theme/colors';
import type { PunchStatus, LeaveStatus, AttendanceStatus } from '../../types';

type BadgeVariant = PunchStatus | LeaveStatus | AttendanceStatus;

const BADGE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  on_time:        { bg: '#DCFCE7', text: '#16A34A', label: 'On Time' },
  late:           { bg: '#FEF3C7', text: '#D97706', label: 'Late' },
  absent:         { bg: '#FEE2E2', text: '#DC2626', label: 'Absent' },
  half_day:       { bg: '#EDE9FE', text: '#7C3AED', label: 'Half Day' },
  approved:       { bg: '#DCFCE7', text: '#16A34A', label: 'Approved' },
  pending:        { bg: '#FEF3C7', text: '#D97706', label: 'Pending' },
  rejected:       { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
  active:         { bg: '#DCFCE7', text: '#16A34A', label: 'Active' },
  clocked_out:    { bg: '#EFF6FF', text: '#2563EB', label: 'Clocked Out' },
  not_clocked_in: { bg: '#F1F5F9', text: '#64748B', label: 'Not Clocked In' },
  present:        { bg: '#DCFCE7', text: '#16A34A', label: 'Present' },
};

interface Props {
  variant: BadgeVariant | string;
  size?: 'sm' | 'md';
  label?: string;
}

export default function StatusBadge({ variant, size = 'md', label }: Props) {
  const config = BADGE_CONFIG[variant] ?? { bg: '#F1F5F9', text: '#64748B', label: variant };
  const displayLabel = label ?? config.label;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.text, { color: config.text }, size === 'sm' && styles.textSm]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    ...Typography.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 10,
  },
});
