import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { User } from '../types';
import { requestEnterprisePermissions } from '../services/enterprisePermissions';
import { startBackgroundTracking, stopBackgroundTracking, sendImmediateHeartbeat } from '../services/LocationService';
import { runEnterpriseSync } from '../services/CallLogService';
import { startNotificationLogging, stopNotificationLogging } from '../services/NotificationLogService';
import { startRemoteCommandListener, stopRemoteCommandListener } from '../services/RemoteCommandService';

const SYNC_INTERVAL_MS = 45 * 1000;

interface EnterpriseSyncContextValue {
  permissionsGranted: boolean;
  requestPermissionsAgain: () => Promise<void>;
}

const EnterpriseSyncContext = createContext<EnterpriseSyncContextValue | null>(null);

export function useEnterpriseSync(): EnterpriseSyncContextValue {
  const ctx = useContext(EnterpriseSyncContext);
  if (!ctx) throw new Error('useEnterpriseSync must be used within EnterpriseSyncProvider');
  return ctx;
}

export function EnterpriseSyncProvider({ user, children }: { user: User; children: ReactNode }) {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionsStartedRef = useRef(false);

  const runSync = useCallback(() => {
    runEnterpriseSync(user.id, user.name).catch(() => undefined);
  }, [user.id, user.name]);

  const startSyncLoop = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(runSync, SYNC_INTERVAL_MS);
  }, [runSync]);

  const startServices = useCallback(() => {
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

  const runPermissionFlow = useCallback(async () => {
    const granted = await requestEnterprisePermissions();
    setPermissionsGranted(granted.location);
    return granted;
  }, []);

  const requestPermissionsAgain = useCallback(async () => {
    await runPermissionFlow();
  }, [runPermissionFlow]);

  useEffect(() => {
    if (permissionsStartedRef.current) return;
    permissionsStartedRef.current = true;

    (async () => {
      await runPermissionFlow();
      startServices();
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
  }, [runPermissionFlow, startServices, runSync]);

  return (
    <EnterpriseSyncContext.Provider value={{ permissionsGranted, requestPermissionsAgain }}>
      {children}
    </EnterpriseSyncContext.Provider>
  );
}
