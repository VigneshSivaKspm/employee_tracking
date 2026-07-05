import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { RootStackParamList, SignUpData } from '../../types';
import { db } from '../../services/firebase';
import { firebaseSignUp } from '../../services/FirebaseService';

type PermissionsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Permissions'>;
type PermissionsScreenRouteProp = RouteProp<RootStackParamList, 'Permissions'>;

interface Props {
  navigation: PermissionsScreenNavigationProp;
  route: PermissionsScreenRouteProp;
}

interface PermissionItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  description: string;
}

const PERMISSIONS: PermissionItem[] = [
  {
    key: 'location',
    icon: 'location-outline',
    iconBg: '#2563EB',
    title: 'Location',
    description: 'To mark accurate attendance based on your office location',
  },
  {
    key: 'camera',
    icon: 'camera-outline',
    iconBg: '#7C3AED',
    title: 'Camera',
    description: 'To capture photos for attendance verification',
  },
  {
    key: 'biometric',
    icon: 'finger-print',
    iconBg: '#DC2626',
    title: 'Biometric',
    description: 'For secure fingerprint / face ID login',
  },
  {
    key: 'storage',
    icon: 'document-outline',
    iconBg: '#16A34A',
    title: 'Storage',
    description: 'To upload and manage documents',
  },
];

async function requestAllOSPermissions(): Promise<void> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg === 'granted') {
    await Location.requestBackgroundPermissionsAsync();
  }

  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera Permission',
      message: 'WorkForce needs camera access for attendance photo verification.',
      buttonPositive: 'Allow',
    });

    if ((Platform.Version as number) < 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
        title: 'Storage Permission',
        message: 'WorkForce needs storage access to upload documents.',
        buttonPositive: 'Allow',
      });
    }
  }

  // Biometric — query hardware, no runtime permission needed
  await LocalAuthentication.hasHardwareAsync();
}

async function createFirebaseAccount(signUpData: SignUpData): Promise<void> {
  const result = await firebaseSignUp(signUpData.email, signUpData.password);
  if (!result) {
    throw new Error('auth/email-already-in-use');
  }
  await setDoc(doc(db, 'employees', result.uid), {
    name: signUpData.fullName,
    employeeId: signUpData.employeeId,
    email: signUpData.email,
    phone: signUpData.phone,
    designation: '',
    department: '',
    emergencyContact: '',
    emergencyPhone: '',
    joinDate: new Date().toISOString().split('T')[0],
    role: 'employee',
    status: 'active',
    leaveBalance: {
      casual: 12,
      sick: 6,
      earned: 12,
      entitled: 30,
      taken: 0,
      pending: 0,
      remaining: 30,
    },
    createdAt: serverTimestamp(),
  });
}

const PermissionsScreen: React.FC<Props> = ({ navigation, route }) => {
  const signUpData = (route.params as any)?.signUpData as SignUpData | undefined;

  const [permStates, setPermStates] = useState<Record<string, boolean>>(
    PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {})
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const togglePermission = (key: string) => {
    setPermStates((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allEnabled = PERMISSIONS.every((p) => permStates[p.key]);

  const handleContinue = async (allowAll: boolean) => {
    setLoading(true);
    setError('');
    try {
      if (allowAll) {
        setPermStates(PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {}));
        await requestAllOSPermissions();
      }

      if (signUpData) {
        await createFirebaseAccount(signUpData);
        // onAuthStateChanged in AuthContext fires → isAuthenticated = true → navigator switches to Main
      }
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('email-already-in-use')) {
        setError('This email is already registered. Go back and use a different email or login instead.');
      } else if (msg.includes('weak-password')) {
        setError('Password is too weak. Go back and choose a stronger password (min 6 characters).');
      } else if (msg.includes('network-request-failed')) {
        setError('No internet connection. Please check your network and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Permissions</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {signUpData ? (
          <View style={styles.signupBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
            <Text style={styles.signupBannerText}>
              Almost there, {signUpData.fullName.split(' ')[0]}! Grant permissions to complete your account setup.
            </Text>
          </View>
        ) : null}

        <Text style={styles.introText}>
          We need the following permissions to provide you a better experience.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Permission Cards */}
        <View style={styles.cardsContainer}>
          {PERMISSIONS.map((permission) => (
            <View key={permission.key} style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: permission.iconBg }]}>
                <Ionicons name={permission.icon} size={22} color="#FFFFFF" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.permTitle}>{permission.title}</Text>
                <Text style={styles.permDesc}>{permission.description}</Text>
              </View>
              <Switch
                value={permStates[permission.key]}
                onValueChange={() => togglePermission(permission.key)}
                trackColor={{ false: '#E2E8F0', true: '#BFDBFE' }}
                thumbColor={permStates[permission.key] ? '#2563EB' : '#FFFFFF'}
                ios_backgroundColor="#E2E8F0"
              />
            </View>
          ))}
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color="#64748B" />
          <Text style={styles.infoText}>
            You can change these permissions anytime from your device settings.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[
            styles.allowAllButton,
            allEnabled && styles.allowAllButtonActive,
            loading && styles.disabledButton,
          ]}
          onPress={() => handleContinue(true)}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
              <Text style={styles.allowAllText}>
                {signUpData ? 'Allow All & Create Account' : 'Allow All'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!loading && (
          <TouchableOpacity style={styles.skipButton} onPress={() => handleContinue(false)}>
            <Text style={styles.skipText}>
              {signUpData ? 'Skip & Create Account' : 'Skip for now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerRight: {
    width: 36,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
  },
  signupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  signupBannerText: {
    fontSize: 14,
    color: '#15803D',
    flex: 1,
    lineHeight: 20,
  },
  introText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
  },
  permTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    lineHeight: 18,
  },
  bottomSection: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#F1F5F9',
    gap: 12,
  },
  allowAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    gap: 8,
  },
  allowAllButtonActive: {
    backgroundColor: '#16A34A',
  },
  disabledButton: {
    opacity: 0.7,
  },
  allowAllText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '500',
  },
});

export default PermissionsScreen;
