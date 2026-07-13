/**
 * ChatService — 1:1 employee messaging (Firestore real-time).
 * Chat doc id is a deterministic sort of both participant uids so a
 * conversation between two employees always resolves to the same doc.
 */
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import type { User, UserRole } from '../types';

export interface EmployeeDirectoryEntry {
  id: string;
  name: string;
  designation: string;
  department: string;
  phone: string;
  role: UserRole;
  branchId: string;
  avatarUrl?: string;
}

export interface ChatSummary {
  id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  hasUnread: boolean;
}

export type ChatAttachmentKind = 'image' | 'video' | 'file';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  type: 'text' | ChatAttachmentKind;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  mimeType?: string;
}

export interface ChatMeta {
  lastReadAt: Record<string, string>;
}

function chatIdFor(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

async function loadDirectory(): Promise<EmployeeDirectoryEntry[]> {
  const snap = await getDocs(collection(db, 'employees'));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || 'Employee',
      designation: data.designation || '',
      department: data.department || '',
      phone: data.phone || '',
      role: (data.role as UserRole) || 'employee',
      branchId: data.branchId || '',
      avatarUrl: data.avatarUrl || '',
    } as EmployeeDirectoryEntry;
  });
}

/** Full company directory (excluding self) — used for one-tap calling. */
export async function loadEmployeeDirectory(excludeUserId: string): Promise<EmployeeDirectoryEntry[]> {
  const all = await loadDirectory();
  return all.filter(e => e.id !== excludeUserId).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Role-aware chat contacts. Chat is scoped to Employee ↔ Branch Admin:
 *  - An employee sees branch admins (their branch first, then company-wide).
 *  - A branch/super admin sees the employees in their branch (super admin sees all).
 */
export async function loadChatContacts(viewer: User): Promise<EmployeeDirectoryEntry[]> {
  const all = await loadDirectory();
  const others = all.filter(e => e.id !== viewer.id);
  const role = viewer.role || 'employee';

  if (role === 'employee') {
    const admins = others.filter(e => e.role === 'branch_admin' || e.role === 'super_admin');
    const sameBranch = admins.filter(e => viewer.branchId && e.branchId === viewer.branchId);
    const rest = admins.filter(e => !(viewer.branchId && e.branchId === viewer.branchId));
    return [...sameBranch, ...rest].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (role === 'branch_admin') {
    return others
      .filter(e => e.role === 'employee' && (!viewer.branchId || e.branchId === viewer.branchId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // super_admin — can message anyone
  return others.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOrCreateChat(
  userId: string,
  userName: string,
  otherUserId: string,
  otherUserName: string,
): Promise<string> {
  const chatId = chatIdFor(userId, otherUserId);
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      participants: [userId, otherUserId],
      participantNames: { [userId]: userName, [otherUserId]: otherUserName },
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      lastSenderId: '',
      lastReadAt: { [userId]: new Date().toISOString() },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return chatId;
}

export function subscribeToChats(userId: string, cb: (chats: ChatSummary[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    const chats = snap.docs
      .map(d => {
        const data = d.data();
        const participants: string[] = data.participants || [];
        const otherUserId = participants.find(p => p !== userId) || '';
        const names = data.participantNames || {};
        const lastReadAt = data.lastReadAt?.[userId] as string | undefined;
        const lastMessageAt = data.lastMessageAt || '';
        const lastSenderId = data.lastSenderId || '';
        const hasUnread = !!lastMessageAt && lastSenderId !== userId && (!lastReadAt || lastReadAt < lastMessageAt);
        return {
          id: d.id,
          otherUserId,
          otherUserName: names[otherUserId] || 'Employee',
          lastMessage: data.lastMessage || '',
          lastMessageAt,
          lastSenderId,
          hasUnread,
        } as ChatSummary;
      })
      .filter(c => c.otherUserId);
    cb(chats);
  });
}

export function subscribeToMessages(chatId: string, cb: (messages: ChatMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  return onSnapshot(q, snap => {
    cb(
      snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          senderId: data.senderId || '',
          senderName: data.senderName || '',
          text: data.text || '',
          createdAt: data.createdAt || new Date().toISOString(),
          type: data.type || 'text',
          attachmentUrl: data.attachmentUrl,
          attachmentName: data.attachmentName,
          attachmentSize: data.attachmentSize,
          mimeType: data.mimeType,
        } as ChatMessage;
      }),
    );
  });
}

/** Chat-level metadata (per-participant last-read timestamps) for read receipts. */
export function subscribeToChatMeta(chatId: string, cb: (meta: ChatMeta) => void): Unsubscribe {
  return onSnapshot(doc(db, 'chats', chatId), snap => {
    const data = snap.data();
    cb({ lastReadAt: data?.lastReadAt || {} });
  });
}

export async function sendMessage(chatId: string, senderId: string, senderName: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const now = new Date().toISOString();
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId,
    senderName,
    text: trimmed,
    type: 'text',
    createdAt: now,
  });
  await setDoc(
    doc(db, 'chats', chatId),
    {
      lastMessage: trimmed,
      lastMessageAt: now,
      lastSenderId: senderId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export interface PendingAttachment {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  kind: ChatAttachmentKind;
}

const ATTACHMENT_PREVIEW: Record<ChatAttachmentKind, string> = {
  image: '📷 Photo',
  video: '🎥 Video',
  file: '📎 File',
};

export async function sendAttachmentMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  attachment: PendingAttachment,
): Promise<void> {
  const response = await fetch(attachment.uri);
  const blob = await response.blob();
  const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `chatAttachments/${chatId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: attachment.mimeType || undefined });
  const downloadUrl = await getDownloadURL(storageRef);

  const now = new Date().toISOString();
  const preview = attachment.kind === 'file' ? `📎 ${attachment.name}` : ATTACHMENT_PREVIEW[attachment.kind];

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId,
    senderName,
    text: '',
    type: attachment.kind,
    attachmentUrl: downloadUrl,
    attachmentName: attachment.name,
    attachmentSize: attachment.size ?? blob.size,
    mimeType: attachment.mimeType,
    createdAt: now,
  });

  await setDoc(
    doc(db, 'chats', chatId),
    {
      lastMessage: preview,
      lastMessageAt: now,
      lastSenderId: senderId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function markChatRead(chatId: string, userId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      [`lastReadAt.${userId}`]: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[ChatService] markChatRead failed', e);
  }
}
