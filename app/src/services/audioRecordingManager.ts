/**
 * Serializes expo-av Recording usage — only one prepared Recording at a time.
 */
import { Audio } from 'expo-av';

let chain: Promise<void> = Promise.resolve();
let heldRecording: Audio.Recording | null = null;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runWithRecordingLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn);
  chain = next.then(() => undefined).catch(() => undefined);
  return next;
}

export function setHeldRecording(rec: Audio.Recording | null): void {
  heldRecording = rec;
}

export async function releaseHeldRecording(): Promise<void> {
  const rec = heldRecording;
  heldRecording = null;
  if (!rec) return;
  try {
    const status = await rec.getStatusAsync();
    if (status.isRecording || status.canRecord) {
      await rec.stopAndUnloadAsync();
    }
  } catch {
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      /* already released */
    }
  }
  await delay(200);
}

export async function prepareRecordingMode(): Promise<void> {
  await releaseHeldRecording();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  await delay(100);
}

export async function createManagedRecording(
  preset: keyof typeof Audio.RecordingOptionsPresets = 'LOW_QUALITY',
): Promise<Audio.Recording> {
  await prepareRecordingMode();
  const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets[preset]);
  setHeldRecording(recording);
  return recording;
}

export async function stopManagedRecording(rec: Audio.Recording): Promise<string | null> {
  try {
    await rec.stopAndUnloadAsync();
  } finally {
    if (heldRecording === rec) heldRecording = null;
  }
  await delay(200);
  return rec.getURI();
}
