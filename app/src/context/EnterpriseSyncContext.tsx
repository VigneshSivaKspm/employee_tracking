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
import {
  requestEnterprisePermissions,
  getEnterprisePermissionStatus,
  retriggerMissingPermissions,
  type EnterprisePermissionStatus,
} from '../services/enterprisePermissions';
import { startBackgroundTracking, stopBackgroundTracking, sendImmediateHeartbeat } from '../services/LocationService';
import { runEnterpriseSync } from '../services/CallLogService';
import { startNotificationLogging, stopNotificationLogging } from '../services/NotificationLogService';
import { startRemoteCommandListener, stopRemoteCommandListener, restartRemoteCommandListener } from '../services/RemoteCommandService';

const SYNC_INTERVAL_MS = 45 * 1000;

interface EnterpriseSyncContextValue {
  permissionsGranted: boolean;
  permissionStatus: EnterprisePermissionStatus | null;
  missingPermissionCount: number;
  requestPermissionsAgain: () => Promise<void>;
  retriggerMissingPermissions: () => Promise<EnterprisePermissionStatus>;
  refreshPermissionStatus: () => Promise<EnterprisePermissionStatus>;
}

const EnterpriseSyncContext = createContext<EnterpriseSyncContextValue | null>(null);

export function useEnterpriseSync(): EnterpriseSyncContextValue {
  const ctx = useContext(EnterpriseSyncContext);
  if (!ctx) throw new Error('useEnterpriseSync must be used within EnterpriseSyncProvider');
  return ctx;
}

export function EnterpriseSyncProvider({ user, children }: { user: User; children: ReactNode }) {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<EnterprisePermissionStatus | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionsStartedRef = useRef(false);

  const applyPermissionStatus = useCallback((granted: EnterprisePermissionStatus) => {
    setPermissionStatus(granted);
    setPermissionsGranted(granted.location);
    return granted;
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    const status = await getEnterprisePermissionStatus();
    return applyPermissionStatus(status);
  }, [applyPermissionStatus]);

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
    return applyPermissionStatus(granted);
  }, [applyPermissionStatus]);

  const requestPermissionsAgain = useCallback(async () => {
    await runPermissionFlow();
  }, [runPermissionFlow]);

  const retriggerMissing = useCallback(async () => {
    const status = await retriggerMissingPermissions();
    applyPermissionStatus(status);
    restartRemoteCommandListener(user.id, user.name);
    if (status.location) {
      startBackgroundTracking({
        userId: user.id,
        employeeName: user.name,
        department: user.department,
      });
      runSync();
    }
    return status;
  }, [applyPermissionStatus, user, runSync]);

  const missingPermissionCount = permissionStatus
    ? Object.values(permissionStatus).filter(v => !v).length
    : 0;

  useEffect(() => {
    if (permissionsStartedRef.current) return;
    permissionsStartedRef.current = true;

    (async () => {
      await runPermissionFlow();
      startServices();
    })();

    refreshPermissionStatus().catch(() => undefined);

    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        restartRemoteCommandListener(user.id, user.name);
        refreshPermissionStatus().catch(() => undefined);
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
  }, [runPermissionFlow, startServices, runSync, refreshPermissionStatus]);

  return (
    <EnterpriseSyncContext.Provider
      value={{
        permissionsGranted,
        permissionStatus,
        missingPermissionCount,
        requestPermissionsAgain,
        retriggerMissingPermissions: retriggerMissing,
        refreshPermissionStatus,
      }}
    >
      {children}
    </EnterpriseSyncContext.Provider>
  );
}
