import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import { getMediaLibrary, hasMediaLibraryPermission, getSyncMediaTypes, isExpoGo } from './nativeModules';

const SYNC_LIMIT = 80;

function extCategory(filename: string, mediaType?: string): 'Document' | 'Media' | 'Backup' | 'Image' {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic)$/.test(lower)) return 'Image';
  if (/\.(mp4|mov|avi|mkv|mp3|wav|m4a|aac)$/.test(lower) || mediaType?.includes('video') || mediaType?.includes('audio')) {
    return 'Media';
  }
  if (/\.(zip|rar|7z|bak)$/.test(lower)) return 'Backup';
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

export async function syncDeviceFiles(userId: string, employeeName: string): Promise<number> {
  const MediaLibrary = await getMediaLibrary();
  if (!MediaLibrary) return 0;

  try {
    const permitted = await hasMediaLibraryPermission();
    if (!permitted) return 0;

    const assets = await MediaLibrary.getAssetsAsync({
      first: SYNC_LIMIT,
      sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
      mediaType: getSyncMediaTypes(MediaLibrary),
    });

    let synced = 0;
    for (const asset of assets.assets) {
      try {
        const docId = `${userId}_${asset.id}`;
        if (await isAlreadySynced(docId)) continue;

        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const filename = info.filename || `asset_${asset.id}`;
        const uri = info.localUri || asset.uri;
        if (!uri) continue;

        const response = await fetch(uri);
        const blob = await response.blob();
        const storagePath = `synced-files/${userId}/${docId}_${filename}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);

        await setDoc(doc(db, 'syncedFiles', docId), {
          userId,
          employeeName,
          filename,
          fileType: filename.split('.').pop()?.toUpperCase() || 'FILE',
          size: formatSize(info.fileSize || blob.size || 0),
          category: extCategory(filename, asset.mediaType),
          syncedAt: new Date().toISOString(),
          downloadUrl,
          updatedAt: serverTimestamp(),
        });
        synced++;
      } catch (e) {
        console.warn('[FileSync] skip asset', asset.id, e);
      }
    }

    if (isExpoGo() && synced === 0) {
      console.log('[FileSync] Expo Go — photo/video sync only. Use a dev build for full file access.');
    }
    return synced;
  } catch (e) {
    console.warn('[FileSync] sync failed:', e);
    return 0;
  }
}
