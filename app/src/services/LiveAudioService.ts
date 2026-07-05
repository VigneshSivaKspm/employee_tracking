/**
 * Live microphone streaming — uploads short audio chunks while admin listens.
 */
import { Audio } from 'expo-av';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';

const CHUNK_MS = 2500;

let liveActive = false;
let liveLoopPromise: Promise<void> | null = null;

export function isLiveAudioActive(): boolean {
  return liveActive;
}

export async function startLiveAudioStream(userId: string, employeeName: string): Promise<void> {
  if (liveActive) return;

  const permitted = await Audio.requestPermissionsAsync();
  if (permitted.status !== 'granted') throw new Error('Microphone permission denied');

  liveActive = true;
  let chunkSeq = 0;

  await setDoc(
    doc(db, 'liveAudio', userId),
    {
      userId,
      employeeName,
      streaming: true,
      chunkSeq: 0,
      startedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  liveLoopPromise = (async () => {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    while (liveActive) {
      let rec: Audio.Recording | null = null;
      try {
        const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
        rec = created.recording;
        await new Promise(r => setTimeout(r, CHUNK_MS));
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        rec = null;
        if (!uri || !liveActive) break;

        const response = await fetch(uri);
        const blob = await response.blob();
        chunkSeq += 1;
        const filename = `live_${Date.now()}_${chunkSeq}.m4a`;
        const storageRef = ref(storage, `live-audio/${userId}/${filename}`);
        await uploadBytes(storageRef, blob, { contentType: 'audio/m4a' });
        const downloadUrl = await getDownloadURL(storageRef);

        await setDoc(
          doc(db, 'liveAudio', userId),
          {
            userId,
            employeeName,
            streaming: true,
            chunkSeq,
            downloadUrl,
            lastChunkAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        console.warn('[LiveAudio] chunk error', e);
        await setDoc(
          doc(db, 'liveAudio', userId),
          { error: String(e), updatedAt: serverTimestamp() },
          { merge: true },
        ).catch(() => undefined);
        await new Promise(r => setTimeout(r, 800));
      } finally {
        if (rec) {
          try {
            await rec.stopAndUnloadAsync();
          } catch {
            /* ignore */
          }
        }
      }
    }
  })();
}

export async function stopLiveAudioStream(userId: string): Promise<void> {
  liveActive = false;
  if (liveLoopPromise) {
    await liveLoopPromise.catch(() => undefined);
    liveLoopPromise = null;
  }
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
