import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStackScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';
import {
  startRecording,
  stopRecordingAndUpload,
  deleteRecording,
  isRecordingBusy,
} from '../../services/AudioService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface AudioFileDoc {
  id: string;
  filename: string;
  duration: string;
  durationMs: number;
  size: string;
  recordedAt: string;
  downloadUrl: string;
  source: 'manual' | 'remote';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AudioRecordingsScreen() {
  const headerTop = useTopInset(16);
  const bottomPadding = useStackScreenBottomPadding();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [recordings, setRecordings] = useState<AudioFileDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<import('expo-av').Audio.Sound | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'audioFiles'), where('userId', '==', user.id), orderBy('recordedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => {
        setRecordings(
          snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              filename: data.filename || '',
              duration: data.duration || '00:00',
              durationMs: data.durationMs || 0,
              size: data.size || '0 KB',
              recordedAt: data.recordedAt || new Date().toISOString(),
              downloadUrl: data.downloadUrl || '',
              source: data.source || 'manual',
            } as AudioFileDoc;
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  async function handlePlay(item: AudioFileDoc) {
    if (playingId === item.id) {
      await stopPlayback();
      return;
    }
    if (!item.downloadUrl) {
      Alert.alert('Not Ready', 'This recording is still uploading. Try again in a moment.');
      return;
    }
    await stopPlayback();
    try {
      const { Audio } = await import('expo-av');
      // Recording leaves the audio session in "record" mode (earpiece-routed,
      // background-active) — reset to a normal playback mode first, or the
      // clip can come out silent/near-inaudible right after recording one.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync({ uri: item.downloadUrl }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(item.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) {
          if (status.error) console.error('[AudioRecordingsScreen] playback error', status.error);
          return;
        }
        if (status.didJustFinish) stopPlayback();
      });
    } catch (e) {
      console.error('[AudioRecordingsScreen] playback failed', e);
      Alert.alert('Playback Failed', 'Could not play this recording. Check your connection and try again.');
    }
  }

  async function handleDelete(item: AudioFileDoc) {
    Alert.alert('Delete Recording', 'This will permanently remove the recording.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (playingId === item.id) await stopPlayback();
          setBusyId(item.id);
          try {
            await deleteRecording(item.id, user!.id, item.filename);
          } catch {
            Alert.alert('Delete Failed', 'Could not delete this recording.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function handleToggleRecord() {
    if (!user) return;
    if (isRecording) {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setSaving(true);
      try {
        const url = await stopRecordingAndUpload(user.id, user.name, 'manual');
        if (!url) Alert.alert('Recording Failed', 'The recording could not be saved. Please try again.');
      } catch (e) {
        console.error('[AudioRecordingsScreen] stopRecordingAndUpload failed', e);
        Alert.alert('Recording Failed', 'The recording could not be saved. Please try again.');
      } finally {
        setSaving(false);
        setRecordSeconds(0);
      }
      return;
    }
    if (isRecordingBusy()) {
      Alert.alert('Busy', 'A recording is already in progress elsewhere. Please wait a moment and try again.');
      return;
    }
    try {
      await startRecording();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch (e: any) {
      console.error('[AudioRecordingsScreen] startRecording failed', e);
      Alert.alert('Could Not Start Recording', e?.message || 'Microphone unavailable. Check mic permission in Settings.');
    }
  }

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
          <Text style={styles.headerTitle}>Voice Notes</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.headerSubtitle}>Record and manage voice notes for work communications</Text>
      </LinearGradient>

      <TouchableOpacity
        style={[styles.recordBar, isRecording && styles.recordBarActive]}
        onPress={handleToggleRecord}
        disabled={saving}
        activeOpacity={0.85}
      >
        <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
        <Text style={[styles.recordBarText, isRecording && styles.recordBarTextActive]}>
          {saving
            ? 'Saving recording...'
            : isRecording
            ? `Recording... ${String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:${String(recordSeconds % 60).padStart(2, '0')} · Tap to stop`
            : 'Tap to record a voice note'}
        </Text>
        {saving ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={22} color={isRecording ? '#DC2626' : '#2563EB'} />
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: 4 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No recordings yet.</Text>}
          renderItem={({ item }) => {
            const isPlaying = playingId === item.id;
            const isBusy = busyId === item.id;
            return (
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                  onPress={() => handlePlay(item)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={isPlaying ? '#FFFFFF' : '#2563EB'} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {item.source === 'remote' ? 'Compliance Recording' : 'Voice Note'} · {item.duration}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDate(item.recordedAt)} · {item.size}</Text>
                </View>
                {isBusy ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8, fontWeight: '500' },

  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -14,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  recordBarActive: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  recordDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2563EB' },
  recordDotActive: { backgroundColor: '#DC2626' },
  recordBarText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  recordBarTextActive: { color: '#DC2626' },

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
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playBtnActive: { backgroundColor: '#2563EB' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '500' },
  deleteBtn: { padding: 8 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 13, fontWeight: '500' },
});
