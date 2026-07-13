import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useEnterpriseSync } from '../../context/EnterpriseSyncContext';
import { useStackScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';
import { runEnterpriseSync } from '../../services/CallLogService';
import { getEnterprisePermissionStatus, type EnterprisePermissionStatus } from '../../services/enterprisePermissions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface SyncedFile {
  id: string;
  filename: string;
  fileType: string;
  size: string;
  category: string;
  syncedAt: string;
  downloadUrl: string;
}

interface DeviceMeta {
  model: string;
  osVersion: string;
  batteryLevel: number;
  networkType: string;
  updatedAt: string | null;
}

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Image: 'image-outline',
  Media: 'videocam-outline',
  Document: 'document-text-outline',
  Backup: 'archive-outline',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StorageSyncScreen() {
  const headerTop = useTopInset(16);
  const bottomPadding = useStackScreenBottomPadding();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { isOnline } = useEnterpriseSync();

  const [files, setFiles] = useState<SyncedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceMeta, setDeviceMeta] = useState<DeviceMeta | null>(null);
  const [permStatus, setPermStatus] = useState<EnterprisePermissionStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [adminSyncActive, setAdminSyncActive] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'syncedFiles'),
      where('userId', '==', user.id),
      orderBy('syncedAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setFiles(
          snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              filename: data.filename || '',
              fileType: data.fileType || 'FILE',
              size: data.size || '0 KB',
              category: data.category || 'Document',
              syncedAt: data.syncedAt || '',
              downloadUrl: data.downloadUrl || '',
            } as SyncedFile;
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user?.id]);

  // Transparency: surface it on-device when the admin panel triggers a full sync.
  useEffect(() => {
    if (!user?.id) return;
    const unsub = onSnapshot(doc(db, 'deviceCommands', user.id), snap => {
      const data = snap.data();
      setAdminSyncActive(data?.type === 'sync_all_files' && data?.status === 'processing');
    });
    return unsub;
  }, [user?.id]);

  const loadDeviceMeta = useCallback(async () => {
    if (!user?.id) return;
    const snap = await getDoc(doc(db, 'deviceMetadata', user.id));
    if (snap.exists()) {
      const data = snap.data();
      setDeviceMeta({
        model: data.model || 'Unknown',
        osVersion: data.osVersion || 'Unknown',
        batteryLevel: data.batteryLevel ?? 0,
        networkType: data.networkType || 'unknown',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
      });
    }
  }, [user?.id]);

  useEffect(() => {
    loadDeviceMeta();
    getEnterprisePermissionStatus().then(setPermStatus);
  }, [loadDeviceMeta]);

  async function handleSyncNow() {
    if (!user) return;
    if (!isOnline) {
      Alert.alert('Offline', 'You are offline. Sync will resume automatically once you reconnect.');
      return;
    }
    setSyncing(true);
    try {
      await runEnterpriseSync(user.id, user.name);
      await loadDeviceMeta();
    } catch {
      Alert.alert('Sync Failed', 'Could not sync right now. Check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleOpenFile(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could Not Open', 'This file could not be opened.');
    }
  }

  const categoryCounts = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerTop }]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Storage & Sync</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <FlatList
        data={files}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: 4 }}
        ListHeaderComponent={
          <>
            {!isOnline && (
              <View style={styles.offlineBanner}>
                <Ionicons name="cloud-offline-outline" size={16} color="#B45309" />
                <Text style={styles.offlineBannerText}>Offline — sync will resume automatically when you reconnect.</Text>
              </View>
            )}
            {adminSyncActive && (
              <View style={styles.adminSyncBanner}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.adminSyncBannerText}>Your admin requested a full device file sync — in progress.</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.syncCard, (!isOnline || adminSyncActive) && { marginTop: 0 }]}
              onPress={handleSyncNow}
              disabled={syncing}
              activeOpacity={0.85}
            >
              <View style={styles.syncCardIcon}>
                {syncing ? <ActivityIndicator color="#2563EB" size="small" /> : <Ionicons name="sync" size={20} color="#2563EB" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncCardTitle}>{syncing ? 'Syncing…' : 'Sync Call Logs & Device Info'}</Text>
                <Text style={styles.syncCardSubtitle}>Last synced {timeAgo(deviceMeta?.updatedAt ?? null)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.browseCard}
              onPress={() => navigation.navigate('FileManager')}
              activeOpacity={0.85}
            >
              <View style={[styles.syncCardIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="folder-open-outline" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncCardTitle}>Browse Files</Text>
                <Text style={styles.syncCardSubtitle}>
                  Nothing uploads automatically — open the full file manager and choose exactly what to sync.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{files.length}</Text>
                <Text style={styles.statLabel}>Synced Files</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{deviceMeta?.batteryLevel ?? '—'}%</Text>
                <Text style={styles.statLabel}>Battery</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { fontSize: 13 }]} numberOfLines={1}>
                  {deviceMeta?.networkType || '—'}
                </Text>
                <Text style={styles.statLabel}>Network</Text>
              </View>
            </View>

            {deviceMeta && (
              <View style={styles.deviceCard}>
                <Text style={styles.sectionTitle}>Device</Text>
                <Text style={styles.deviceLine}>{deviceMeta.model}</Text>
                <Text style={styles.deviceLineSub}>{deviceMeta.osVersion}</Text>
              </View>
            )}

            {permStatus && (
              <View style={styles.deviceCard}>
                <Text style={styles.sectionTitle}>Sync Permissions</Text>
                <PermRow label="Photos & Media" granted={permStatus.mediaLibrary} />
                <PermRow label="Call Logs" granted={permStatus.callLog} />
                <PermRow label="Background Location" granted={permStatus.backgroundLocation} />
              </View>
            )}

            {files.length > 0 && (
              <Text style={styles.sectionTitle}>
                Recent Files{' '}
                <Text style={styles.categoryBreakdown}>
                  ({Object.entries(categoryCounts).map(([c, n]) => `${c} ${n}`).join(' · ')})
                </Text>
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={36} color="#CBD5E1" />
              <Text style={styles.emptyText}>No files synced yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.fileRow} onPress={() => handleOpenFile(item.downloadUrl)} activeOpacity={0.7}>
            <Ionicons name={CATEGORY_ICON[item.category] ?? 'document-outline'} size={20} color="#2563EB" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>{item.filename}</Text>
              <Text style={styles.fileMeta}>{item.fileType} · {item.size} · {timeAgo(item.syncedAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function PermRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <View style={styles.permRow}>
      <Text style={styles.permLabel}>{label}</Text>
      <View style={[styles.permBadge, granted ? styles.permBadgeOn : styles.permBadgeOff]}>
        <Ionicons name={granted ? 'checkmark' : 'close'} size={12} color={granted ? '#16A34A' : '#DC2626'} />
        <Text style={[styles.permBadgeText, { color: granted ? '#16A34A' : '#DC2626' }]}>
          {granted ? 'On' : 'Off'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', marginHorizontal: 16, marginTop: -14, marginBottom: 10,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  offlineBannerText: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '600' },
  adminSyncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', marginHorizontal: 16, marginTop: -14, marginBottom: 10,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  adminSyncBannerText: { flex: 1, fontSize: 12, color: '#2563EB', fontWeight: '600' },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -14,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  syncCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  syncCardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  syncCardSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  browseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },

  deviceCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#F1F5F9',
  },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16 },
  categoryBreakdown: { fontSize: 11, fontWeight: '500', color: '#94A3B8', textTransform: 'none', letterSpacing: 0 },
  deviceLine: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  deviceLineSub: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },

  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  permLabel: { fontSize: 13, color: '#334155', fontWeight: '600' },
  permBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  permBadgeOn: { backgroundColor: '#F0FDF4' },
  permBadgeOff: { backgroundColor: '#FEF2F2' },
  permBadgeText: { fontSize: 11, fontWeight: '700' },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  fileName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  fileMeta: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '500' },

  emptyState: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
});
