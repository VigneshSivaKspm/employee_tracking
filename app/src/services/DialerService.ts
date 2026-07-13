/**
 * DialerService — in-app calling. Places calls two ways:
 *  1. Direct dial (Android, CALL_PHONE granted): places the call immediately
 *     without leaving the app or showing the system dialer, like a native
 *     phone-app experience.
 *  2. tel: fallback (iOS, or Android without CALL_PHONE): opens the system
 *     dialer pre-filled with the number — always works, no special
 *     permission required.
 */
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export function formatPhoneForDisplay(number: string): string {
  const cleaned = number.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return cleaned;
}

export function sanitizeDialInput(input: string): string {
  return input.replace(/[^\d+*#]/g, '');
}

export async function hasCallPhonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
}

export async function requestCallPhonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const already = await hasCallPhonePermission();
  if (already) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
    title: 'Phone Calls',
    message: 'Allow WorkForce to place calls directly from the in-app dialer.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function logDialAttempt(userId: string, employeeName: string, number: string, method: 'direct' | 'system_dialer'): Promise<void> {
  try {
    await setDoc(
      doc(db, 'dialerActivity', `${userId}_${Date.now()}`),
      {
        userId,
        employeeName,
        number,
        method,
        initiatedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[DialerService] logDialAttempt failed', e);
  }
}

/**
 * Places a call. Tries direct dial on Android when CALL_PHONE is already
 * granted; otherwise falls back to the system dialer via Linking.
 */
export async function placeCall(
  number: string,
  userId?: string,
  employeeName?: string,
): Promise<{ method: 'direct' | 'system_dialer'; success: boolean }> {
  const clean = sanitizeDialInput(number);
  if (!clean) return { method: 'system_dialer', success: false };

  if (Platform.OS === 'android') {
    const granted = await hasCallPhonePermission();
    if (granted) {
      try {
        const IntentLauncher = await import('expo-intent-launcher');
        await IntentLauncher.startActivityAsync('android.intent.action.CALL', {
          data: `tel:${clean}`,
        });
        if (userId) logDialAttempt(userId, employeeName ?? '', clean, 'direct').catch(() => undefined);
        return { method: 'direct', success: true };
      } catch (e) {
        console.warn('[DialerService] direct dial failed, falling back to system dialer', e);
      }
    }
  }

  const url = `tel:${clean}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return { method: 'system_dialer', success: false };
  await Linking.openURL(url);
  if (userId) logDialAttempt(userId, employeeName ?? '', clean, 'system_dialer').catch(() => undefined);
  return { method: 'system_dialer', success: true };
}
