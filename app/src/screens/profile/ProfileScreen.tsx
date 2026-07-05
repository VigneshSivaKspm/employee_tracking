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
          colors={['#2563EB', '#1D4ED8']}
          style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
                </View>
                <View style={styles.cameraOverlay}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.headerName}>{name || 'Employee'}</Text>
            <Text style={styles.headerDesignation}>{designation || 'Designation not set'}</Text>
            <View style={styles.chipsRow}>
              {department ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Dept: {department}</Text>
                </View>
              ) : null}
              {employeeId ? (
                <View style={styles.chip}>
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
  headerGradient: {
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerDesignation: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  cardsContainer: {
    marginTop: -20,
    marginHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  documentText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingsLabel: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '600',
  },
});
