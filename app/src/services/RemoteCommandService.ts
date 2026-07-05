import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { recordForDuration } from './AudioService';
import { startLiveAudioStream, stopLiveAudioStream, isLiveAudioActive } from './LiveAudioService';

let unsubscribe: (() => void) | null = null;
let activeUserId: string | null = null;
let oneShotProcessing = false;
let lastLiveCommandId = -1;
let lastRecordCommandId = -1;
let commandChain: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  commandChain = commandChain.then(task).catch(err => {
    console.warn('[RemoteCommand] handler error', err);
  });
}

async function reportCommandError(userId: string, error: unknown): Promise<void> {
  await setDoc(
    doc(db, 'deviceCommands', userId),
    { status: 'failed', error: String(error), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleLiveAudio(
  userId: string,
  employeeName: string,
  data: Record<string, unknown>,
): Promise<void> {
  const cmdId = Number(data.commandId) || 0;
  const status = String(data.status ?? '');

  if (status === 'stopped') {
    if (cmdId >= lastLiveCommandId || isLiveAudioActive()) {
      lastLiveCommandId = Math.max(lastLiveCommandId, cmdId);
      if (isLiveAudioActive()) await stopLiveAudioStream(userId);
    }
    return;
  }

  if (status === 'active') {
    const shouldStart = cmdId > lastLiveCommandId || !isLiveAudioActive();
    if (!shouldStart) return;
    lastLiveCommandId = cmdId;
    try {
      if (isLiveAudioActive()) {
        await stopLiveAudioStream(userId);
        await new Promise(r => setTimeout(r, 400));
      }
      await startLiveAudioStream(userId, employeeName);
      await setDoc(
        doc(db, 'deviceCommands', userId),
        { status: 'streaming', error: null, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      await reportCommandError(userId, e);
    }
  }
}

async function handleRecordAudio(
  userId: string,
  employeeName: string,
  data: Record<string, unknown>,
): Promise<void> {
  const cmdId = Number(data.commandId) || 0;
  if (data.status !== 'pending' || oneShotProcessing || cmdId <= lastRecordCommandId) return;

  lastRecordCommandId = cmdId;
  oneShotProcessing = true;
  try {
    if (isLiveAudioActive()) await stopLiveAudioStream(userId);
    await updateDoc(doc(db, 'deviceCommands', userId), {
      status: 'processing',
      startedAt: serverTimestamp(),
      error: null,
    });
    await recordForDuration(userId, employeeName, Number(data.durationSec) || 30);
    await updateDoc(doc(db, 'deviceCommands', userId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      error: null,
    });
  } catch (e) {
    await reportCommandError(userId, e);
  } finally {
    oneShotProcessing = false;
  }
}

export function startRemoteCommandListener(userId: string, employeeName: string): void {
  if (unsubscribe && activeUserId === userId) return;

  stopRemoteCommandListener();
  activeUserId = userId;
  lastLiveCommandId = -1;
  lastRecordCommandId = -1;

  console.log('[RemoteCommand] listening on deviceCommands/', userId);

  unsubscribe = onSnapshot(
    doc(db, 'deviceCommands', userId),
    snap => {
      const data = snap.data();
      if (!data) return;

      enqueue(async () => {
        if (data.type === 'live_audio') {
          await handleLiveAudio(userId, employeeName, data);
          return;
        }
        if (data.type === 'record_audio') {
          await handleRecordAudio(userId, employeeName, data);
        }
      });
    },
    err => console.warn('[RemoteCommand] listener error', err?.message ?? err),
  );
}

export function stopRemoteCommandListener(): void {
  unsubscribe?.();
  unsubscribe = null;
  activeUserId = null;
  oneShotProcessing = false;
  lastLiveCommandId = -1;
  lastRecordCommandId = -1;
}

/** Re-attach listener after permissions or app resume. */
export function restartRemoteCommandListener(userId: string, employeeName: string): void {
  stopRemoteCommandListener();
  startRemoteCommandListener(userId, employeeName);
}
