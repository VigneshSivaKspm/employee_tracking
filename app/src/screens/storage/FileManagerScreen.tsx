import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useEnterpriseSync } from '../../context/EnterpriseSyncContext';
import { useStackScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';
import {
  listDirectory,
  parentPath,
  uploadFileToCloud,
  formatFileSize,
  fileCategory,
  STORAGE_ROOT,
  type FileEntry,
} from '../../services/FileManagerService';
import { requestAllFilesAccess } from '../../services/storageAccess';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Image: 'image-outline',
  Media: 'videocam-outline',
  Document: 'document-text-outline',
  Backup: 'archive-outline',
};

function folderLabel(path: string): string {
  if (path === STORAGE_ROOT) return 'Internal Storage';
  return path.split('/').pop() || path;
}

export default function FileManagerScreen() {
  const headerTop = useTopInset(16);
  const bottomPadding = useStackScreenBottomPadding();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { isOnline } = useEnterpriseSync();

  const [currentPath, setCurrentPath] = useState(STORAGE_ROOT);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [truncatedInfo, setTruncatedInfo] = useState<{ shown: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadingPaths, setUploadingPaths] = useState<Set<string>>(new Set());
  const [syncedPaths, setSyncedPaths] = useState<Set<string>>(new Set());
  const [batchUploading, setBatchUploading] = useState(false);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setAccessError(null);
    try {
      const result = await listDirectory(path);
      setEntries(result.entries);
      setTruncatedInfo(result.truncated ? { shown: result.entries.length, total: result.totalCount } : null);
    } catch (e: any) {
      setEntries([]);
      setTruncatedInfo(null);
      setAccessError(e?.message || 'Could not read this folder.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(currentPath);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]),
  );

  function openEntry(entry: FileEntry) {
    if (entry.isDirectory) {
      setSelected(new Set());
      setCurrentPath(entry.path);
      return;
    }
    toggleSelect(entry.path);
  }

  function toggleSelect(path: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function goUp() {
    const parent = parentPath(currentPath);
    if (parent) {
      setSelected(new Set());
      setCurrentPath(parent);
    } else {
      navigation.goBack();
    }
  }

  async function handleGrantAccess() {
    await requestAllFilesAccess();
  }

  const uploadOne = useCallback(
    async (entry: FileEntry): Promise<boolean> => {
      if (!user) return false;
      setUploadingPaths(prev => new Set(prev).add(entry.path));
      try {
        await uploadFileToCloud(user.id, user.name, entry);
        setSyncedPaths(prev => new Set(prev).add(entry.path));
        return true;
      } catch (e: any) {
        Alert.alert('Sync Failed', e?.message || `Could not sync ${entry.name}.`);
        return false;
      } finally {
        setUploadingPaths(prev => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
      }
    },
    [user],
  );

  async function handleSyncSingle(entry: FileEntry) {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to the internet to sync this file.');
      return;
    }
    await uploadOne(entry);
  }

  async function handleSyncSelected() {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to the internet to sync selected files.');
      return;
    }
    const toUpload = entries.filter(e => selected.has(e.path) && !e.isDirectory);
    if (toUpload.length === 0) return;
    setBatchUploading(true);
    let succeeded = 0;
    for (const entry of toUpload) {
      const ok = await uploadOne(entry);
      if (ok) succeeded++;
    }
    setBatchUploading(false);
    setSelected(new Set());
    Alert.alert('Sync Complete', `${succeeded} of ${toUpload.length} file(s) synced to the cloud.`);
  }

  const selectedFileCount = useMemo(
    () => entries.filter(e => selected.has(e.path) && !e.isDirectory).length,
    [entries, selected],
  );

  const breadcrumb = useMemo(() => {
    const rel = currentPath === STORAGE_ROOT ? '' : currentPath.replace(`${STORAGE_ROOT}/`, '');
    return rel ? `Internal Storage / ${rel.replace(/\//g, ' / ')}` : 'Internal Storage';
  }, [currentPath]);

  if (Platform.OS !== 'android') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={[styles.header, { paddingTop: headerTop }]}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>File Manager</Text>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>
        <View style={styles.centerState}>
          <Ionicons name="folder-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>Full device file browsing is only available on Android.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#1E3A8A', '#2563EB']} style={[styles.header, { paddingTop: headerTop }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={goUp} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{folderLabel(currentPath)}</Text>
            <Text style={styles.headerBreadcrumb} numberOfLines={1}>{breadcrumb}</Text>
          </View>
        </View>
      </LinearGradient>

      {accessError ? (
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>{accessError}</Text>
          <TouchableOpacity style={styles.grantBtn} onPress={handleGrantAccess} activeOpacity={0.85}>
            <Text style={styles.grantBtnText}>Allow Full Storage Access</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.path}
          contentContainerStyle={{ paddingBottom: selectedFileCount > 0 ? 80 : bottomPadding, paddingTop: 8 }}
          ListHeaderComponent={
            truncatedInfo ? (
              <View style={styles.truncatedBanner}>
                <Ionicons name="information-circle-outline" size={14} color="#B45309" />
                <Text style={styles.truncatedBannerText}>
                  Showing {truncatedInfo.shown} of {truncatedInfo.total} items in this folder.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="folder-open-outline" size={36} color="#CBD5E1" />
              <Text style={styles.centerStateText}>This folder is empty.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUploading = uploadingPaths.has(item.path);
            const isSynced = syncedPaths.has(item.path);
            const isSelected = selected.has(item.path);
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => openEntry(item)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.isDirectory ? 'folder' : CATEGORY_ICON[fileCategory(item.name)] ?? 'document-outline'}
                  size={22}
                  color={item.isDirectory ? '#D97706' : '#2563EB'}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  {!item.isDirectory && (
                    <Text style={styles.rowMeta}>{formatFileSize(item.size)}</Text>
                  )}
                </View>
                {!item.isDirectory && (
                  isUploading ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : isSynced ? (
                    <Ionicons name="cloud-done" size={20} color="#16A34A" />
                  ) : isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                  ) : (
                    <TouchableOpacity onPress={() => handleSyncSingle(item)} style={styles.uploadBtn} activeOpacity={0.7}>
                      <Ionicons name="cloud-upload-outline" size={20} color="#64748B" />
                    </TouchableOpacity>
                  )
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {selectedFileCount > 0 && (
        <View style={[styles.selectionBar, { paddingBottom: Math.max(bottomPadding - 20, 12) }]}>
          <Text style={styles.selectionBarText}>{selectedFileCount} selected</Text>
          <TouchableOpacity
            style={styles.selectionBarBtn}
            onPress={handleSyncSelected}
            disabled={batchUploading}
            activeOpacity={0.85}
          >
            {batchUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                <Text style={styles.selectionBarBtnText}>Sync {selectedFileCount} File{selectedFileCount > 1 ? 's' : ''}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  headerBreadcrumb: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  rowSelected: { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' },
  rowName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '500' },
  uploadBtn: { padding: 4 },

  truncatedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  truncatedBannerText: { flex: 1, fontSize: 11, color: '#B45309', fontWeight: '600' },
  centerState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40, gap: 10 },
  centerStateText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', fontWeight: '500', lineHeight: 19 },
  grantBtn: { backgroundColor: '#2563EB', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, marginTop: 6 },
  grantBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  selectionBarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  selectionBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  selectionBarBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
