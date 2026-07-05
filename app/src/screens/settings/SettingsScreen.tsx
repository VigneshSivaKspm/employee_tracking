import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
  ScrollView as RNScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useEnterpriseSync } from '../../context/EnterpriseSyncContext';
import { formatMissingPermissionLabels } from '../../services/enterprisePermissions';
import { useStackScreenBottomPadding } from '../../hooks/useBottomSpacing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Privacy Policy & Terms text ───────────────────────────────────────────

const PRIVACY_POLICY = `Privacy Policy
Last updated: July 2026

1. INTRODUCTION
WorkForce ("we", "our", or "the App") respects your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our employee attendance and management application.

2. INFORMATION WE COLLECT
• Account Data: Name, email address, employee ID, phone number, department, and designation provided at registration.
• Attendance Data: Clock-in/clock-out times, location (if enabled), and attendance history.
• Device Data: Device type, OS version, and app version for diagnostics.
• Usage Data: Feature interactions to improve the app experience.

3. HOW WE USE YOUR INFORMATION
• To manage your attendance records and generate reports.
• To send notifications about leave approvals, announcements, and payroll.
• To authenticate your identity securely.
• To provide HR and management analytics.

4. DATA STORAGE & SECURITY
All data is stored on Google Firebase with industry-standard encryption. We do not sell your personal data to third parties.

5. DATA RETENTION
Attendance and leave records are retained for the duration of your employment plus 5 years, as required by applicable labour laws.

6. YOUR RIGHTS
You may request access to, correction of, or deletion of your personal data by contacting your HR administrator or emailing support@workforce.app.

7. CHANGES TO THIS POLICY
We may update this policy periodically. Continued use of the App constitutes acceptance of the updated policy.

8. CONTACT
Questions? Contact us at support@workforce.app.`;

const TERMS_AND_CONDITIONS = `Terms & Conditions
Last updated: July 2026

1. ACCEPTANCE OF TERMS
By using the WorkForce app, you agree to these Terms & Conditions. If you do not agree, please discontinue use immediately.

2. USE OF THE APPLICATION
• This application is provided exclusively for employees of organisations that have subscribed to WorkForce.
• You must not share your login credentials with any other person.
• Misuse of the app (e.g., falsifying attendance) may result in disciplinary action.

3. ATTENDANCE & LEAVE
• Attendance recorded through this app is considered official and may be used for payroll calculations.
• Leave requests submitted are subject to approval by your line manager or HR.
• Approved leave balances are managed by your organisation's HR policy.

4. INTELLECTUAL PROPERTY
The WorkForce app, including its design, code, and content, is owned by the developer and may not be reproduced or distributed without permission.

5. LIMITATION OF LIABILITY
We are not liable for losses arising from incorrect attendance data entered by users, system downtime, or third-party service outages (e.g., Firebase).

6. PRIVACY
Your use of this app is also governed by our Privacy Policy, which is incorporated into these Terms by reference.

7. MODIFICATIONS
We reserve the right to modify these Terms at any time. Continued use after changes constitutes acceptance.

8. GOVERNING LAW
These Terms are governed by the laws of India. Any disputes shall be resolved in the courts of jurisdiction applicable to the organisation's registered address.

9. CONTACT
For queries, contact support@workforce.app.`;

// ─── Reusable Row ───────────────────────────────────────────────────────────

interface SettingsRowProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showDivider?: boolean;
}

function SettingsRow({ icon, iconBg, iconColor, label, sublabel, onPress, rightElement, showDivider = true }: SettingsRowProps) {
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress && !rightElement}
      >
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
        </View>
        {rightElement ?? (
          onPress ? <Ionicons name="chevron-forward" size={18} color="#CBD5E1" /> : null
        )}
      </TouchableOpacity>
      {showDivider && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Text Modal ─────────────────────────────────────────────────────────────

interface TextModalProps {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

function TextModal({ visible, title, content, onClose }: TextModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>
        <RNScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
          <Text style={styles.modalBody}>{content}</Text>
        </RNScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const bottomPadding = useStackScreenBottomPadding(40);
  const navigation = useNavigation<Nav>();
  const { signOut } = useAuth();
  const {
    requestPermissionsAgain,
    retriggerMissingPermissions,
    refreshPermissionStatus,
    permissionsGranted,
    missingPermissionCount,
  } = useEnterpriseSync();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [retriggering, setRetriggering] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshPermissionStatus().catch(() => undefined);
    }, [refreshPermissionStatus]),
  );

  async function handleRetriggerPermissions() {
    if (retriggering) return;
    setRetriggering(true);
    try {
      const status = await retriggerMissingPermissions();
      const missing = formatMissingPermissionLabels(status);

      if (missing.length === 0) {
        Alert.alert('All permissions granted', 'Company device monitoring is fully enabled.');
        return;
      }

      Alert.alert(
        'Some permissions still missing',
        `Still needed:\n\n• ${missing.join('\n• ')}\n\nIf a dialog did not appear, open App Settings and enable them manually.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    } finally {
      setRetriggering(false);
    }
  }

  function handleDevicePermissions() {
    Alert.alert(
      'Device Permissions',
      missingPermissionCount > 0
        ? `${missingPermissionCount} permission(s) still missing. Use "Retrigger Permissions" to request them again.`
        : 'All company device permissions are granted.',
      [
        { text: 'OK', style: 'cancel' },
        ...(missingPermissionCount > 0
          ? [{ text: 'Retrigger now', onPress: handleRetriggerPermissions }]
          : []),
      ],
    );
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }

  function handleHelpSupport() {
    Linking.openURL('mailto:support@workforce.app?subject=Help%20%26%20Support').catch(() => {
      Alert.alert('Cannot Open Mail', 'Please email us at support@workforce.app');
    });
  }

  function handleRateApp() {
    Linking.openURL('market://details?id=com.worktrack.attendance').catch(() => {
      Linking.openURL('https://play.google.com/store/apps/details?id=com.worktrack.attendance').catch(() => {
        Alert.alert('Cannot Open Store', 'Please search for "WorkForce" on the Play Store.');
      });
    });
  }

  function handleAboutApp() {
    Alert.alert(
      'About WorkForce',
      'WorkForce v1.0.0\nSmart Attendance & Employee Management\n\nBuilt with Expo SDK 54 & Firebase',
      [{ text: 'OK' }],
    );
  }

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
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.backBtn} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="Notifications"
            sublabel={notificationsEnabled ? 'Enabled' : 'Disabled'}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E2E8F0', true: '#BFDBFE' }}
                thumbColor={notificationsEnabled ? '#2563EB' : '#94A3B8'}
              />
            }
          />
          <SettingsRow
            icon="moon-outline"
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            label="Dark Mode"
            sublabel="Coming soon"
            showDivider={false}
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={() =>
                  Alert.alert('Coming Soon', 'Dark Mode will be available in a future update.')
                }
                trackColor={{ false: '#E2E8F0', true: '#BFDBFE' }}
                thumbColor={darkMode ? '#2563EB' : '#94A3B8'}
                disabled
              />
            }
          />
        </View>

        <Text style={styles.sectionLabel}>Company Device</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="phone-portrait-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="Device Permissions"
            sublabel={
              missingPermissionCount > 0
                ? `${missingPermissionCount} missing · monitoring limited`
                : permissionsGranted
                  ? 'All permissions granted'
                  : 'Checking permissions…'
            }
            onPress={handleDevicePermissions}
          />
          <SettingsRow
            icon="refresh-outline"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="Retrigger Permissions"
            sublabel={
              retriggering
                ? 'Requesting missing permissions…'
                : missingPermissionCount > 0
                  ? `Request ${missingPermissionCount} missing permission(s)`
                  : 'All permissions already granted'
            }
            onPress={missingPermissionCount > 0 && !retriggering ? handleRetriggerPermissions : undefined}
            rightElement={
              retriggering ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : missingPermissionCount > 0 ? (
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              )
            }
            showDivider={false}
          />
        </View>

        {/* Section: Legal */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="shield-checkmark-outline"
            iconBg="#DCFCE7"
            iconColor="#16A34A"
            label="Privacy Policy"
            onPress={() => setPrivacyVisible(true)}
          />
          <SettingsRow
            icon="document-text-outline"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="Terms & Conditions"
            showDivider={false}
            onPress={() => setTermsVisible(true)}
          />
        </View>

        {/* Section: Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="help-circle-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="Help & Support"
            sublabel="support@workforce.app"
            onPress={handleHelpSupport}
          />
          <SettingsRow
            icon="star-outline"
            iconBg="#FFF7ED"
            iconColor="#EA580C"
            label="Rate this App"
            sublabel="Play Store"
            showDivider={false}
            onPress={handleRateApp}
          />
        </View>

        {/* Section: About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="information-circle-outline"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="About App"
            sublabel="WorkForce – Smart Attendance"
            onPress={handleAboutApp}
          />
          <SettingsRow
            icon="code-slash-outline"
            iconBg="#F1F5F9"
            iconColor="#64748B"
            label="Version"
            sublabel="1.0.0 (Expo SDK 54)"
            showDivider={false}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Privacy Policy Modal */}
      <TextModal
        visible={privacyVisible}
        title="Privacy Policy"
        content={PRIVACY_POLICY}
        onClose={() => setPrivacyVisible(false)}
      />

      {/* Terms & Conditions Modal */}
      <TextModal
        visible={termsVisible}
        title="Terms & Conditions"
        content={TERMS_AND_CONDITIONS}
        onClose={() => setTermsVisible(false)}
      />
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  rowSublabel: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  rowDivider: { height: 1, backgroundColor: '#F8FAFC', marginLeft: 66 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
});
