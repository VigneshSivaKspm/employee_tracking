import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenBottomPadding } from '../../hooks/useBottomSpacing';
import { useEmployeeTargets } from '../../hooks/useEmployeeTargets';
import type { EmployeeTarget, TargetComment, TargetStatus } from '../../types';

type FilterTab = 'all' | 'active' | 'completed';

const QUICK_EMOJIS = ['👍', '✅', '🎉', '💪', '🚀', '📌', '🔥', '👏', '💯', '🙌'];

function resolveTargetType(t: EmployeeTarget): 'task' | 'multiple' {
  if (t.type === 'task' || t.type === 'multiple') return t.type;
  return t.targetValue > 0 || t.unit ? 'multiple' : 'task';
}

function pct(t: EmployeeTarget): number {
  const type = resolveTargetType(t);
  if (type === 'task') return normalizeTargetStatus(t.status) === 'Completed' ? 100 : 0;
  return t.targetValue > 0 ? Math.min(100, Math.round((t.achievedValue / t.targetValue) * 100)) : 0;
}

function barColor(p: number): string {
  if (p >= 100) return '#10B981';
  if (p >= 60) return '#3B82F6';
  return '#F59E0B';
}

function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATUS: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Active: { bg: '#DBEAFE', text: '#1D4ED8', icon: 'pulse' },
  Completed: { bg: '#D1FAE5', text: '#047857', icon: 'checkmark-circle' },
  Overdue: { bg: '#FEE2E2', text: '#B91C1C', icon: 'alert-circle' },
  Draft: { bg: '#F1F5F9', text: '#64748B', icon: 'document-text' },
};

const DEFAULT_STATUS = STATUS.Active;

function normalizeTargetStatus(status?: string): TargetStatus {
  const key = (status || 'Active').trim();
  const map: Record<string, TargetStatus> = {
    active: 'Active',
    completed: 'Completed',
    overdue: 'Overdue',
    draft: 'Draft',
    Active: 'Active',
    Completed: 'Completed',
    Overdue: 'Overdue',
    Draft: 'Draft',
  };
  return map[key] ?? map[key.toLowerCase()] ?? 'Active';
}

function targetStatusStyle(status?: string) {
  const normalized = normalizeTargetStatus(status);
  return STATUS[normalized] ?? DEFAULT_STATUS;
}

function isOwnComment(c: TargetComment, userId?: string): boolean {
  if (c.role === 'admin') return false;
  if (c.role === 'employee') return true;
  return Boolean(userId && c.authorId === userId);
}

export default function TargetsScreen() {
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabScreenBottomPadding();
  const { user } = useAuth();
  const { targets, loading } = useEmployeeTargets(user);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selected, setSelected] = useState<EmployeeTarget | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(true);

  useEffect(() => {
    if (!selected) return;
    const fresh = targets.find(t => t.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [targets, selected?.id]);

  useEffect(() => {
    if (!loading) setRefreshing(false);
  }, [loading, targets]);

  const filtered = useMemo(() => {
    if (filter === 'active') return targets.filter(t => { const s = normalizeTargetStatus(t.status); return s === 'Active' || s === 'Overdue'; });
    if (filter === 'completed') return targets.filter(t => normalizeTargetStatus(t.status) === 'Completed');
    return targets;
  }, [targets, filter]);

  const stats = useMemo(() => ({
    active: targets.filter(t => { const s = normalizeTargetStatus(t.status); return s === 'Active' || s === 'Overdue'; }).length,
    completed: targets.filter(t => normalizeTargetStatus(t.status) === 'Completed').length,
    overdue: targets.filter(t => normalizeTargetStatus(t.status) === 'Overdue').length,
  }), [targets]);

  async function updateTarget(id: string, data: Record<string, unknown>) {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'targets', id), { ...data, updatedAt: serverTimestamp() });
    } catch (e: unknown) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleMarkComplete(target: EmployeeTarget) {
    Alert.alert('Mark as completed?', `Confirm "${target.title}" is done.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () =>
          updateTarget(target.id, {
            status: 'Completed',
            achievedValue: resolveTargetType(target) === 'multiple' ? target.targetValue : 1,
          }),
      },
    ]);
  }

  async function handleIncrement(target: EmployeeTarget) {
    const next = Math.min(target.targetValue, target.achievedValue + 1);
    await updateTarget(target.id, {
      achievedValue: next,
      status: next >= target.targetValue ? 'Completed' : target.status,
    });
  }

  async function postComment(text: string) {
    if (!selected || !text.trim() || !user) return;
    const comment: TargetComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      authorName: user.name || 'Employee',
      authorId: user.id,
      role: 'employee',
      createdAt: new Date().toISOString(),
    };
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'targets', selected.id), {
        comments: arrayUnion(comment),
        updatedAt: serverTimestamp(),
      });
      setCommentText('');
    } catch (e: unknown) {
      Alert.alert('Comment failed', e instanceof Error ? e.message : 'Could not post.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderCard(t: EmployeeTarget) {
    const type = resolveTargetType(t);
    const p = pct(t);
    const st = targetStatusStyle(t.status);
    const done = normalizeTargetStatus(t.status) === 'Completed';
    const comments = t.comments?.length ?? 0;

    return (
      <Pressable key={t.id} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => setSelected(t)}>
        <View style={[styles.cardAccent, type === 'task' ? styles.accentTask : styles.accentTarget]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleBlock}>
              <View style={styles.typePill}>
                <Ionicons name={type === 'task' ? 'checkbox-outline' : 'flag-outline'} size={12} color={type === 'task' ? '#7C3AED' : '#D97706'} />
                <Text style={[styles.typePillText, type === 'task' ? styles.typeTask : styles.typeTarget]}>{type === 'task' ? 'Task' : 'Target'}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{t.title}</Text>
              {t.description ? <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text> : null}
            </View>
            <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon} size={12} color={st.text} />
              <Text style={[styles.statusChipText, { color: st.text }]}>{normalizeTargetStatus(t.status)}</Text>
            </View>
          </View>
          {type === 'multiple' && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={[styles.progressPct, { color: barColor(p) }]}>{p}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${p}%`, backgroundColor: barColor(p) }]} />
              </View>
              <Text style={styles.progressCount}>{t.achievedValue} of {t.targetValue} completed</Text>
            </View>
          )}
          <View style={styles.cardFooter}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
              <Text style={styles.metaText}>Due {t.endDate}</Text>
              {comments > 0 && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Ionicons name="chatbubbles-outline" size={13} color="#6366F1" />
                  <Text style={styles.metaComment}>{comments}</Text>
                </>
              )}
            </View>
            {!done && (
              <View style={styles.quickActions}>
                {type === 'multiple' && t.achievedValue < t.targetValue && (
                  <TouchableOpacity style={styles.quickBtnOutline} onPress={() => handleIncrement(t)} disabled={submitting}>
                    <Ionicons name="add" size={16} color="#2563EB" />
                    <Text style={styles.quickBtnOutlineText}>+1</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.quickBtnDone} onPress={() => handleMarkComplete(t)} disabled={submitting}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                  <Text style={styles.quickBtnDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  const selType = selected ? resolveTargetType(selected) : 'task';
  const selDone = selected ? normalizeTargetStatus(selected.status) === 'Completed' : false;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Tasks & Targets</Text>
        <Text style={styles.headerSub}>Assigned by your branch admin</Text>
        <View style={styles.statsGrid}>
          {[
            { label: 'Active', value: stats.active, color: '#BFDBFE' },
            { label: 'Completed', value: stats.completed, color: '#A7F3D0' },
            { label: 'Overdue', value: stats.overdue, color: '#FECACA' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.filterBar}>
        {(['all', 'active', 'completed'] as FilterTab[]).map(tab => (
          <TouchableOpacity key={tab} style={[styles.filterTab, filter === tab && styles.filterTabOn]} onPress={() => setFilter(tab)}>
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextOn]}>
              {tab === 'all' ? 'All' : tab === 'active' ? 'In Progress' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && targets.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your assignments…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor="#2563EB" />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No assignments yet</Text>
              <Text style={styles.emptySub}>Tasks and targets from your admin will show here.</Text>
            </View>
          ) : (
            filtered.map(renderCard)
          )}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {selected && (
              <>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{selected.title}</Text>
                    <Text style={styles.sheetDates}>{selected.startDate} → {selected.endDate}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setSelected(null); setCommentText(''); }}>
                    <Ionicons name="close-circle" size={28} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.sheetScroll}>
                  {selected.description ? <Text style={styles.sheetDesc}>{selected.description}</Text> : null}
                  {selType === 'multiple' && (
                    <View style={styles.sheetProgress}>
                      <Text style={styles.sheetProgressTitle}>{selected.achievedValue} / {selected.targetValue} · {pct(selected)}%</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct(selected)}%`, backgroundColor: barColor(pct(selected)) }]} />
                      </View>
                    </View>
                  )}
                  {!selDone ? (
                    selType === 'task' ? (
                      <TouchableOpacity style={styles.completeLargeBtn} disabled={submitting} onPress={() => handleMarkComplete(selected)}>
                        <LinearGradient colors={['#059669', '#047857']} style={styles.completeLargeGrad}>
                          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                          <Text style={styles.completeLargeText}>Mark as Completed</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.sheetActionRow}>
                        <TouchableOpacity style={styles.incBtn} disabled={submitting || selected.achievedValue >= selected.targetValue} onPress={() => handleIncrement(selected)}>
                          <Text style={styles.incBtnText}>+1 Done</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.completeSmallBtn} disabled={submitting} onPress={() => handleMarkComplete(selected)}>
                          <Text style={styles.completeSmallText}>Complete All</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    <View style={styles.completedBanner}>
                      <Ionicons name="checkmark-circle" size={24} color="#059669" />
                      <Text style={styles.completedBannerText}>Completed</Text>
                    </View>
                  )}
                  <Text style={styles.commentsHeading}>Comments ({selected.comments?.length ?? 0})</Text>
                  {(selected.comments ?? []).map(c => {
                    const isSent = isOwnComment(c, user?.id);
                    return (
                      <View key={c.id} style={[styles.commentItem, isSent ? styles.commentItemSent : styles.commentItemReceived]}>
                        <View style={[styles.commentBubble, isSent ? styles.commentBubbleSent : styles.commentBubbleReceived]}>
                          <Text style={[styles.commentAuthor, isSent ? styles.commentAuthorSent : styles.commentAuthorReceived]}>
                            {isSent ? 'You' : `${c.authorName}${c.role === 'admin' ? ' · Admin' : ''}`} · {formatCommentTime(c.createdAt)}
                          </Text>
                          <Text style={[styles.commentBody, isSent ? styles.commentBodySent : styles.commentBodyReceived]}>{c.text}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                {!selDone && (
                  <View style={styles.composeArea}>
                    {showEmojiBar && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
                        {QUICK_EMOJIS.map(e => (
                          <TouchableOpacity key={e} style={styles.emojiChip} onPress={() => setCommentText(p => p + e)}>
                            <Text style={styles.emojiChar}>{e}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                    <View style={styles.composeRow}>
                      <TouchableOpacity style={styles.emojiBtn} onPress={() => setShowEmojiBar(v => !v)}>
                        <Ionicons name="happy-outline" size={22} color="#6366F1" />
                      </TouchableOpacity>
                      <TextInput style={styles.composeInput} placeholder="Write an update…" value={commentText} onChangeText={setCommentText} multiline maxLength={600} />
                      <TouchableOpacity style={[styles.sendBtn, !commentText.trim() && styles.sendBtnOff]} disabled={!commentText.trim() || submitting} onPress={() => postComment(commentText)}>
                        <Ionicons name="send" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 20, paddingBottom: 22 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: 18 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  filterBar: { flexDirection: 'row', gap: 8, padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterTabOn: { backgroundColor: '#2563EB' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterTabTextOn: { color: '#FFF' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748B' },
  list: { padding: 16, gap: 14 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden', elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  cardPressed: { opacity: 0.95 },
  cardAccent: { width: 5 },
  accentTask: { backgroundColor: '#8B5CF6' },
  accentTarget: { backgroundColor: '#F59E0B' },
  cardBody: { flex: 1, padding: 16 },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardTitleBlock: { flex: 1 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 6 },
  typePillText: { fontSize: 10, fontWeight: '800' },
  typeTask: { color: '#7C3AED' },
  typeTarget: { color: '#D97706' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardDesc: { fontSize: 13, color: '#64748B', marginTop: 4 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  progressSection: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  progressPct: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressCount: { fontSize: 12, color: '#64748B', marginTop: 6 },
  cardFooter: { gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#94A3B8' },
  metaDot: { color: '#CBD5E1' },
  metaComment: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  quickBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  quickBtnOutlineText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  quickBtnDone: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#059669' },
  quickBtnDoneText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginVertical: 10 },
  sheetHeader: { flexDirection: 'row', paddingHorizontal: 20, alignItems: 'flex-start' },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sheetDates: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  sheetScroll: { paddingHorizontal: 20, maxHeight: 360 },
  sheetDesc: { fontSize: 15, color: '#475569', marginBottom: 16, lineHeight: 22 },
  sheetProgress: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 16 },
  sheetProgressTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  completeLargeBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  completeLargeGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  completeLargeText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  sheetActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  incBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center' },
  incBtnText: { fontSize: 15, fontWeight: '700', color: '#2563EB' },
  completeSmallBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center' },
  completeSmallText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', padding: 14, borderRadius: 14, marginBottom: 16 },
  completedBannerText: { fontSize: 16, fontWeight: '700', color: '#047857' },
  commentsHeading: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  commentItem: { marginBottom: 10 },
  commentItemReceived: { alignItems: 'flex-start' },
  commentItemSent: { alignItems: 'flex-end' },
  commentBubble: { borderRadius: 16, padding: 12, maxWidth: '85%' },
  commentBubbleReceived: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderBottomLeftRadius: 4 },
  commentBubbleSent: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  commentAuthor: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  commentAuthorReceived: { color: '#6366F1' },
  commentAuthorSent: { color: '#BFDBFE' },
  commentBody: { fontSize: 15, lineHeight: 22 },
  commentBodyReceived: { color: '#334155' },
  commentBodySent: { color: '#FFF' },
  composeArea: { borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: 16 },
  emojiScroll: { marginVertical: 8, maxHeight: 44 },
  emojiChip: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  emojiChar: { fontSize: 22 },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  composeInput: { flex: 1, minHeight: 44, maxHeight: 100, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.45 },
});
