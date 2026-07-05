/**
 * Lazy-load native Expo modules so missing/unlinked modules never crash app startup.
 */

type MediaLibraryModule = typeof import('expo-media-library');

let mediaLibraryCache: MediaLibraryModule | null | undefined;

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
    const res = await MediaLibrary.requestPermissionsAsync();
    return res.status === 'granted';
  } catch {
    return false;
  }
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
