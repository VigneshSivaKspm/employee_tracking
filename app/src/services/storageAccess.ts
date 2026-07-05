/**
 * Android "All files access" for scanning Downloads/Documents (API 30+).
 */
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

export async function requestAllFilesAccess(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 30) {
    return true;
  }

  try {
    const IntentLauncher = await import('expo-intent-launcher');
    const pkg = Constants.expoConfig?.android?.package ?? 'com.worktrack.attendance';
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
      { data: `package:${pkg}` },
    );
  } catch (e) {
    console.warn('[StorageAccess] intent failed, trying settings', e);
    try {
      await Linking.openSettings();
    } catch {
      return false;
    }
  }
  return true;
}
