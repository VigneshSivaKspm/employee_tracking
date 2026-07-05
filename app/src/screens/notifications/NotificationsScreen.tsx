import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import {
  collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTopInset } from '../../hooks/useBottomSpacing';
import { useAuth } from '../../context/AuthContext';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time?: string;
  createdAt?: any;
  type: 'leave' | 'announcement' | 'salary' | 'attendance' | 'general';
  isRead: boolean;
  userId?: string;
}

const TYPE_CONFIG: Record<string, { icon: string; bg: string; color: string }> = {
  leave:        { icon: 'calendar-outline',           bg: '#DCFCE7', color: '#16A34A' },
  announcement: { icon: 'megaphone-outline',          bg: '#EFF6FF', color: '#2563EB' },
  salary:       { icon: 'card-outline',               bg: '#EDE9FE', color: '#7C3AED' },
  attendance:   { icon: 'time-outline',               bg: '#FEF3C7', color: '#D97706' },
  general:      { icon: 'information-circle-outline', bg: '#F1F5F9', color: '#64748B' },
};

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const headerTop = useTopInset(12);
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [user.id, 'all']),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem)));
    });
    return unsub;
  }, [user?.id]);

  async function markRead(id: string) {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  }

  async function markAllRead() {
    const batch = writeBatch(db);
    notifications.filter(n => !n.isRead).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
          const timeStr = item.createdAt?.toDate
            ? getTimeAgo(item.createdAt.toDate())
            : (item.time ?? '');
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
                <Text style={styles.notifTime}>{timeStr}</Text>
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
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  unreadBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  markReadBtn: { width: 80, alignItems: 'flex-end' },
  markReadText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },
  notifCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#F0F7FF', borderLeftWidth: 3, borderLeftColor: '#2563EB',
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginLeft: 8 },
  notifBody: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 6 },
  notifTime: { fontSize: 11, color: '#94A3B8' },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 6 },
});
