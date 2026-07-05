/**
 * Scans accessible Android storage paths for documents and other non-media files.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface ScannedStorageFile {
  id: string;
  uri: string;
  filename: string;
  size: number;
  modifiedAt?: number;
}

const MAX_DEPTH = 5;
const MAX_FILES = 150;
const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB per file

const SYNC_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx', 'txt', 'csv', 'tsv',
  'zip', 'rar', '7z', 'tar', 'gz', 'apk', 'json', 'xml', 'html', 'htm', 'rtf',
  'odt', 'ods', 'odp', 'epub', 'mobi', 'db', 'sqlite', 'log', 'bak', 'conf',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'svg',
  'mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac',
]);

const SKIP_DIR_NAMES = new Set([
  '.', '..', 'Android', 'data', 'obb', 'cache', 'Cache', 'Code Cache',
  '.thumbnails', 'lost+found', 'Notifications',
]);

/** Common folders where users store PDFs, Office docs, zips, etc. */
const ANDROID_SCAN_ROOTS = [
  '/storage/emulated/0/Download',
  '/storage/emulated/0/Downloads',
  '/storage/emulated/0/Documents',
  '/storage/emulated/0/Document',
  '/storage/emulated/0/DCIM',
  '/storage/emulated/0/Pictures',
  '/storage/emulated/0/Music',
  '/storage/emulated/0/Movies',
  '/storage/emulated/0/Bluetooth',
  '/storage/emulated/0/WhatsApp/Media/WhatsApp Documents',
  '/storage/emulated/0/WhatsApp/Media/WhatsApp Images',
  '/storage/emulated/0/Telegram/Telegram Documents',
  '/storage/emulated/0/Recordings',
  '/storage/emulated/0/SoundRecorder',
];

function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

function stableId(path: string): string {
  return path.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 140);
}

function shouldSyncFile(name: string, size: number): boolean {
  if (size <= 0 || size > MAX_FILE_BYTES) return false;
  if (name.startsWith('.')) return false;
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
  if (!ext) return false;
  return SYNC_EXTENSIONS.has(ext);
}

async function walkDirectory(
  dirPath: string,
  depth: number,
  out: ScannedStorageFile[],
): Promise<void> {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;

  let entries: string[];
  try {
    entries = await FileSystem.readDirectoryAsync(toFileUri(dirPath));
  } catch {
    return;
  }

  for (const name of entries) {
    if (out.length >= MAX_FILES) break;
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
      await walkDirectory(fullPath, depth + 1, out);
      continue;
    }

    const size = info.size ?? 0;
    if (!shouldSyncFile(name, size)) continue;

    out.push({
      id: stableId(fullPath),
      uri,
      filename: name,
      size,
      modifiedAt: info.modificationTime,
    });
  }
}

export async function scanDeviceStorage(): Promise<ScannedStorageFile[]> {
  if (Platform.OS !== 'android') return [];

  const found: ScannedStorageFile[] = [];
  const seen = new Set<string>();

  for (const root of ANDROID_SCAN_ROOTS) {
    await walkDirectory(root, 0, found);
    if (found.length >= MAX_FILES) break;
  }

  const unique: ScannedStorageFile[] = [];
  for (const file of found) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);
    unique.push(file);
  }

  return unique.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
}
