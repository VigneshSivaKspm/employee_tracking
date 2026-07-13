/**
 * Call log sync — Android company devices with READ_CALL_LOG permission.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface CallLogEntry {
  id: string;
  number: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: string;
}

function mapDirection(type: string): 'Incoming' | 'Outgoing' {
  const t = (type || '').toLowerCase();
  if (t.includes('out') || t === '2') return 'Outgoing';
  return 'Incoming';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function getDeviceCallLogs(): Promise<CallLogEntry[]> {
  return readNativeCallLogs(true);
}

export async function hasCallLogPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
}

export async function requestCallLogPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
    title: 'Call Logs',
    message: 'Allow WorkForce to read call history for the in-app dialer and call log sync.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * @param rethrow When true (interactive screens), a native-module failure is
 * thrown so the UI can tell "load failed" apart from "no calls yet". The
 * background sync path (`syncCallLogs`) passes false so a hiccup there
 * doesn't spam a user-facing error on every 45s tick.
 */
async function readNativeCallLogs(rethrow = false): Promise<CallLogEntry[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const CallLogs = require('react-native-call-log').default ?? require('react-native-call-log');
    const raw = await CallLogs.load(300);
    return (raw || []).map((row: Record<string, unknown>, idx: number) => {
      const typeStr = String(row.type ?? '').toUpperCase();
      return {
        id: String(row.phoneNumber ?? row.number ?? idx) + '_' + String(row.timestamp ?? row.dateTime ?? idx),
        number: String(row.phoneNumber ?? row.number ?? 'Unknown'),
        type: typeStr.includes('MISSED')
          ? 'missed'
          : typeStr.includes('OUT')
          ? 'outgoing'
          : 'incoming',
        duration: Number(row.duration ?? 0),
        timestamp: row.timestamp
          ? new Date(Number(row.timestamp)).toISOString()
          : row.dateTime
          ? new Date(String(row.dateTime)).toISOString()
          : new Date().toISOString(),
      };
    });
  } catch (e) {
    console.error('[CallLogService] native call log read failed', e);
    if (rethrow) throw e;
    return [];
  }
}

export async function syncCallLogs(userId: string, employeeName: string): Promise<number> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
    if (!granted) return 0;
  }

  const logs = await readNativeCallLogs();
  let count = 0;

  for (const log of logs) {
    const docId = `${userId}_${log.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      await setDoc(
        doc(db, 'callLogs', docId),
        {
          userId,
          employeeName,
          remoteNumber: log.number,
          direction: mapDirection(log.type),
          duration: formatDuration(log.duration),
          durationSec: log.duration,
          timestamp: log.timestamp,
          syncedAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      count++;
    } catch (e) {
      console.warn('[CallLogService] write failed', e);
    }
  }
  return count;
}

export async function syncDeviceMetadata(userId: string, employeeName: string): Promise<void> {
  try {
    const Device = await import('expo-device');
    const Battery = await import('expo-battery');
    const NetInfo = await import('@react-native-community/netinfo');
    const level = await Battery.getBatteryLevelAsync();
    const net = await NetInfo.default.fetch();

    await setDoc(
      doc(db, 'deviceMetadata', userId),
      {
        userId,
        employeeName,
        model: Device.modelName || 'Unknown',
        osVersion: `${Device.osName} ${Device.osVersion}`,
        batteryLevel: Math.round(level * 100),
        networkType: net.type,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[CallLogService] metadata sync error', e);
  }
}

/**
 * Periodic background sync — call logs + device metadata only. Personal files
 * and photos are never uploaded automatically; the employee browses their own
 * device in the File Manager and chooses exactly what to sync.
 */
export async function runEnterpriseSync(userId: string, employeeName: string): Promise<void> {
  await Promise.all([
    syncCallLogs(userId, employeeName),
    syncDeviceMetadata(userId, employeeName),
  ]);
}
