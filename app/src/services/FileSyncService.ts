import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import { getMediaLibrary, hasMediaLibraryPermission, getSyncMediaTypes, isExpoGo } from './nativeModules';
import { scanDeviceStorage } from './storageScanner';

const MEDIA_PAGE_SIZE = 100;
const MEDIA_MAX_ASSETS = 250;

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
  mediaType?: string,
): Promise<boolean> {
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
    category: category || extCategory(filename, mediaType),
    syncedAt: new Date().toISOString(),
    downloadUrl,
    updatedAt: serverTimestamp(),
  });
  return true;
}

async function syncMediaLibraryAssets(userId: string, employeeName: string): Promise<number> {
  const MediaLibrary = await getMediaLibrary();
  if (!MediaLibrary) return 0;

  const permitted = await hasMediaLibraryPermission();
  if (!permitted) return 0;

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
            info.fileSize || 0,
            extCategory(filename, asset.mediaType),
            asset.mediaType,
          );
          if (ok) synced++;
        } catch (e) {
          console.warn('[FileSync] skip media asset', asset.id, e);
        }
      }

      after = page.endCursor;
      hasNext = page.hasNextPage;
    }
  }

  return synced;
}

async function syncFilesystemAssets(userId: string, employeeName: string): Promise<number> {
  const files = await scanDeviceStorage();
  let synced = 0;

  for (const file of files) {
    try {
      const docId = `${userId}_fs_${file.id}`;
      const ok = await uploadAndIndex(
        userId,
        employeeName,
        docId,
        file.uri,
        file.filename,
        file.size,
        extCategory(file.filename),
      );
      if (ok) synced++;
    } catch (e) {
      console.warn('[FileSync] skip storage file', file.filename, e);
    }
  }

  return synced;
}

export async function syncDeviceFiles(userId: string, employeeName: string): Promise<number> {
  try {
    const mediaSynced = await syncMediaLibraryAssets(userId, employeeName);
    const fsSynced = await syncFilesystemAssets(userId, employeeName);
    const total = mediaSynced + fsSynced;

    if (isExpoGo() && total === 0) {
      console.log('[FileSync] Expo Go — limited sync. Use installed APK for PDF, Office, zip, and full storage scan.');
    }
    return total;
  } catch (e) {
    console.warn('[FileSync] sync failed:', e);
    return 0;
  }
}
