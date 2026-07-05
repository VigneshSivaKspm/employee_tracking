/**
 * Lazy-load native Expo modules + safe media-library permission helpers.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type MediaLibraryModule = typeof import('expo-media-library');
type GranularPermission = 'photo' | 'video' | 'audio';

let mediaLibraryCache: MediaLibraryModule | null | undefined;

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Expo Go manifest lacks READ_MEDIA_AUDIO — use photo+video only there. */
export function getMediaGranularPermissions(): GranularPermission[] {
  if (isExpoGo()) return ['photo', 'video'];
  return ['photo', 'video', 'audio'];
}

export async function getMediaLibrary(): Promise<MediaLibraryModule | null> {
  if (mediaLibraryCache !== undefined) return mediaLibraryCache;
  try {
    mediaLibraryCache = await import('expo-media-library');
    return mediaLibraryCache;
  } catch (e) {
    console.warn('[NativeModules] expo-media-library unavailable:', e);
    mediaLibraryCache = null;
    return null;
  }
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const MediaLibrary = await getMediaLibrary();
  if (!MediaLibrary) return false;
  try {
    const granular = getMediaGranularPermissions();
    const res = await MediaLibrary.requestPermissionsAsync(false, granular);
    return res.status === 'granted';
  } catch (e) {
    console.warn('[NativeModules] media library permission request failed:', e);
    return false;
  }
}

export async function hasMediaLibraryPermission(): Promise<boolean> {
  const MediaLibrary = await getMediaLibrary();
  if (!MediaLibrary) return false;
  try {
    const granular = getMediaGranularPermissions();
    const res = await MediaLibrary.getPermissionsAsync(false, granular);
    return res.status === 'granted';
  } catch (e) {
    console.warn('[NativeModules] media library permission check failed:', e);
    return false;
  }
}

export function getSyncMediaTypes(MediaLibrary: MediaLibraryModule): MediaLibraryModule['MediaType'][] {
  const types = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
  if (!isExpoGo() && Platform.OS === 'android') {
    types.push(MediaLibrary.MediaType.audio);
  }
  return types;
}

type NotificationsModule = typeof import('expo-notifications');

let notificationsCache: NotificationsModule | null | undefined;

export async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsCache !== undefined) return notificationsCache;
  try {
    notificationsCache = await import('expo-notifications');
    return notificationsCache;
  } catch (e) {
    console.warn('[NativeModules] expo-notifications unavailable:', e);
    notificationsCache = null;
    return null;
  }
}
