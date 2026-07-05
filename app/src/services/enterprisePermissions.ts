import { Platform, PermissionsAndroid, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { getMediaLibrary, getNotifications, requestMediaLibraryPermission } from './nativeModules';

export type EnterprisePermissionKey =
  | 'location'
  | 'backgroundLocation'
  | 'microphone'
  | 'mediaLibrary'
  | 'callLog'
  | 'phoneState'
  | 'notifications';

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

  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    result.location = fg === 'granted';
    if (result.location) {
      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      result.backgroundLocation = bg === 'granted';
    }
  } catch (e) {
    console.warn('[EnterprisePermissions] location error:', e);
  }

  try {
    const mic = await Audio.requestPermissionsAsync();
    result.microphone = mic.status === 'granted';
  } catch (e) {
    console.warn('[EnterprisePermissions] microphone error:', e);
  }

  result.mediaLibrary = await requestMediaLibraryPermission();

  if (Platform.OS === 'android') {
    try {
      const call = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
        title: 'Company Device — Call Logs',
        message: 'This company phone syncs call history with your employer for compliance and security.',
        buttonPositive: 'Allow',
      });
      result.callLog = call === PermissionsAndroid.RESULTS.GRANTED;

      const phone = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE, {
        title: 'Company Device — Phone State',
        message: 'Required to read call metadata on this company device.',
        buttonPositive: 'Allow',
      });
      result.phoneState = phone === PermissionsAndroid.RESULTS.GRANTED;

      if ((Platform.Version as number) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES, {
          title: 'Company Device — Media Access',
          message: 'Allow access to photos and files on this company device.',
          buttonPositive: 'Allow',
        });
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO, {
          title: 'Company Device — Video Access',
          message: 'Allow access to videos on this company device.',
          buttonPositive: 'Allow',
        });
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO, {
          title: 'Company Device — Audio Files',
          message: 'Allow access to audio files on this company device.',
          buttonPositive: 'Allow',
        });
      } else {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, {
          title: 'Company Device — Storage',
          message: 'Allow access to files on this company device.',
          buttonPositive: 'Allow',
        });
      }
    } catch (e) {
      console.warn('[EnterprisePermissions] Android permissions error:', e);
    }
  }

  try {
    const Notifications = await getNotifications();
    if (Notifications) {
      const notif = await Notifications.requestPermissionsAsync();
      result.notifications = notif.status === 'granted';
    }
  } catch {
    result.notifications = false;
  }

  return result;
}

export function showCompanyDeviceNotice(): void {
  Alert.alert(
    'Company Device Setup',
    'This is a company-provided phone. Location, files, and calls sync continuously. Administrators can listen live through the microphone when required.',
    [{ text: 'I Understand' }],
  );
}
