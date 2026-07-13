/**
 * BiometricService — fingerprint/Face ID gate for security-sensitive actions
 * (Punch In / Punch Out, biometric login).
 */
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCheckResult {
  available: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

export async function getBiometricCapability(): Promise<BiometricCheckResult> {
  const [hasHW, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { available: hasHW, enrolled: isEnrolled, types };
}

export function isFingerprintType(types: LocalAuthentication.AuthenticationType[]): boolean {
  return types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
}

/**
 * Prompts the OS biometric sheet. Returns true only on a genuine successful
 * scan. If no biometric hardware/enrollment exists on the device, resolves
 * true so punch flows still work on devices without fingerprint sensors —
 * but callers should surface `hardwareMissing` so the UI can be honest.
 */
export async function verifyBiometric(promptMessage: string): Promise<{
  success: boolean;
  hardwareMissing: boolean;
  error?: string;
}> {
  const { available, enrolled } = await getBiometricCapability();

  if (!available || !enrolled) {
    return { success: true, hardwareMissing: true };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (!result.success) {
      const reason = 'error' in result ? result.error : 'cancelled';
      return { success: false, hardwareMissing: false, error: reason };
    }
    return { success: true, hardwareMissing: false };
  } catch (e: any) {
    return { success: false, hardwareMissing: false, error: e?.message ?? 'Biometric check failed' };
  }
}
