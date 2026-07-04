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

interface SalesEntry {
  id: string;
  type: 'sale' | 'expense';
  title: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  employeeName?: string;
  branch?: string;
  createdAt?: any;
}

const SALE_CATS = ['Product Sale', 'Service Sale', 'Subscription', 'Consulting', 'Other'];
const EXPENSE_CATS = ['Travel', 'Office Supplies', 'Marketing', 'Software', 'Utilities', 'Other'];

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sale' | 'expense'>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'sale' as 'sale' | 'expense',
    title: '', category: '', amount: '',
    date: new Date().toISOString().slice(0, 10), notes: '',
  });

  useEffect(() => {
    if (!user?.id && !user?.employeeId) { setLoading(false); return; }
    const ids = [user.id, user.employeeId].filter(Boolean) as string[];
    const q = query(
      collection(db, 'salesExpenses'),
      where('employeeId', 'in', ids),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesEntry)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.id, user?.employeeId]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);
  const totalSales = entries.filter(e => e.type === 'sale').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  async function handleSubmit() {
    if (!form.title || !form.amount) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'salesExpenses'), {
        ...form,
        amount: Number(form.amount),
        employeeId: user?.id || user?.employeeId || '',
        employeeName: user?.name || '',
        branch: user?.department || '',
        createdAt: serverTimestamp(),
      });
      setShowForm(false);
      setForm({ type: 'sale', title: '', category: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
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
          <Text style={styles.headerTitle}>Sales & Expenses</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Sales</Text>
            <Text style={styles.kpiValue}>{fmt(totalSales)}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Expenses</Text>
            <Text style={[styles.kpiValue, { color: '#FCA5A5' }]}>{fmt(totalExpenses)}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Net</Text>
            <Text style={[styles.kpiValue, { color: totalSales - totalExpenses >= 0 ? '#86EFAC' : '#FCA5A5' }]}>
              {fmt(totalSales - totalExpenses)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'sale', 'expense'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.activeFilterTab]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.activeFilterTabText]}>
              {f === 'all' ? 'All' : f === 'sale' ? 'Sales' : 'Expenses'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to add a sale or expense.</Text>
            </View>
          )}
          {filtered.map(e => (
            <View key={e.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.typeIcon, { backgroundColor: e.type === 'sale' ? '#DCFCE7' : '#FEE2E2' }]}>
                  <Ionicons
                    name={e.type === 'sale' ? 'trending-up' : 'trending-down'}
                    size={18}
                    color={e.type === 'sale' ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{e.title}</Text>
                  <Text style={styles.cardMeta}>{e.category} · {e.date}</Text>
                </View>
                <Text style={[styles.amountText, { color: e.type === 'sale' ? '#16A34A' : '#DC2626' }]}>
                  {e.type === 'expense' ? '-' : '+'}{fmt(e.amount)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Entry Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Entry</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Type Toggle */}
            <View style={styles.typeToggle}>
              {(['sale', 'expense'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggleBtn, form.type === t && styles.activeToggleBtn]}
                  onPress={() => setForm(p => ({ ...p, type: t, category: '' }))}
                >
                  <Ionicons
                    name={t === 'sale' ? 'trending-up' : 'trending-down'}
                    size={16}
                    color={form.type === t ? '#FFFFFF' : '#64748B'}
                  />
                  <Text style={[styles.toggleText, form.type === t && styles.activeToggleText]}>
                    {t === 'sale' ? 'Sale' : 'Expense'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {[['title', 'Title *'], ['amount', 'Amount (₹) *']].map(([k, l]) => (
              <View key={k} style={styles.formField}>
                <Text style={styles.fieldLabel}>{l}</Text>
                <TextInput
                  value={(form as any)[k]}
                  onChangeText={v => setForm(p => ({ ...p, [k]: v }))}
                  style={styles.input}
                  keyboardType={k === 'amount' ? 'numeric' : 'default'}
                  placeholder={`Enter ${l.replace(' *', '').toLowerCase()}`}
                />
              </View>
            ))}

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {(form.type === 'sale' ? SALE_CATS : EXPENSE_CATS).map(c => (
                    <TouchableOpacity key={c} onPress={() => setForm(p => ({ ...p, category: c }))}
                      style={[styles.chip, form.category === c && styles.activeChip]}>
                      <Text style={[styles.chipText, form.category === c && styles.activeChipText]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                value={form.date}
                onChangeText={v => setForm(p => ({ ...p, date: v }))}
                style={styles.input}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                style={[styles.input, styles.textarea]}
                multiline numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={saving || !form.title || !form.amount}
              style={[styles.submitBtn, (!form.title || !form.amount || saving) && styles.submitBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Save Entry</Text>
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
  header: { paddingBottom: 20 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  kpiRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16, borderRadius: 14, padding: 14,
  },
  kpiCard: { flex: 1, alignItems: 'center' },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  kpiDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  filterRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  filterTab: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderRadius: 8, backgroundColor: '#F1F5F9',
  },
  activeFilterTab: { backgroundColor: '#2563EB' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  activeFilterTabText: { color: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 10 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  amountText: { fontSize: 15, fontWeight: '800' },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },
  typeToggle: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingVertical: 12,
  },
  activeToggleBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeToggleText: { color: '#FFFFFF' },
  formField: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1E293B',
    backgroundColor: '#FAFAFA',
  },
  textarea: { minHeight: 70 },
  chipRow: { flexDirection: 'row', gap: 8 },
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
