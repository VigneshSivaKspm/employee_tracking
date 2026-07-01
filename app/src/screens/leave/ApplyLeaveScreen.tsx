import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAttendance } from '../../context/AttendanceContext';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme/colors';
import type { LeaveType, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── constants ───────────────────────────────────────────────────────────────

interface LeaveTypeOption {
  value: LeaveType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const LEAVE_TYPE_OPTIONS: LeaveTypeOption[] = [
  {
    value: 'casual',
    label: 'Casual Leave',
    description: 'For personal and general purposes',
    icon: 'sunny-outline',
    color: '#2563EB',
  },
  {
    value: 'sick',
    label: 'Sick Leave',
    description: 'Medical conditions and recovery',
    icon: 'medical-outline',
    color: '#DC2626',
  },
  {
    value: 'earned',
    label: 'Earned Leave',
    description: 'Accrued based on service tenure',
    icon: 'star-outline',
    color: '#16A34A',
  },
  {
    value: 'maternity',
    label: 'Maternity Leave',
    description: 'For childbirth and care',
    icon: 'heart-outline',
    color: '#7C3AED',
  },
  {
    value: 'paternity',
    label: 'Paternity Leave',
    description: 'For new fathers supporting family',
    icon: 'people-outline',
    color: '#0891B2',
  },
  {
    value: 'unpaid',
    label: 'Unpaid Leave',
    description: 'Leave without pay when balance is exhausted',
    icon: 'wallet-outline',
    color: '#D97706',
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseDate(str: string): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function calcDays(start: string, end: string): number {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return 0;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1);
}

function formatDisplayDate(iso: string): string {
  if (!iso) return 'Select Date';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = iso.split('-');
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

interface DateInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  minDate?: string;
}

function DateInput({ label, value, onChange, minDate }: DateInputProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value);

  const commit = () => {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    if (match) {
      if (minDate && raw < minDate) {
        Alert.alert('Invalid Date', 'End date cannot be before start date.');
        setRaw(value);
      } else {
        onChange(raw);
      }
    } else {
      setRaw(value);
    }
    setEditing(false);
  };

  return (
    <View style={dateStyles.wrap}>
      <Text style={dateStyles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={dateStyles.input}
          value={raw}
          onChangeText={setRaw}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.text.muted}
          autoFocus
          keyboardType="numeric"
          returnKeyType="done"
        />
      ) : (
        <TouchableOpacity
          style={dateStyles.picker}
          onPress={() => { setRaw(value || todayISO()); setEditing(true); }}
          activeOpacity={0.75}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={value ? Colors.primary : Colors.text.muted}
          />
          <Text style={[dateStyles.pickerText, !value && { color: Colors.text.muted }]}>
            {value ? formatDisplayDate(value) : 'Select Date'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const dateStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 14,
  },
  pickerText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
});

// ─── Leave Type Modal ─────────────────────────────────────────────────────────

interface LeaveTypeSelectorProps {
  visible: boolean;
  selected: LeaveType | null;
  onSelect: (type: LeaveType) => void;
  onClose: () => void;
}

function LeaveTypeModal({ visible, selected, onSelect, onClose }: LeaveTypeSelectorProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={ltStyles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={ltStyles.sheet}>
          <View style={ltStyles.handle} />
          <Text style={ltStyles.sheetTitle}>Select Leave Type</Text>

          {LEAVE_TYPE_OPTIONS.map(opt => {
            const isSelected = selected === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[ltStyles.option, isSelected && ltStyles.optionSelected]}
                onPress={() => { onSelect(opt.value); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={[ltStyles.optionIcon, { backgroundColor: opt.color + '1A' }]}>
                  <Ionicons name={opt.icon} size={18} color={opt.color} />
                </View>
                <View style={ltStyles.optionText}>
                  <Text style={[ltStyles.optionLabel, isSelected && { color: Colors.primary }]}>
                    {opt.label}
                  </Text>
                  <Text style={ltStyles.optionDesc} numberOfLines={1}>
                    {opt.description}
                  </Text>
                </View>
                <View style={[ltStyles.radio, isSelected && ltStyles.radioSelected]}>
                  {isSelected && <View style={ltStyles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const ltStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  optionSelected: {
    backgroundColor: '#EFF6FF',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#2563EB',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ApplyLeaveScreen() {
  const navigation = useNavigation<Nav>();
  const { submitLeave } = useAttendance();

  const [leaveType, setLeaveType] = useState<LeaveType | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedTypeOption = LEAVE_TYPE_OPTIONS.find(o => o.value === leaveType);
  const totalDays = calcDays(startDate, endDate);

  const handleStartDateChange = useCallback((val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) setEndDate(val);
  }, [endDate]);

  const handleChooseFile = useCallback(() => {
    // In production, integrate expo-document-picker here.
    setFileName('medical_certificate.pdf');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!leaveType) {
      Alert.alert('Missing Field', 'Please select a leave type.');
      return;
    }
    if (!startDate) {
      Alert.alert('Missing Field', 'Please select a start date.');
      return;
    }
    if (!endDate) {
      Alert.alert('Missing Field', 'Please select an end date.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Missing Field', 'Please enter a reason for your leave.');
      return;
    }

    setSubmitting(true);
    try {
      submitLeave({
        type: leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        hasDocument: !!fileName,
        totalDays: Math.max(totalDays, 1),
      });
      Alert.alert('Success', 'Your leave request has been submitted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit leave request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [leaveType, startDate, endDate, reason, fileName, totalDays, submitLeave, navigation]);

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.dragHandle} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Apply Leave</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Leave Type ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Leave Type</Text>
            <TouchableOpacity
              style={styles.dropdownSelector}
              onPress={() => setTypeModalVisible(true)}
              activeOpacity={0.75}
            >
              {selectedTypeOption ? (
                <View style={styles.dropdownSelectedRow}>
                  <View style={[styles.dropdownIcon, { backgroundColor: selectedTypeOption.color + '1A' }]}>
                    <Ionicons name={selectedTypeOption.icon} size={16} color={selectedTypeOption.color} />
                  </View>
                  <Text style={styles.dropdownSelectedText}>{selectedTypeOption.label}</Text>
                </View>
              ) : (
                <Text style={styles.dropdownPlaceholder}>Select leave type</Text>
              )}
              <Ionicons name="chevron-down" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {/* ── Dates Row ── */}
          <View style={styles.datesRow}>
            <DateInput
              label="Start Date"
              value={startDate}
              onChange={handleStartDateChange}
            />
            <View style={styles.datesSpacer} />
            <DateInput
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              minDate={startDate}
            />
          </View>

          {/* Total days pill */}
          {totalDays > 0 && (
            <View style={styles.totalDaysPillWrap}>
              <View style={styles.totalDaysPill}>
                <Ionicons name="time-outline" size={14} color="#2563EB" />
                <Text style={styles.totalDaysPillText}>{totalDays} Day{totalDays !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          )}

          {/* ── Reason ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Describe the reason for your leave request..."
              placeholderTextColor={Colors.text.muted}
              multiline
              textAlignVertical="top"
              numberOfLines={5}
            />
          </View>

          {/* ── Upload Document ── */}
          <View style={styles.fieldGroup}>
            <View style={styles.uploadRow}>
              <View style={styles.uploadLabelCol}>
                <Ionicons name="document-attach-outline" size={16} color={Colors.text.secondary} />
                <Text style={styles.uploadLabel}>
                  Upload Document{' '}
                  <Text style={styles.uploadOptional}>(Optional)</Text>
                </Text>
              </View>
              <TouchableOpacity
                style={styles.chooseFileBtn}
                onPress={handleChooseFile}
                activeOpacity={0.75}
              >
                <Text style={styles.chooseFileBtnText}>Choose File</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.fileNameText, fileName ? styles.fileNameTextActive : null]}>
              {fileName ?? 'No file chosen'}
            </Text>
          </View>
        </ScrollView>

        {/* ── Submit Button ── */}
        <View style={styles.submitWrap}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <Text style={styles.submitBtnText}>Submitting…</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Submit Leave</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Leave Type Modal ── */}
      <LeaveTypeModal
        visible={typeModalVisible}
        selected={leaveType}
        onSelect={setLeaveType}
        onClose={() => setTypeModalVisible(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 8,
    paddingBottom: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerPlaceholder: {
    width: 36,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 8,
  },

  // Field group
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Dropdown selector
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 14,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#94A3B8',
  },
  dropdownSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Dates row
  datesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  datesSpacer: {
    width: 10,
  },

  // Total days pill
  totalDaysPillWrap: {
    alignItems: 'flex-start',
    marginTop: -8,
  },
  totalDaysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  totalDaysPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Reason input
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    minHeight: 110,
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },

  // Upload document
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  uploadOptional: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
  },
  chooseFileBtn: {
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chooseFileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  fileNameText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  fileNameTextActive: {
    color: '#16A34A',
    fontWeight: '500',
  },

  // Submit
  submitWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 52,
    ...Shadow.blue,
  },
  submitBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
