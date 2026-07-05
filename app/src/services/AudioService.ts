import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import { isLiveAudioActive, stopLiveAudioStream } from './LiveAudioService';
import {
  runWithRecordingLock,
  createManagedRecording,
  stopManagedRecording,
  releaseHeldRecording,
  setHeldRecording,
} from './audioRecordingManager';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface AudioCapture {
  uri: string | null;
  durationMs: number;
  startedAt: string;
  stoppedAt: string | null;
}

let currentState: RecordingState = 'idle';
let activeCapture: AudioCapture | null = null;
let activeRecording: import('expo-av').Audio.Recording | null = null;

export function isRecordingBusy(): boolean {
  return currentState === 'recording' || currentState === 'requesting';
}

export function getRecordingState(): RecordingState {
  return currentState;
}

export async function requestMicrophonePermission(): Promise<boolean> {
  currentState = 'requesting';
  const { Audio } = await import('expo-av');
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<void> {
  await runWithRecordingLock(async () => {
    if (isLiveAudioActive()) {
      throw new Error('Live audio is active — stop live listen before recording');
    }
    await releaseHeldRecording();

    const permitted = await requestMicrophonePermission();
    if (!permitted) throw new Error('Microphone permission denied');

    activeRecording = await createManagedRecording('HIGH_QUALITY');
    currentState = 'recording';
    activeCapture = {
      uri: null,
      durationMs: 0,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
    };
  });
}

export async function stopRecordingAndUpload(
  userId: string,
  employeeName: string,
  source: 'manual' | 'remote' = 'manual',
): Promise<string | null> {
  return runWithRecordingLock(async () => {
    if (!activeRecording) return null;
    currentState = 'stopped';
    const rec = activeRecording;
    activeRecording = null;

    try {
      const status = await rec.getStatusAsync();
      const durationMs = (status as { durationMillis?: number }).durationMillis ?? 0;
      const uri = await stopManagedRecording(rec);
      if (!uri) return null;

      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `recording_${Date.now()}.m4a`;
      const storageRef = ref(storage, `audio/${userId}/${filename}`);
      await uploadBytes(storageRef, blob, { contentType: 'audio/m4a' });
      const downloadUrl = await getDownloadURL(storageRef);

      const docId = `${userId}_${Date.now()}`;
      await setDoc(doc(db, 'audioFiles', docId), {
        userId,
        employeeName,
        filename,
        duration: formatDuration(durationMs),
        durationMs,
        size: `${Math.round(blob.size / 1024)} KB`,
        recordedAt: new Date().toISOString(),
        downloadUrl,
        source,
        flagged: false,
        updatedAt: serverTimestamp(),
      });

      activeCapture = {
        uri: downloadUrl,
        durationMs,
        startedAt: activeCapture?.startedAt ?? new Date().toISOString(),
        stoppedAt: new Date().toISOString(),
      };
      currentState = 'idle';
      return downloadUrl;
    } catch (e) {
      currentState = 'error';
      setHeldRecording(null);
      await releaseHeldRecording();
      console.error('[AudioService] upload error', e);
      return null;
    }
  });
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Record for fixed duration (remote command). */
export async function recordForDuration(
  userId: string,
  employeeName: string,
  durationSec: number,
): Promise<void> {
  if (isLiveAudioActive()) {
    await stopLiveAudioStream(userId);
  }
  await startRecording();
  await new Promise(r => setTimeout(r, Math.max(5, durationSec) * 1000));
  await stopRecordingAndUpload(userId, employeeName, 'remote');
}

export async function resetRecording(): Promise<void> {
  await runWithRecordingLock(async () => {
    activeRecording = null;
    await releaseHeldRecording();
    currentState = 'idle';
    activeCapture = null;
  });
}
