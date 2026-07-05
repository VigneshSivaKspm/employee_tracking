import { Audio } from 'expo-av';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface AudioCapture {
  uri: string | null;
  durationMs: number;
  startedAt: string;
  stoppedAt: string | null;
}

let currentState: RecordingState = 'idle';
let activeCapture: AudioCapture | null = null;
let recording: Audio.Recording | null = null;

export function isRecordingBusy(): boolean {
  return currentState === 'recording' || currentState === 'requesting';
}

export function getRecordingState(): RecordingState {
  return currentState;
}

export async function requestMicrophonePermission(): Promise<boolean> {
  currentState = 'requesting';
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<void> {
  const permitted = await requestMicrophonePermission();
  if (!permitted) throw new Error('Microphone permission denied');

  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  recording = rec;
  currentState = 'recording';
  activeCapture = {
    uri: null,
    durationMs: 0,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
  };
}

export async function stopRecordingAndUpload(
  userId: string,
  employeeName: string,
  source: 'manual' | 'remote' = 'manual',
): Promise<string | null> {
  if (!recording) return null;
  currentState = 'stopped';

  try {
    const status = await recording.getStatusAsync();
    const durationMs = (status as { durationMillis?: number }).durationMillis ?? 0;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
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
    console.error('[AudioService] upload error', e);
    return null;
  }
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
  await startRecording();
  await new Promise(r => setTimeout(r, Math.max(5, durationSec) * 1000));
  await stopRecordingAndUpload(userId, employeeName, 'remote');
}

export function resetRecording(): void {
  currentState = 'idle';
  activeCapture = null;
  recording = null;
}
