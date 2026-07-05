import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { RootStackParamList, SignUpData } from '../../types';
import { db } from '../../services/firebase';
import { firebaseSignUp } from '../../services/FirebaseService';
import { requestEnterprisePermissions, requestCameraPermission } from '../../services/enterprisePermissions';
import BrandLogo from '../../components/common/BrandLogo';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Permissions'>;
type Route = RouteProp<RootStackParamList, 'Permissions'>;

interface Props {
  navigation: Nav;
  route: Route;
}

async function createFirebaseAccount(signUpData: SignUpData): Promise<void> {
  const result = await firebaseSignUp(signUpData.email, signUpData.password);
  if (!result) throw new Error('auth/email-already-in-use');
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

const PermissionsScreen: React.FC<Props> = ({ route }) => {
  const signUpData = (route.params as { signUpData?: SignUpData } | undefined)?.signUpData;
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await requestEnterprisePermissions();
        await requestCameraPermission();
        await LocalAuthentication.hasHardwareAsync();

        if (signUpData && !cancelled) {
          await createFirebaseAccount(signUpData);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('email-already-in-use')) {
          setError('This email is already registered.');
        } else if (msg.includes('weak-password')) {
          setError('Password is too weak.');
        } else if (msg.includes('network-request-failed')) {
          setError('No internet connection.');
        } else {
          setError('Setup failed. Please try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signUpData]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <BrandLogo size="sm" showName theme="light" style={styles.logo} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color="#2563EB" style={styles.spinner} />
            <Text style={styles.text}>Please allow each permission when prompted…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { marginBottom: 32 },
  spinner: { marginBottom: 16 },
  text: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  error: { fontSize: 14, color: '#DC2626', textAlign: 'center', lineHeight: 20 },
});

export default PermissionsScreen;
