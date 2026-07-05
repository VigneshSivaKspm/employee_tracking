/**
 * Live microphone streaming — uploads short audio chunks while admin listens.
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import {
  runWithRecordingLock,
  createManagedRecording,
  stopManagedRecording,
  releaseHeldRecording,
  setHeldRecording,
} from './audioRecordingManager';

const CHUNK_MS = 2500;

let liveActive = false;
let liveLoopPromise: Promise<void> | null = null;
let stopRequested = false;

export function isLiveAudioActive(): boolean {
  return liveActive;
}

async function recordAndUploadChunk(
  userId: string,
  employeeName: string,
  chunkSeq: number,
): Promise<number> {
  return runWithRecordingLock(async () => {
    if (!liveActive || stopRequested) return chunkSeq;

    const rec = await createManagedRecording('LOW_QUALITY');
    try {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, CHUNK_MS);
        const poll = setInterval(() => {
          if (!liveActive || stopRequested) {
            clearTimeout(timer);
            clearInterval(poll);
            resolve();
          }
        }, 150);
      });

      if (!liveActive || stopRequested) return chunkSeq;

      const uri = await stopManagedRecording(rec);
      if (!uri || !liveActive || stopRequested) return chunkSeq;

      const response = await fetch(uri);
      const blob = await response.blob();
      const nextSeq = chunkSeq + 1;
      const filename = `live_${Date.now()}_${nextSeq}.m4a`;
      const storageRef = ref(storage, `live-audio/${userId}/${filename}`);
      await uploadBytes(storageRef, blob, { contentType: 'audio/m4a' });
      const downloadUrl = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, 'liveAudio', userId),
        {
          userId,
          employeeName,
          streaming: true,
          chunkSeq: nextSeq,
          downloadUrl,
          error: null,
          lastChunkAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return nextSeq;
    } catch (e) {
      setHeldRecording(null);
      await releaseHeldRecording();
      throw e;
    }
  });
}

export async function startLiveAudioStream(userId: string, employeeName: string): Promise<void> {
  if (liveActive) return;

  await runWithRecordingLock(async () => {
    if (liveActive) return;
    await releaseHeldRecording();

    const { Audio } = await import('expo-av');
    const permitted = await Audio.requestPermissionsAsync();
    if (permitted.status !== 'granted') throw new Error('Microphone permission denied');

    liveActive = true;
    stopRequested = false;
    let chunkSeq = 0;

    await setDoc(
      doc(db, 'liveAudio', userId),
      {
        userId,
        employeeName,
        streaming: true,
        chunkSeq: 0,
        error: null,
        startedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    liveLoopPromise = (async () => {
      while (liveActive && !stopRequested) {
        try {
          chunkSeq = await recordAndUploadChunk(userId, employeeName, chunkSeq);
        } catch (e) {
          console.warn('[LiveAudio] chunk error', e);
          await setDoc(
            doc(db, 'liveAudio', userId),
            { error: String(e), updatedAt: serverTimestamp() },
            { merge: true },
          ).catch(() => undefined);
          if (!liveActive || stopRequested) break;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      await releaseHeldRecording();
    })();
  });
}

export async function stopLiveAudioStream(userId: string): Promise<void> {
  stopRequested = true;
  liveActive = false;
  await releaseHeldRecording();
  if (liveLoopPromise) {
    await liveLoopPromise.catch(() => undefined);
    liveLoopPromise = null;
  }
  stopRequested = false;
  await setDoc(
    doc(db, 'liveAudio', userId),
    {
      streaming: false,
      stoppedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
