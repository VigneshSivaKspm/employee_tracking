import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

interface Target {
  id: string;
  title: string;
  description?: string;
  targetValue: number;
  achievedValue: number;
  unit?: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'Overdue' | 'Draft';
  department?: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  Active:    { bg: '#EFF6FF', text: '#2563EB' },
  Completed: { bg: '#DCFCE7', text: '#16A34A' },
  Overdue:   { bg: '#FEE2E2', text: '#DC2626' },
  Draft:     { bg: '#F1F5F9', text: '#64748B' },
};

export default function TargetsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.employeeId && !user?.id) { setLoading(false); return; }
    const q = query(
      collection(db, 'targets'),
      where('employeeId', 'in', [user.employeeId, user.id].filter(Boolean)),
      orderBy('endDate', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setTargets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Target)));
      setLoading(false);
      setRefreshing(false);
    }, () => { setLoading(false); setRefreshing(false); });
    return unsub;
  }, [user?.employeeId, user?.id]);

  const active    = targets.filter(t => t.status === 'Active');
  const completed = targets.filter(t => t.status === 'Completed');
  const overdue   = targets.filter(t => t.status === 'Overdue');

  function pct(t: Target) {
    return t.targetValue > 0 ? Math.min(100, Math.round((t.achievedValue / t.targetValue) * 100)) : 0;
  }

  function barColor(p: number) {
    if (p >= 100) return '#16A34A';
    if (p >= 60)  return '#2563EB';
    return '#D97706';
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.headerTitle}>My Targets</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Active', value: active.length, color: '#93C5FD' },
            { label: 'Done', value: completed.length, color: '#86EFAC' },
            { label: 'Overdue', value: overdue.length, color: '#FCA5A5' },
          ].map(s => (
            <View key={s.label} style={styles.statPill}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} />}
        >
          {targets.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Targets Assigned</Text>
              <Text style={styles.emptySubtitle}>Your targets will appear here once assigned by admin.</Text>
            </View>
          )}

          {targets.map(t => {
            const p = pct(t);
            const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.Draft;
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{t.status}</Text>
                  </View>
                </View>
                {t.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text>
                ) : null}

                <View style={styles.progressRow}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressBar, { width: `${p}%`, backgroundColor: barColor(p) }]} />
                  </View>
                  <Text style={[styles.pctText, { color: barColor(p) }]}>{p}%</Text>
                </View>

                <View style={styles.valueRow}>
                  <Text style={styles.valueText}>
                    {t.achievedValue}{t.unit || ''} / {t.targetValue}{t.unit || ''}
                  </Text>
                  <Text style={styles.dateText}>{t.startDate} → {t.endDate}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardDesc: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  progressBg: { flex: 1, height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 4 },
  pctText: { fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valueText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  dateText: { fontSize: 11, color: '#94A3B8' },
});
