import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenBottomPadding } from '../../hooks/useBottomSpacing';
import { useEmployeeSalesExpenses } from '../../hooks/useEmployeeSalesExpenses';

const SALE_CATS = ['Product Sale', 'Service Sale', 'Subscription', 'Consulting', 'Other'];
const EXPENSE_CATS = ['Travel', 'Office Supplies', 'Marketing', 'Software', 'Utilities', 'Maintenance', 'Other'];

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabScreenBottomPadding();
  const { user } = useAuth();
  const { entries, loading } = useEmployeeSalesExpenses(user);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sale' | 'expense'>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'sale' as 'sale' | 'expense',
    title: '', category: '', amount: '',
    date: new Date().toISOString().slice(0, 10), notes: '',
  });

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);
  const totalSales = entries.filter(e => e.type === 'sale').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  async function handleSubmit() {
    if (!form.title || !form.amount || !user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'salesExpenses'), {
        type: form.type,
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        notes: form.notes.trim(),
        userId: user.id,
        employeeId: (user.employeeId || '').trim().toUpperCase(),
        employeeName: user.name || 'Employee',
        branch: user.branchName || '',
        branchId: user.branchId || '',
        department: user.department || '',
        createdAt: serverTimestamp(),
      });
      setShowForm(false);
      setForm({ type: 'sale', title: '', category: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.backBtn} />
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

      {loading && entries.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your entries…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }} tintColor="#2563EB" />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to log a sale or expense. Entries from admin will appear here too.</Text>
            </View>
          ) : (
            filtered.map(e => (
              <View key={e.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeIcon, { backgroundColor: e.type === 'sale' ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Ionicons
                      name={e.type === 'sale' ? 'trending-up' : 'trending-down'}
                      size={18}
                      color={e.type === 'sale' ? '#16A34A' : '#DC2626'}
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{e.title}</Text>
                      <View style={[styles.typePill, e.type === 'sale' ? styles.salePill : styles.expensePill]}>
                        <Text style={[styles.typePillText, e.type === 'sale' ? styles.salePillText : styles.expensePillText]}>
                          {e.type === 'sale' ? 'Sale' : 'Expense'}
                        </Text>
                      </View>
                    </View>
                    {e.category ? <Text style={styles.cardCategory}>{e.category}</Text> : null}
                    {e.notes ? <Text style={styles.cardNotes} numberOfLines={2}>{e.notes}</Text> : null}
                    <View style={styles.metaRow}>
                      <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                      <Text style={styles.cardMeta}>{e.date}</Text>
                      {e.branch ? (
                        <>
                          <Text style={styles.metaDot}>·</Text>
                          <Ionicons name="business-outline" size={12} color="#94A3B8" />
                          <Text style={styles.cardMeta} numberOfLines={1}>{e.branch}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.amountText, { color: e.type === 'sale' ? '#16A34A' : '#DC2626' }]}>
                    {e.type === 'expense' ? '−' : '+'}{fmt(e.amount)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Entry</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.typeToggle}>
              {(['sale', 'expense'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggleBtn, form.type === t && styles.activeToggleBtn]}
                  onPress={() => setForm(p => ({ ...p, type: t, category: '' }))}
                >
                  <Ionicons name={t === 'sale' ? 'trending-up' : 'trending-down'} size={16} color={form.type === t ? '#FFFFFF' : '#64748B'} />
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
                  value={(form as Record<string, string>)[k]}
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
              <TextInput value={form.date} onChangeText={v => setForm(p => ({ ...p, date: v }))} style={styles.input} placeholder="YYYY-MM-DD" />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                style={[styles.input, styles.textarea]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={saving || !form.title || !form.amount}
              style={[styles.submitBtn, (!form.title || !form.amount || saving) && styles.submitBtnDisabled]}
            >
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Save Entry</Text>}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  kpiRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16, borderRadius: 14, padding: 14 },
  kpiCard: { flex: 1, alignItems: 'center' },
  kpiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  kpiDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  filterRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: '#F1F5F9' },
  activeFilterTab: { backgroundColor: '#2563EB' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  activeFilterTabText: { color: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#64748B', fontSize: 14 },
  scrollContent: { padding: 16, gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  typeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  salePill: { backgroundColor: '#DCFCE7' },
  expensePill: { backgroundColor: '#FEE2E2' },
  typePillText: { fontSize: 10, fontWeight: '800' },
  salePillText: { color: '#15803D' },
  expensePillText: { color: '#B91C1C' },
  cardCategory: { fontSize: 12, color: '#6366F1', fontWeight: '600', marginTop: 2 },
  cardNotes: { fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11, color: '#94A3B8' },
  metaDot: { color: '#CBD5E1', fontSize: 11 },
  amountText: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },
  typeToggle: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingVertical: 12 },
  activeToggleBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeToggleText: { color: '#FFFFFF' },
  formField: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1E293B', backgroundColor: '#FAFAFA' },
  textarea: { minHeight: 70 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  activeChip: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  activeChipText: { color: '#FFFFFF' },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
