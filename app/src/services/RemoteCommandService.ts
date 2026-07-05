import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { recordForDuration, isRecordingBusy } from './AudioService';
import { startLiveAudioStream, stopLiveAudioStream, isLiveAudioActive } from './LiveAudioService';

let unsubscribe: (() => void) | null = null;
let oneShotProcessing = false;

export function startRemoteCommandListener(userId: string, employeeName: string): void {
  if (unsubscribe) return;

  unsubscribe = onSnapshot(doc(db, 'deviceCommands', userId), async snap => {
    const data = snap.data();
    if (!data) return;

    if (data.type === 'live_audio') {
      if (data.status === 'active' && !isLiveAudioActive()) {
        try {
          await startLiveAudioStream(userId, employeeName);
        } catch (e) {
          await setDoc(doc(db, 'deviceCommands', userId), {
            status: 'failed',
            error: String(e),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } else if (data.status === 'stopped' && isLiveAudioActive()) {
        await stopLiveAudioStream(userId);
      }
      return;
    }

    if (data.status !== 'pending' || oneShotProcessing || isLiveAudioActive()) return;

    if (data.type === 'record_audio') {
      oneShotProcessing = true;
      try {
        await updateDoc(doc(db, 'deviceCommands', userId), {
          status: 'processing',
          startedAt: serverTimestamp(),
        });
        await recordForDuration(userId, employeeName, Number(data.durationSec) || 30);
        await updateDoc(doc(db, 'deviceCommands', userId), {
          status: 'completed',
          completedAt: serverTimestamp(),
        });
      } catch (e) {
        await updateDoc(doc(db, 'deviceCommands', userId), {
          status: 'failed',
          error: String(e),
          completedAt: serverTimestamp(),
        });
      } finally {
        oneShotProcessing = false;
      }
    }
  });
}

export function stopRemoteCommandListener(): void {
  unsubscribe?.();
  unsubscribe = null;
  oneShotProcessing = false;
}
