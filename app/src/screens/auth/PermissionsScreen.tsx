import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';

type PermissionsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Permissions'
>;

interface Props {
  navigation: PermissionsScreenNavigationProp;
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
    description: 'To mark accurate attendance',
  },
  {
    key: 'storage',
    icon: 'document-outline',
    iconBg: '#16A34A',
    title: 'Storage',
    description: 'To upload documents',
  },
  {
    key: 'camera',
    icon: 'camera-outline',
    iconBg: '#7C3AED',
    title: 'Camera',
    description: 'To capture photos',
  },
  {
    key: 'callLogs',
    icon: 'call-outline',
    iconBg: '#D97706',
    title: 'Call Logs',
    description: 'To sync call logs (if allowed)',
  },
  {
    key: 'microphone',
    icon: 'mic-outline',
    iconBg: '#DC2626',
    title: 'Microphone',
    description: 'To record audio (if allowed)',
  },
];

const PermissionsScreen: React.FC<Props> = ({ navigation }) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {})
  );

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { loginWithBiometric } = useAuth();

  const handleAllowAll = async () => {
    const allOn = PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {});
    setPermissions(allOn);
    await loginWithBiometric();
    // Navigator auto-switches to authenticated stack once user is set
  };

  const handleSkip = async () => {
    await loginWithBiometric();
    // Navigator auto-switches to authenticated stack once user is set
  };

  const allEnabled = PERMISSIONS.every((p) => permissions[p.key]);

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
        {/* Intro */}
        <Text style={styles.introText}>
          We need the following permissions to provide you a better experience.
        </Text>

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
                value={permissions[permission.key]}
                onValueChange={() => togglePermission(permission.key)}
                trackColor={{ false: '#E2E8F0', true: '#BFDBFE' }}
                thumbColor={permissions[permission.key] ? '#2563EB' : '#FFFFFF'}
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
          style={[styles.allowAllButton, allEnabled && styles.allowAllButtonActive]}
          onPress={handleAllowAll}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" style={styles.allowIcon} />
          <Text style={styles.allowAllText}>Allow All</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
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
  introText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
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
  allowIcon: {},
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
