import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';
import {
  requestEnterprisePermissions,
  showCompanyDeviceNotice,
  type EnterprisePermissionKey,
} from '../services/enterprisePermissions';
import { startBackgroundTracking, stopBackgroundTracking, requestLocationPermissions, sendImmediateHeartbeat } from '../services/LocationService';
import { runEnterpriseSync } from '../services/CallLogService';
import { startNotificationLogging, stopNotificationLogging } from '../services/NotificationLogService';
import { startRemoteCommandListener, stopRemoteCommandListener } from '../services/RemoteCommandService';

const SETUP_KEY = '@workforce_enterprise_setup_v1';
/** Files, call logs, device metadata — every 45 seconds */
const SYNC_INTERVAL_MS = 45 * 1000;

interface EnterpriseSyncContextValue {
  permissionsGranted: boolean;
  showSetup: () => void;
}

const EnterpriseSyncContext = createContext<EnterpriseSyncContextValue | null>(null);

export function useEnterpriseSync(): EnterpriseSyncContextValue {
  const ctx = useContext(EnterpriseSyncContext);
  if (!ctx) throw new Error('useEnterpriseSync must be used within EnterpriseSyncProvider');
  return ctx;
}

const PERM_LABELS: Record<EnterprisePermissionKey, string> = {
  location: 'Location (live GPS every 30s)',
  backgroundLocation: 'Background location',
  microphone: 'Microphone (live listen from admin)',
  mediaLibrary: 'Photos, videos & audio files',
  callLog: 'Call history',
  phoneState: 'Phone state',
  notifications: 'Notification access',
};

function CompanyDeviceSetupModal({
  visible,
  onComplete,
}: {
  visible: boolean;
  onComplete: (granted: Record<EnterprisePermissionKey, boolean>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<EnterprisePermissionKey, boolean> | null>(null);

  const handlePress = async () => {
    if (results) {
      onComplete(results);
      return;
    }
    setLoading(true);
    showCompanyDeviceNotice();
    const granted = await requestEnterprisePermissions();
    setResults(granted);
    setLoading(false);
    await AsyncStorage.setItem(SETUP_KEY, 'true');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Company Device Setup</Text>
          <Text style={styles.subtitle}>
            This phone is company-owned. Location, files, calls, and notifications sync continuously.
            Your administrator can listen live through the device microphone when required.
          </Text>

          <View style={styles.list}>
            {Object.entries(PERM_LABELS).map(([key, label]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                {results ? (
                  <Text style={results[key as EnterprisePermissionKey] ? styles.ok : styles.miss}>
                    {results[key as EnterprisePermissionKey] ? 'Granted' : 'Denied'}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            Keep the app installed and permissions granted. Sync runs automatically in the background.
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.button} onPress={handlePress} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>{results ? 'Continue to App' : 'Grant All Permissions'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export function EnterpriseSyncProvider({ user, children }: { user: User; children: ReactNode }) {
  const [setupVisible, setSetupVisible] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runSync = useCallback(() => {
    runEnterpriseSync(user.id, user.name).catch(() => undefined);
  }, [user.id, user.name]);

  const startSyncLoop = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(runSync, SYNC_INTERVAL_MS);
  }, [runSync]);

  const startServices = useCallback(async () => {
    const locOk = await requestLocationPermissions();
    setPermissionsGranted(locOk);

    startBackgroundTracking({
      userId: user.id,
      employeeName: user.name,
      department: user.department,
    });

    startNotificationLogging(user.id, user.name);
    startRemoteCommandListener(user.id, user.name);
    runSync();
    startSyncLoop();
  }, [user, runSync, startSyncLoop]);

  useEffect(() => {
    (async () => {
      const done = await AsyncStorage.getItem(SETUP_KEY);
      if (!done) {
        setSetupVisible(true);
        return;
      }
      await startServices();
    })();

    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        sendImmediateHeartbeat().catch(() => undefined);
        runSync();
      }
    });

    return () => {
      appStateSub.remove();
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      stopBackgroundTracking();
      stopNotificationLogging();
      stopRemoteCommandListener();
    };
  }, [startServices, runSync]);

  const onSetupComplete = async (granted: Record<EnterprisePermissionKey, boolean>) => {
    setSetupVisible(false);
    setPermissionsGranted(granted.location);
    await startServices();
  };

  return (
    <EnterpriseSyncContext.Provider
      value={{
        permissionsGranted,
        showSetup: () => setSetupVisible(true),
      }}
    >
      {children}
      <CompanyDeviceSetupModal visible={setupVisible} onComplete={onSetupComplete} />
    </EnterpriseSyncContext.Provider>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 48 },
  scroll: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748B', lineHeight: 22, marginBottom: 24 },
  list: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: '#334155', flex: 1, paddingRight: 8 },
  ok: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  miss: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  note: { fontSize: 12, color: '#94A3B8', marginTop: 16, lineHeight: 18 },
  button: {
    margin: 24,
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
