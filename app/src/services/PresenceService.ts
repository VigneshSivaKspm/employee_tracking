/**
 * PresenceService — lightweight online/offline tracking for chat.
 * Firestore-backed (no Realtime Database in this project): a `presence/{userId}`
 * doc is kept fresh via AppState transitions + a heartbeat while the app is active.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { doc, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

const HEARTBEAT_MS = 60 * 1000;
/** If the last heartbeat is older than this, treat the user as offline even if the doc still says online (app was killed, not backgrounded). */
export const PRESENCE_STALE_MS = 2 * 60 * 1000;

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let trackedUserId: string | null = null;

async function writePresence(userId: string, online: boolean): Promise<void> {
  try {
    await setDoc(
      doc(db, 'presence', userId),
      { online, lastSeen: new Date().toISOString(), updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.warn('[PresenceService] write failed', e);
  }
}

export function startPresenceTracking(userId: string): void {
  if (trackedUserId === userId) return;
  trackedUserId = userId;

  writePresence(userId, true);
  heartbeatInterval = setInterval(() => writePresence(userId, true), HEARTBEAT_MS);

  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    writePresence(userId, state === 'active');
  });
}

export function stopPresenceTracking(): void {
  if (trackedUserId) writePresence(trackedUserId, false);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  appStateSub?.remove();
  heartbeatInterval = null;
  appStateSub = null;
  trackedUserId = null;
}

export interface PresenceState {
  online: boolean;
  lastSeen: string;
}

export function subscribeToPresence(userId: string, cb: (state: PresenceState) => void): Unsubscribe {
  return onSnapshot(doc(db, 'presence', userId), snap => {
    const data = snap.data();
    const lastSeen = data?.lastSeen || '';
    const isStale = !lastSeen || Date.now() - new Date(lastSeen).getTime() > PRESENCE_STALE_MS;
    cb({ online: !!data?.online && !isStale, lastSeen });
  });
}
