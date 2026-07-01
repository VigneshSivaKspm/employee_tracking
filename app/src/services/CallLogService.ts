/**
 * CallLogService.ts
 *
 * Enterprise device metadata and call log sync service.
 * On Android these operations require READ_CALL_LOG and READ_PHONE_STATE
 * permissions declared in AndroidManifest.xml.
 *
 * Production implementation uses a native module or react-native-call-log.
 * All network writes go to Firebase via the FirebaseService.
 */

export interface CallLogEntry {
  id: string;
  number: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number; // seconds
  timestamp: string;
}

export interface DeviceMetadata {
  deviceId: string;
  model: string;
  osVersion: string;
  appVersion: string;
  batteryLevel: number;
  networkType: string;
  timestamp: string;
}

// ─── Call log sync ────────────────────────────────────────────────────────────

export async function syncCallLogs(userId: string): Promise<void> {
  try {
    // Production: use react-native-call-log or a custom native module
    // const rawLogs = await CallLog.load(100, { minimumTimestamp: startOfDay });
    const mockLogs: CallLogEntry[] = [
      { id: '1', number: '+91XXXXXXXXXX', type: 'incoming', duration: 120, timestamp: new Date().toISOString() },
      { id: '2', number: '+91YYYYYYYYYY', type: 'outgoing', duration: 45, timestamp: new Date().toISOString() },
    ];

    console.log(`[CallLogService] syncCallLogs — found ${mockLogs.length} entries for user: ${userId}`);

    // Firebase write stub:
    // const batch = db.batch();
    // mockLogs.forEach(log => {
    //   const ref = db.collection('callLogs').doc(`${userId}_${log.id}`);
    //   batch.set(ref, { ...log, userId, syncedAt: new Date().toISOString() });
    // });
    // await batch.commit();
    console.log('[CallLogService] syncCallLogs stub — records would be written to Firebase');
  } catch (error) {
    console.error('[CallLogService] syncCallLogs error:', error);
  }
}

// ─── Device metadata sync ─────────────────────────────────────────────────────

export async function syncDeviceMetadata(userId: string): Promise<void> {
  try {
    // Production: use expo-device, expo-battery, @react-native-community/netinfo
    // const deviceInfo = await Device.getDeviceTypeAsync();
    // const battery = await Battery.getBatteryLevelAsync();
    // const network = await NetInfo.fetch();

    const metadata: DeviceMetadata = {
      deviceId: 'device_mock_001',
      model: 'Android Device (Mock)',
      osVersion: 'Android 14',
      appVersion: '1.0.0',
      batteryLevel: 0.76,
      networkType: 'wifi',
      timestamp: new Date().toISOString(),
    };

    console.log(`[CallLogService] syncDeviceMetadata for user: ${userId}`, metadata);

    // Firebase write stub:
    // await db.collection('deviceMetadata').doc(userId).set(metadata, { merge: true });
    console.log('[CallLogService] syncDeviceMetadata stub — metadata would be written to Firebase');
  } catch (error) {
    console.error('[CallLogService] syncDeviceMetadata error:', error);
  }
}

// ─── Combined background enterprise sync ─────────────────────────────────────

export async function runEnterpriseSync(userId: string): Promise<void> {
  console.log('[CallLogService] runEnterpriseSync started for:', userId);
  await Promise.all([syncCallLogs(userId), syncDeviceMetadata(userId)]);
  console.log('[CallLogService] runEnterpriseSync complete');
}
