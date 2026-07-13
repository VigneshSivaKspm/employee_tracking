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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useEnterpriseSync } from '../../context/EnterpriseSyncContext';
import { formatMissingPermissionLabels } from '../../services/enterprisePermissions';
import { getBiometricCapability } from '../../services/BiometricService';
import { useStackScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Privacy Policy & Terms text ───────────────────────────────────────────

const PRIVACY_POLICY = `Privacy Policy
Last updated: July 2026

1. INTRODUCTION
WorkForce ("we", "our", "us", or "the App") is an employee attendance and workforce management application operated on behalf of your employer. This Privacy Policy explains what information we collect, why we collect it, how it is used, and your rights. By installing, logging in, or using this App on a company-issued or company-managed device, you acknowledge this Policy.

2. COMPANY-ISSUED DEVICE MONITORING
Where your employer has deployed WorkForce on company phones or devices assigned for work, the App may collect and transmit data for legitimate business purposes including attendance verification, field operations, security, and compliance. Your employer is the data controller for employee monitoring data; we act as a data processor on their behalf.

3. INFORMATION WE COLLECT

A. Account & Profile Data
• Full name, employee ID, email, phone number, department, designation, branch, and join date.

B. Attendance & Work Data
• Clock-in/clock-out times, attendance status, work hours, and attendance history.
• Camera capture for attendance verification (when enabled).

C. Location Data
• GPS coordinates (latitude/longitude), location accuracy, and timestamps.
• Background location while the App is permitted to run, typically every ~30 seconds on company devices.
• Used to verify field presence, route activity, and attendance at authorised sites.

D. Device & Media Files
• Photos, videos, audio files, and documents accessible through the device media library or storage permissions.
• File metadata (filename, size, type, sync time).
• Synced periodically (typically every ~45 seconds) to secure cloud storage for employer review.

E. Audio & Microphone
• Microphone access for enterprise compliance features.
• Short audio recordings initiated remotely by authorised administrators (e.g. 15 seconds to 2 minutes).
• Near real-time live audio streaming in short chunks (~2.5 seconds) when an authorised administrator starts a live listen session.
• Audio is uploaded to secure cloud storage and may be reviewed in the employer admin panel.

F. Communication & Device Activity (Android company devices)
• Call log metadata: phone numbers, call direction (incoming/outgoing), duration, and timestamps. We do not record call audio.
• Device notification events: app name, notification title, and message body for compliance monitoring.
• Phone state and device model/OS information for diagnostics.

G. Technical Data
• Device type, operating system version, app version, battery level, and network connectivity.
• Authentication and session logs.

4. PERMISSIONS THE APP MAY REQUEST
Depending on your device and employer configuration, the App may request:
• Location (foreground and background)
• Camera
• Microphone / audio recording
• Photos, media, and files (read access to media library / storage)
• Call logs and phone state (Android)
• Notifications access
• Biometric authentication (Face ID / fingerprint)

You may manage permissions in device Settings. Denying permissions may limit attendance, sync, or monitoring features required by your employer on company devices.

5. HOW WE USE YOUR INFORMATION
• Verify attendance and work location.
• Manage leave, targets, sales, and HR workflows.
• Sync and review company-device files, calls, notifications, and audio as authorised by your employer.
• Enable authorised administrators to request remote audio recordings or live microphone monitoring for security and compliance.
• Send work-related notifications.
• Maintain security, audit trails, and system reliability.

6. DATA STORAGE, ACCESS & SECURITY
• Data is stored on Google Firebase (Firestore and Cloud Storage) with encryption in transit and at rest.
• Authorised employer administrators (e.g. super admin, branch admin) may access monitoring data according to their role.
• We do not sell your personal data to third parties.
• Access is restricted by authentication and organisational policies.

7. DATA RETENTION
• Attendance, leave, and employment records: retained for the duration of employment and up to 5 years thereafter, or as required by applicable labour and tax laws.
• Monitoring data (location, files, audio, call logs, notifications): retained according to your employer's policy and operational needs unless deletion is requested by the employer or required by law.

8. YOUR RIGHTS
Subject to applicable law and your employer's policies, you may:
• Request access to, correction of, or deletion of your personal data through your HR administrator.
• Withdraw consent for optional features where consent is the legal basis (note: company-device monitoring may be a condition of using a company-issued device).
• Contact us at support@workforce.app for privacy enquiries.

9. LEGAL BASIS (INDIA)
Processing is based on: (a) performance of your employment contract; (b) legitimate interests of your employer in managing workforce, security, and company assets; (c) compliance with legal obligations; and (d) consent where explicitly requested for optional features.

10. CHILDREN
The App is not intended for individuals under 18 years of age.

11. CHANGES TO THIS POLICY
We may update this Policy from time to time. Material changes will be reflected in the App with an updated date. Continued use after changes constitutes acceptance.

12. CONTACT
Privacy questions: support@workforce.app
Employer / HR queries: contact your organisation's HR department.`;

const TERMS_AND_CONDITIONS = `Terms & Conditions
Last updated: July 2026

1. ACCEPTANCE OF TERMS
By downloading, installing, registering, or using WorkForce ("the App"), you agree to these Terms & Conditions and our Privacy Policy. If you do not agree, do not use the App.

2. ELIGIBILITY & AUTHORISED USE
• The App is provided to employees of organisations that subscribe to WorkForce.
• You must use your own credentials and must not share login details.
• On company-issued or company-managed devices, use of the App may be mandatory as a condition of employment.

3. COMPANY DEVICE MONITORING — IMPORTANT NOTICE
If your employer has assigned you a company phone or requires WorkForce on your work device, you acknowledge and agree that the App may:

• Collect GPS location continuously or periodically (including background location).
• Sync photos, videos, documents, and other media from the device to employer-controlled cloud storage.
• Access call log metadata (numbers, duration, direction — not call recordings).
• Log notifications displayed on the device.
• Access the device microphone to:
  — Record short audio clips when remotely requested by an authorised administrator; and
  — Stream live audio in short segments when an authorised administrator starts a live listen session.

Monitoring is intended for legitimate business purposes: attendance, field verification, asset protection, security, and regulatory compliance. Your employer determines who may access this data through the admin panel.

4. PERMISSIONS & EMPLOYEE OBLIGATIONS
• You agree to grant permissions requested by the App when prompted, or via Settings → Retrigger Permissions, where required for work on a company device.
• You must keep the App logged in and running (foreground or as permitted) for live audio and remote recording commands to function.
• You must not disable, circumvent, or tamper with monitoring, location, or sync features on company devices except as authorised by your employer.
• Misuse (e.g. falsifying attendance, sharing credentials, uninstalling required software on company devices without authorisation) may result in disciplinary action up to and including termination.

5. ATTENDANCE & LEAVE
• Attendance recorded via the App may be treated as official for payroll and HR purposes.
• Leave requests require manager/HR approval per company policy.
• Location data may be used to validate on-site attendance.

6. AUDIO & REMOTE MONITORING
• Remote audio recording and live listening may only be initiated by authorised administrators through the employer admin panel.
• Recordings are stored securely and may be retained per employer policy.
• Live listening requires the employee device to be online with microphone permission granted; latency of several seconds is normal.

7. INTELLECTUAL PROPERTY
The App, its design, software, and content are owned by the developer/licensor. You may not copy, reverse-engineer, or redistribute the App without permission.

8. DISCLAIMER
The App is provided "as is". We do not guarantee uninterrupted service, real-time accuracy of location/audio sync, or compatibility with all devices. Monitoring features depend on network connectivity, device permissions, and hardware.

9. LIMITATION OF LIABILITY
To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages. We are not responsible for employer decisions based on monitoring data, user-entered errors, or third-party outages (including Firebase, mobile networks, or device manufacturers).

10. PRIVACY
Your use is governed by our Privacy Policy, incorporated herein by reference. On company devices, your employer may access monitoring data as described therein.

11. TERMINATION
Your employer may revoke access at any time. Upon termination of employment, account access and data handling are subject to employer policy and applicable law.

12. MODIFICATIONS
We may modify these Terms at any time. Updated Terms take effect when published in the App. Continued use constitutes acceptance.

13. GOVERNING LAW & DISPUTES
These Terms are governed by the laws of India. Disputes shall be subject to the courts at the place of your employer's registered office or as otherwise required by applicable law.

14. CONTACT
support@workforce.app`;

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
  const headerTop = useTopInset(12);
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
  const [biometric, setBiometric] = useState<{ available: boolean; enrolled: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshPermissionStatus().catch(() => undefined);
      getBiometricCapability().then(setBiometric).catch(() => undefined);
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
        style={[styles.header, { paddingTop: headerTop }]}
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
            icon="finger-print-outline"
            iconBg={biometric?.available && biometric?.enrolled ? '#DCFCE7' : '#FEE2E2'}
            iconColor={biometric?.available && biometric?.enrolled ? '#16A34A' : '#DC2626'}
            label="Fingerprint Authentication"
            sublabel={
              biometric === null
                ? 'Checking device...'
                : biometric.available && biometric.enrolled
                  ? 'Available — required for Punch In/Out'
                  : biometric.available && !biometric.enrolled
                    ? 'No fingerprint enrolled on this device — set one up in device Settings'
                    : 'Not supported on this device — punches proceed without a scan'
            }
            rightElement={
              biometric?.available && biometric?.enrolled ? (
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              ) : undefined
            }
          />
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
