/**
 * BackgroundTaskService — OS-level background execution for two purposes only:
 *
 * 1. Session location tracking: GPS while the employee is punched in, so a
 *    foreground-service notification stays visible the whole time (Android
 *    requirement) — tracking starts on Punch In and stops on Punch Out. No
 *    location is ever collected outside an active punch session.
 * 2. Periodic background sync: call-log metadata, device info, and file
 *    sync, run every ~15 minutes (OS-enforced minimum) even while the app
 *    is backgrounded.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundTask from 'expo-background-task';

const SESSION_LOCATION_TASK = 'workforce-session-location-task';
const BACKGROUND_SYNC_TASK = 'workforce-background-sync-task';

const ACTIVE_SESSION_USER_KEY = 'workforce_active_punch_session_user';
const SYNC_USER_ID_KEY = 'workforce_sync_user_id';
const SYNC_USER_NAME_KEY = 'workforce_sync_user_name';
const SYNC_DEPT_KEY = 'workforce_sync_user_dept';

// ─── Task definitions (must be registered at module load, top-level) ──────

TaskManager.defineTask(SESSION_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundTaskService] location task error', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const location = locations?.[locations.length - 1];
  if (!location) return;

  const userId = await AsyncStorage.getItem(ACTIVE_SESSION_USER_KEY);
  if (!userId) return;

  try {
    const [{ recordLocationHeartbeat }, { isWithinOfficeBoundary }] = await Promise.all([
      import('./FirebaseService'),
      import('./LocationService'),
    ]);
    const employeeName = (await AsyncStorage.getItem(SYNC_USER_NAME_KEY)) || '';
    const dept = (await AsyncStorage.getItem(SYNC_DEPT_KEY)) || '';
    const coords = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 0,
      timestamp: location.timestamp,
    };
    await recordLocationHeartbeat(
      userId,
      employeeName,
      dept,
      { lat: coords.lat, lng: coords.lng },
      0,
      isWithinOfficeBoundary(coords),
    );
  } catch (e) {
    console.warn('[BackgroundTaskService] session heartbeat write failed', e);
  }
});

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const userId = await AsyncStorage.getItem(SYNC_USER_ID_KEY);
    if (!userId) return BackgroundTask.BackgroundTaskResult.Success;
    const employeeName = (await AsyncStorage.getItem(SYNC_USER_NAME_KEY)) || '';
    const { runEnterpriseSync } = await import('./CallLogService');
    await runEnterpriseSync(userId, employeeName);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('[BackgroundTaskService] background sync task error', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ─── Session-scoped GPS tracking (Punch In → Punch Out only) ──────────────

export async function startSessionLocationTracking(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await AsyncStorage.setItem(ACTIVE_SESSION_USER_KEY, userId);

  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') return;

    const already = await Location.hasStartedLocationUpdatesAsync(SESSION_LOCATION_TASK).catch(() => false);
    if (already) return;

    await Location.startLocationUpdatesAsync(SESSION_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000,
      distanceInterval: 25,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'WorkForce — On the clock',
        notificationBody: 'Tracking your location while you are punched in. Stops automatically at Punch Out.',
        notificationColor: '#2563EB',
      },
    });
  } catch (e) {
    console.warn('[BackgroundTaskService] startSessionLocationTracking failed', e);
  }
}

export async function stopSessionLocationTracking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SESSION_USER_KEY);
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(SESSION_LOCATION_TASK).catch(() => false);
    if (already) await Location.stopLocationUpdatesAsync(SESSION_LOCATION_TASK);
  } catch (e) {
    console.warn('[BackgroundTaskService] stopSessionLocationTracking failed', e);
  }
}

export async function isSessionLocationTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(SESSION_LOCATION_TASK).catch(() => false);
}

// ─── Periodic background sync (call logs, device info, files) ─────────────

export async function registerBackgroundSync(userId: string, employeeName: string, dept: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await AsyncStorage.multiSet([
    [SYNC_USER_ID_KEY, userId],
    [SYNC_USER_NAME_KEY, employeeName],
    [SYNC_DEPT_KEY, dept],
  ]);

  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (registered) return;

    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15, // minutes — OS treats this as advisory minimum
    });
  } catch (e) {
    console.warn('[BackgroundTaskService] registerBackgroundSync failed', e);
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (registered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch (e) {
    console.warn('[BackgroundTaskService] unregisterBackgroundSync failed', e);
  }
  await AsyncStorage.multiRemove([SYNC_USER_ID_KEY, SYNC_USER_NAME_KEY, SYNC_DEPT_KEY]);
}

export async function isBackgroundSyncRegistered(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK).catch(() => false);
}
