import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTopInset, useNavBottomInset } from '../../hooks/useBottomSpacing';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  EditProfile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
  AnnouncementDetail: { announcementId: string };
  Settings: undefined;
  SubscriptionPlans: undefined;
  Login: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type StrengthLevel = 'weak' | 'medium' | 'strong' | 'none';

interface Requirement {
  label: string;
  met: boolean;
}

function getPasswordStrength(password: string): StrengthLevel {
  if (!password) return 'none';
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

function PasswordInput({ label, value, onChangeText, placeholder }: PasswordInputProps) {
  const [secure, setSecure] = useState(true);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? '••••••••'}
          placeholderTextColor="#94A3B8"
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={() => setSecure((v) => !v)} activeOpacity={0.7} style={styles.eyeBtn}>
          <Ionicons name={secure ? 'eye-outline' : 'eye-off-outline'} size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const headerTop = useTopInset(12);
  const navBottom = useNavBottomInset();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const strength = getPasswordStrength(newPassword);

  const requirements: Requirement[] = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'Contains number', met: /[0-9]/.test(newPassword) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const strengthColor: Record<StrengthLevel, string> = {
    none: '#E2E8F0',
    weak: '#DC2626',
    medium: '#D97706',
    strong: '#16A34A',
  };

  const strengthLabel: Record<StrengthLevel, string> = {
    none: '',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
  };

  const strengthSegments: Record<StrengthLevel, number> = {
    none: 0,
    weak: 1,
    medium: 2,
    strong: 3,
  };

  const handleUpdate = () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match.');
      return;
    }
    if (strength === 'weak') {
      Alert.alert('Weak Password', 'Please choose a stronger password.');
      return;
    }
    Alert.alert('Success', 'Your password has been updated successfully!', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: headerTop }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: navBottom + 32 }]}
      >
        {/* ── Form Card ── */}
        <View style={styles.formCard}>

          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
          />

          <View style={styles.cardDivider} />

          <PasswordInput
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
          />

          {/* Strength Bar */}
          {newPassword.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBarRow}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthSegment,
                      {
                        backgroundColor:
                          i < strengthSegments[strength]
                            ? strengthColor[strength]
                            : '#E2E8F0',
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strengthColor[strength] }]}>
                {strengthLabel[strength]}
              </Text>
            </View>
          )}

          {/* Requirements */}
          <View style={styles.requirementsBlock}>
            <Text style={styles.requirementsTitle}>Password Requirements</Text>
            {requirements.map((req) => (
              <View key={req.label} style={styles.requirementRow}>
                <Ionicons
                  name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={req.met ? '#16A34A' : '#94A3B8'}
                />
                <Text style={[styles.requirementText, req.met && styles.requirementMet]}>
                  {req.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.cardDivider} />

          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
          />

          {/* Match indicator */}
          {confirmPassword.length > 0 && (
            <View style={styles.matchRow}>
              <Ionicons
                name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={newPassword === confirmPassword ? '#16A34A' : '#DC2626'}
              />
              <Text
                style={[
                  styles.matchText,
                  { color: newPassword === confirmPassword ? '#16A34A' : '#DC2626' },
                ]}
              >
                {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Update Button ── */}
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate} activeOpacity={0.8}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
          <Text style={styles.updateButtonText}>Update Password</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  strengthContainer: {
    marginTop: 10,
    marginBottom: 6,
  },
  strengthBarRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  strengthSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  requirementsBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  requirementMet: {
    color: '#16A34A',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
