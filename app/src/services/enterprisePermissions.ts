import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { getNotifications, requestMediaLibraryPermission, isExpoGo, hasMediaLibraryPermission } from './nativeModules';

export type EnterprisePermissionKey =
  | 'location'
  | 'backgroundLocation'
  | 'microphone'
  | 'mediaLibrary'
  | 'callLog'
  | 'phoneState'
  | 'notifications';

export type EnterprisePermissionStatus = Record<EnterprisePermissionKey, boolean>;

export const PERMISSION_LABELS: Record<EnterprisePermissionKey, string> = {
  location: 'Location (GPS)',
  backgroundLocation: 'Background Location',
  microphone: 'Microphone',
  mediaLibrary: 'Photos & Media',
  callLog: 'Call Logs',
  phoneState: 'Phone State',
  notifications: 'Notifications',
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, delay(ms).then(() => null)]);
}

async function requestAndroidPermission(
  permission: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS],
  title: string,
  message: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const already = await PermissionsAndroid.check(permission);
    if (already) return true;
    await delay(400);
    const result = await PermissionsAndroid.request(permission, {
      title,
      message,
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Requests each system permission dialog sequentially — no custom UI. */
export async function requestEnterprisePermissions(): Promise<Record<EnterprisePermissionKey, boolean>> {
  const result: Record<EnterprisePermissionKey, boolean> = {
    location: false,
    backgroundLocation: false,
    microphone: false,
    mediaLibrary: false,
    callLog: false,
    phoneState: false,
    notifications: false,
  };

  // 1 Location (foreground)
  try {
    await delay(400);
    const fgResult = await withTimeout(Location.requestForegroundPermissionsAsync(), 20000);
    result.location = fgResult?.status === 'granted';
  } catch (e) {
    console.warn('[EnterprisePermissions] location:', e);
  }

  // 2 Background location
  try {
    await delay(400);
    if (result.location) {
      const bgResult = await withTimeout(Location.requestBackgroundPermissionsAsync(), 15000);
      result.backgroundLocation = bgResult?.status === 'granted';
    }
  } catch (e) {
    console.warn('[EnterprisePermissions] background location:', e);
  }

  // 3 Microphone
  try {
    await delay(400);
    const micResult = await withTimeout(Audio.requestPermissionsAsync(), 15000);
    result.microphone = micResult?.status === 'granted';
  } catch (e) {
    console.warn('[EnterprisePermissions] microphone:', e);
  }

  // 4 Media / storage
  try {
    await delay(400);
    result.mediaLibrary = await requestMediaLibraryPermission();
    if (Platform.OS === 'android') {
      if ((Platform.Version as number) >= 33) {
        const img = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          'Photos',
          'Allow photo access on this company device.',
        );
        const vid = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          'Videos',
          'Allow video access on this company device.',
        );
        result.mediaLibrary = result.mediaLibrary || img || vid;
        if (!isExpoGo()) {
          const aud = await requestAndroidPermission(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
            'Audio',
            'Allow audio file access on this company device.',
          );
          result.mediaLibrary = result.mediaLibrary || aud;
        }
      } else {
        const storage = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          'Storage',
          'Allow file access on this company device.',
        );
        result.mediaLibrary = result.mediaLibrary || storage;
      }
      if ((Platform.Version as number) >= 30 && !isExpoGo()) {
        const { requestAllFilesAccess } = await import('./storageAccess');
        await requestAllFilesAccess();
      }
    }
  } catch (e) {
    console.warn('[EnterprisePermissions] media:', e);
  }

  // 5 Call log
  if (Platform.OS === 'android') {
    await delay(400);
    result.callLog = await requestAndroidPermission(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      'Call Logs',
      'Allow call history sync on this company device.',
    );
  }

  // 6 Phone state
  if (Platform.OS === 'android') {
    await delay(400);
    result.phoneState = await requestAndroidPermission(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      'Phone State',
      'Allow phone state access on this company device.',
    );
  }

  // 7 Notifications
  try {
    await delay(400);
    const Notifications = await getNotifications();
    if (Notifications) {
      const notif = await withTimeout(Notifications.requestPermissionsAsync(), 15000);
      result.notifications = notif?.status === 'granted';
    }
  } catch (e) {
    console.warn('[EnterprisePermissions] notifications:', e);
  }

  return result;
}

/** Read current permission state without showing dialogs. */
export async function getEnterprisePermissionStatus(): Promise<EnterprisePermissionStatus> {
  const status: EnterprisePermissionStatus = {
    location: false,
    backgroundLocation: false,
    microphone: false,
    mediaLibrary: false,
    callLog: false,
    phoneState: false,
    notifications: false,
  };

  try {
    const fg = await Location.getForegroundPermissionsAsync();
    status.location = fg.status === 'granted';
    const bg = await Location.getBackgroundPermissionsAsync();
    status.backgroundLocation = bg.status === 'granted';
  } catch (e) {
    console.warn('[EnterprisePermissions] status location:', e);
  }

  try {
    const mic = await Audio.getPermissionsAsync();
    status.microphone = mic.status === 'granted';
  } catch (e) {
    console.warn('[EnterprisePermissions] status microphone:', e);
  }

  try {
    status.mediaLibrary = await hasMediaLibraryPermission();
    if (Platform.OS === 'android') {
      if ((Platform.Version as number) >= 33) {
        const img = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
        const vid = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
        status.mediaLibrary = status.mediaLibrary || img || vid;
        if (!isExpoGo()) {
          const aud = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
          status.mediaLibrary = status.mediaLibrary || aud;
        }
      } else {
        const storage = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        status.mediaLibrary = status.mediaLibrary || storage;
      }
    }
  } catch (e) {
    console.warn('[EnterprisePermissions] status media:', e);
  }

  if (Platform.OS === 'android') {
    try {
      status.callLog = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      status.phoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    } catch (e) {
      console.warn('[EnterprisePermissions] status phone:', e);
    }
  }

  try {
    const Notifications = await getNotifications();
    if (Notifications) {
      const notif = await Notifications.getPermissionsAsync();
      status.notifications = notif.status === 'granted';
    }
  } catch (e) {
    console.warn('[EnterprisePermissions] status notifications:', e);
  }

  return status;
}

export function getMissingPermissionKeys(status: EnterprisePermissionStatus): EnterprisePermissionKey[] {
  return (Object.keys(status) as EnterprisePermissionKey[]).filter(key => !status[key]);
}

export function formatMissingPermissionLabels(status: EnterprisePermissionStatus): string[] {
  return getMissingPermissionKeys(status).map(key => PERMISSION_LABELS[key]);
}

/** Re-request only permissions that are currently missing. */
export async function retriggerMissingPermissions(): Promise<EnterprisePermissionStatus> {
  const before = await getEnterprisePermissionStatus();
  const missing = getMissingPermissionKeys(before);
  if (missing.length > 0) {
    await requestEnterprisePermissions();
  }
  return getEnterprisePermissionStatus();
}

/** Camera for attendance — separate native dialog. */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    await delay(400);
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera',
      message: 'Allow camera for attendance verification.',
      buttonPositive: 'Allow',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
