/**
 * FileManagerService — on-demand device file browsing. Nothing here uploads
 * automatically; every file is only sent to Firebase Storage when the
 * employee explicitly picks it in the File Manager screen.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';

export const STORAGE_ROOT = '/storage/emulated/0';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB safety cap per file
const MAX_LIST_ENTRIES = 5000;
const INFO_BATCH_SIZE = 40; // limit concurrent native getInfoAsync calls per folder

// Note: Android blocks ALL apps — even with MANAGE_EXTERNAL_STORAGE granted —
// from reading other apps' private data under Android/data and Android/obb.
// That folder still shows up in listings (nothing is hidden here), but
// opening it will surface the OS's own permission error via listDirectory's
// catch below rather than the app pre-filtering it away.

export interface FileEntry {
  name: string;
  path: string;
  uri: string;
  isDirectory: boolean;
  size: number;
  modifiedAt?: number;
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function parentPath(path: string): string | null {
  if (path === STORAGE_ROOT || path.length <= STORAGE_ROOT.length) return null;
  const parts = path.replace(/\/$/, '').split('/');
  parts.pop();
  const parent = parts.join('/');
  return parent.length < STORAGE_ROOT.length ? STORAGE_ROOT : parent;
}

export interface DirectoryListing {
  entries: FileEntry[];
  truncated: boolean;
  totalCount: number;
}

/**
 * Lists a single directory (not recursive) for interactive browsing.
 * Nothing is filtered by name or extension — every file and folder the OS
 * will let this app see is included. `getInfoAsync` calls are batched
 * (rather than fired all at once) so very large folders (e.g. a 20k-photo
 * DCIM) don't spike thousands of concurrent native bridge calls.
 */
export async function listDirectory(path: string): Promise<DirectoryListing> {
  if (Platform.OS !== 'android') return { entries: [], truncated: false, totalCount: 0 };

  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(toFileUri(path));
  } catch {
    throw new Error('Could not read this folder — Android restricts access to it, even with full storage access granted.');
  }

  const truncated = names.length > MAX_LIST_ENTRIES;
  const targets = names.slice(0, MAX_LIST_ENTRIES);

  const results: FileEntry[] = [];
  for (let i = 0; i < targets.length; i += INFO_BATCH_SIZE) {
    const batch = targets.slice(i, i + INFO_BATCH_SIZE);
    const infos = await Promise.all(
      batch.map(async (name): Promise<FileEntry | null> => {
        const fullPath = `${path.replace(/\/$/, '')}/${name}`;
        const uri = toFileUri(fullPath);
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) return null;
          return {
            name,
            path: fullPath,
            uri,
            isDirectory: !!info.isDirectory,
            size: info.isDirectory ? 0 : info.size ?? 0,
            modifiedAt: info.modificationTime,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const entry of infos) if (entry) results.push(entry);
  }

  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { entries: results, truncated, totalCount: names.length };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileCategory(filename: string): 'Image' | 'Media' | 'Backup' | 'Document' {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp|svg)$/.test(lower)) return 'Image';
  if (/\.(mp4|mov|avi|mkv|webm|3gp|mp3|wav|m4a|aac|ogg|flac)$/.test(lower)) return 'Media';
  if (/\.(zip|rar|7z|tar|gz|bak|apk)$/.test(lower)) return 'Backup';
  return 'Document';
}

export function docIdForPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 140);
}

/** Uploads exactly one, employee-selected file to Firebase Storage and indexes it. */
export async function uploadFileToCloud(
  userId: string,
  employeeName: string,
  file: FileEntry,
): Promise<string> {
  if (file.isDirectory) throw new Error('Cannot sync a folder — select a file.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large to sync (max ${formatFileSize(MAX_UPLOAD_BYTES)}).`);
  }

  const response = await fetch(file.uri);
  const blob = await response.blob();
  const safeName = file.name.replace(/[/\\?%*:|"<>]/g, '_');
  const docId = `${userId}_fm_${docIdForPath(file.path)}`;
  const storagePath = `synced-files/${userId}/${docId}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : undefined;
  await setDoc(doc(db, 'syncedFiles', docId), {
    userId,
    employeeName,
    filename: safeName,
    fileType: ext || 'FILE',
    size: formatFileSize(file.size),
    category: fileCategory(file.name),
    sourcePath: file.path,
    syncedAt: new Date().toISOString(),
    downloadUrl,
    manuallySynced: true,
    updatedAt: serverTimestamp(),
  });

  return downloadUrl;
}
