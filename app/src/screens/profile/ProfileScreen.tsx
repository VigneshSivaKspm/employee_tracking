import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

type RootStackParamList = {
  EditProfile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
  AnnouncementDetail: { announcementId: string };
  Settings: undefined;
  SubscriptionPlans: undefined;
  EngineeringMenu: undefined;
  Login: undefined;
  Targets: undefined;
  ServiceRequests: undefined;
  Calendar: undefined;
  Sales: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatJoinDate(raw: string): string {
  if (!raw) return 'Not set';
  // Handle ISO date strings like 2026-07-05
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

interface InfoRowProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label: string;
  value: string;
}

function InfoRow({ iconName, iconBg, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.infoTextBlock}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not set'}</Text>
      </View>
    </View>
  );
}

interface SettingsRowProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label: string;
  onPress: () => void;
  badge?: string;
  isLast?: boolean;
}

function SettingsRow({ iconName, iconBg, label, onPress, badge, isLast }: SettingsRowProps) {
  return (
    <>
      <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.settingsLabel}>{label}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const getInitials = (name: string): string => {
    if (!name || !name.trim()) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarPress = () => {
    Alert.alert(
      'Upload Photo',
      'Photo upload requires Firebase Storage setup in the admin console. Feature coming in next update.',
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const name = user?.name ?? '';
  const email = user?.email ?? '';
  const employeeId = user?.employeeId ?? '';
  const designation = user?.designation ?? '';
  const department = user?.department ?? '';
  const phone = user?.phone ?? '';
  const emergencyContact = user?.emergencyContact ?? '';
  const emergencyPhone = user?.emergencyPhone ?? '';
  const joinDate = formatJoinDate(user?.joinDate ?? '');
  const bankAccount = user?.bankAccount ?? '';
  const bankName = user?.bankName ?? '';
  const ifscCode = user?.ifscCode ?? '';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Gradient */}
        <LinearGradient
          colors={['#1E3A8A', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
        >
          {/* Decorative circles */}
          <View style={styles.decor1} />
          <View style={styles.decor2} />

          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
                </View>
                <View style={styles.cameraOverlay}>
                  <Ionicons name="camera" size={13} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.headerName}>{name || 'Employee'}</Text>
            <Text style={styles.headerDesignation}>{designation || 'Designation not set'}</Text>
            <View style={styles.chipsRow}>
              {department ? (
                <View style={styles.chip}>
                  <Ionicons name="business-outline" size={11} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.chipText}>{department}</Text>
                </View>
              ) : null}
              {employeeId ? (
                <View style={styles.chip}>
                  <Ionicons name="id-card-outline" size={11} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.chipText}>{employeeId}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Info Cards */}
        <View style={styles.cardsContainer}>

          {/* Personal Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Details</Text>
            <InfoRow iconName="person-outline" iconBg="#2563EB" label="Full Name" value={name} />
            <View style={styles.divider} />
            <InfoRow iconName="id-card-outline" iconBg="#7C3AED" label="Employee ID" value={employeeId} />
            <View style={styles.divider} />
            <InfoRow iconName="mail-outline" iconBg="#16A34A" label="Email" value={email} />
            <View style={styles.divider} />
            <InfoRow iconName="call-outline" iconBg="#D97706" label="Mobile" value={phone} />
          </View>

          {/* Contact Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact Information</Text>
            <InfoRow iconName="location-outline" iconBg="#2563EB" label="Department" value={department} />
            <View style={styles.divider} />
            <InfoRow iconName="business-outline" iconBg="#16A34A" label="Join Date" value={joinDate} />
          </View>

          {/* Emergency Contact */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Emergency Contact</Text>
            <InfoRow
              iconName="person-circle-outline"
              iconBg="#DC2626"
              label={emergencyContact || 'Emergency Contact'}
              value={emergencyPhone || 'Not set'}
            />
          </View>

          {/* Bank Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bank Details</Text>
            <InfoRow
              iconName="card-outline"
              iconBg="#2563EB"
              label="Bank Account"
              value={bankAccount || 'Not configured'}
            />
            <View style={styles.divider} />
            <InfoRow
              iconName="business-outline"
              iconBg="#16A34A"
              label="Bank Name"
              value={bankName || 'Not configured'}
            />
            <View style={styles.divider} />
            <InfoRow
              iconName="document-text-outline"
              iconBg="#7C3AED"
              label="IFSC Code"
              value={ifscCode || 'Not configured'}
            />
          </View>

          {/* Documents */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documents</Text>
            {['Aadhaar Card', 'PAN Card', 'Offer Letter', 'Salary Slips'].map((docName, idx, arr) => (
              <React.Fragment key={docName}>
                <TouchableOpacity style={styles.documentRow} activeOpacity={0.7}>
                  <Ionicons name="document-attach-outline" size={20} color="#2563EB" />
                  <Text style={styles.documentText}>{docName}</Text>
                  <Ionicons name="download-outline" size={20} color="#2563EB" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
                {idx < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Quick Links */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Work</Text>
            <SettingsRow
              iconName="trophy-outline"
              iconBg="#2563EB"
              label="My Targets"
              onPress={() => (navigation as any).navigate('Targets')}
            />
            <SettingsRow
              iconName="receipt-outline"
              iconBg="#16A34A"
              label="Sales & Expenses"
              onPress={() => (navigation as any).navigate('Sales')}
            />
            <SettingsRow
              iconName="construct-outline"
              iconBg="#D97706"
              label="Service Requests"
              onPress={() => (navigation as any).navigate('ServiceRequests')}
            />
            <SettingsRow
              iconName="calendar-outline"
              iconBg="#7C3AED"
              label="Calendar"
              onPress={() => (navigation as any).navigate('Calendar')}
              isLast
            />
          </View>

          {/* Account / Settings */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <SettingsRow
              iconName="create-outline"
              iconBg="#2563EB"
              label="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <SettingsRow
              iconName="lock-closed-outline"
              iconBg="#7C3AED"
              label="Change Password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <SettingsRow
              iconName="star-outline"
              iconBg="#D97706"
              label="Subscription Plans"
              badge="Premium"
              onPress={() => navigation.navigate('SubscriptionPlans')}
            />
            <SettingsRow
              iconName="settings-outline"
              iconBg="#64748B"
              label="Settings"
              onPress={() => navigation.navigate('Settings')}
            />
            <SettingsRow
              iconName="construct-outline"
              iconBg="#94A3B8"
              label="Engineering Menu"
              onPress={() => navigation.navigate('EngineeringMenu')}
              isLast
            />
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  // Header
  headerGradient: {
    paddingBottom: 70,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  decor1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decor2: {
    position: 'absolute',
    bottom: -30,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 10,
    position: 'relative',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#1E40AF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  headerDesignation: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Cards
  cardsContainer: {
    marginTop: -28,
    marginHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 50,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  documentText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingsLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 15,
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#FFF5F5',
  },
  logoutText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '700',
  },
});
