import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

interface ServiceRequest {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  clientName: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  scheduledDate: string;
  visitType: 'On-site' | 'Remote' | 'Phone';
  createdAt?: any;
  employeeId?: string;
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#64748B' },
  Medium: { bg: '#EFF6FF', text: '#2563EB' },
  High:   { bg: '#FEF3C7', text: '#D97706' },
  Urgent: { bg: '#FEE2E2', text: '#DC2626' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  Open:        { bg: '#FEF3C7', text: '#D97706', icon: 'ellipse-outline' },
  'In Progress':{ bg: '#EFF6FF', text: '#2563EB', icon: 'sync-outline' },
  Resolved:    { bg: '#DCFCE7', text: '#16A34A', icon: 'checkmark-circle-outline' },
  Closed:      { bg: '#F1F5F9', text: '#64748B', icon: 'close-circle-outline' },
};

function genTicket() { return 'SR-' + Date.now().toString().slice(-6); }

export default function ServiceRequestScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', clientName: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    visitType: 'On-site' as 'On-site' | 'Remote' | 'Phone',
    scheduledDate: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (!user?.id && !user?.employeeId) { setLoading(false); return; }
    const ids = [user.id, user.employeeId].filter(Boolean) as string[];
    const q = query(
      collection(db, 'serviceRequests'),
      where('employeeId', 'in', ids),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRequest)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.id, user?.employeeId]);

  async function handleSubmit() {
    if (!form.title) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'serviceRequests'), {
        ...form,
        ticketNo: genTicket(),
        status: 'Open',
        employeeId: user?.id || user?.employeeId || '',
        assignedTo: user?.name || '',
        department: user?.department || '',
        notes: '',
        clientAddress: '',
        createdAt: serverTimestamp(),
      });
      setShowForm(false);
      setForm({
        title: '', description: '', clientName: '',
        priority: 'Medium', visitType: 'On-site',
        scheduledDate: new Date().toISOString().slice(0, 10),
      });
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Requests</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
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
        >
          {requests.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Service Requests</Text>
              <Text style={styles.emptySubtitle}>Tap + to create a new service request.</Text>
            </View>
          )}

          {requests.map(r => {
            const pCfg = PRIORITY_CONFIG[r.priority] ?? PRIORITY_CONFIG.Medium;
            const sCfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.Open;
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.ticketNo}>{r.ticketNo}</Text>
                  <View style={[styles.badge, { backgroundColor: pCfg.bg }]}>
                    <Text style={[styles.badgeText, { color: pCfg.text }]}>{r.priority}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{r.title}</Text>
                {r.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>
                ) : null}
                <View style={styles.cardFooter}>
                  <View style={[styles.statusBadge, { backgroundColor: sCfg.bg }]}>
                    <Ionicons name={sCfg.icon as any} size={12} color={sCfg.text} />
                    <Text style={[styles.statusText, { color: sCfg.text }]}>{r.status}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={12} color="#94A3B8" />
                    <Text style={styles.metaText}>{r.clientName || 'No client'}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                    <Text style={styles.metaText}>{r.scheduledDate}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Create Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Service Request</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {[['title', 'Title *'], ['description', 'Description'], ['clientName', 'Client Name']].map(([k, l]) => (
              <View key={k} style={styles.formField}>
                <Text style={styles.fieldLabel}>{l}</Text>
                {k === 'description' ? (
                  <TextInput
                    value={(form as any)[k]}
                    onChangeText={v => setForm(p => ({ ...p, [k]: v }))}
                    style={[styles.input, styles.textarea]}
                    multiline numberOfLines={3}
                    textAlignVertical="top"
                    placeholder={`Enter ${l.replace(' *', '').toLowerCase()}`}
                  />
                ) : (
                  <TextInput
                    value={(form as any)[k]}
                    onChangeText={v => setForm(p => ({ ...p, [k]: v }))}
                    style={styles.input}
                    placeholder={`Enter ${l.replace(' *', '').toLowerCase()}`}
                  />
                )}
              </View>
            ))}

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.chipRow}>
                {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                  <TouchableOpacity key={p} onPress={() => setForm(f => ({ ...f, priority: p }))}
                    style={[styles.chip, form.priority === p && styles.activeChip]}>
                    <Text style={[styles.chipText, form.priority === p && styles.activeChipText]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Visit Type</Text>
              <View style={styles.chipRow}>
                {(['On-site', 'Remote', 'Phone'] as const).map(v => (
                  <TouchableOpacity key={v} onPress={() => setForm(f => ({ ...f, visitType: v }))}
                    style={[styles.chip, form.visitType === v && styles.activeChip]}>
                    <Text style={[styles.chipText, form.visitType === v && styles.activeChipText]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Scheduled Date</Text>
              <TextInput
                value={form.scheduledDate}
                onChangeText={v => setForm(p => ({ ...p, scheduledDate: v }))}
                style={styles.input}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={saving || !form.title}
              style={[styles.submitBtn, (!form.title || saving) && styles.submitBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  ticketNo: { fontSize: 12, fontFamily: 'monospace', color: '#94A3B8' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748B', marginBottom: 10, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#94A3B8' },
  metaDot: { fontSize: 11, color: '#CBD5E1' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },
  formField: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1E293B',
    backgroundColor: '#FAFAFA',
  },
  textarea: { minHeight: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  activeChip: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  activeChipText: { color: '#FFFFFF' },
  submitBtn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
