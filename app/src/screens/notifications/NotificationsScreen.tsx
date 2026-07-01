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

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'leave' | 'announcement' | 'salary' | 'attendance' | 'general';
  isRead: boolean;
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Team Meeting Tomorrow',
    body: "Don't forget the team meeting at 11:00 AM in Conference Room.",
    time: '2h ago',
    type: 'announcement',
    isRead: false,
  },
  {
    id: '2',
    title: 'Leave Approved',
    body: 'Your leave has been approved by John Manager.',
    time: '5h ago',
    type: 'leave',
    isRead: false,
  },
  {
    id: '3',
    title: 'New Announcement',
    body: 'Company picnic on 30th June. Check details now.',
    time: '1d ago',
    type: 'announcement',
    isRead: true,
  },
  {
    id: '4',
    title: 'Salary Slip',
    body: 'Your salary slip for June is now available.',
    time: '2d ago',
    type: 'salary',
    isRead: true,
  },
  {
    id: '5',
    title: 'Attendance Reminder',
    body: 'You have not punched in yet today. Please mark your attendance.',
    time: '3d ago',
    type: 'attendance',
    isRead: true,
  },
];

const TYPE_CONFIG: Record<string, { icon: string; bg: string; color: string }> = {
  leave:        { icon: 'calendar-outline',      bg: '#DCFCE7', color: '#16A34A' },
  announcement: { icon: 'megaphone-outline',     bg: '#EFF6FF', color: '#2563EB' },
  salary:       { icon: 'card-outline',          bg: '#EDE9FE', color: '#7C3AED' },
  attendance:   { icon: 'time-outline',          bg: '#FEF3C7', color: '#D97706' },
  general:      { icon: 'information-circle-outline', bg: '#F1F5F9', color: '#64748B' },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={markAllRead} style={styles.markReadBtn}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((item) => {
          const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.general;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.notifCard, !item.isRead && styles.unreadCard]}
              onPress={() => markRead(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                <Ionicons name={config.icon as any} size={22} color={config.color} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.notifTime}>{item.time}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
          </View>
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
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  unreadBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  markReadBtn: { width: 80, alignItems: 'flex-end' },
  markReadText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginLeft: 8 },
  notifBody: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 6 },
  notifTime: { fontSize: 11, color: '#94A3B8' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 6 },
});
