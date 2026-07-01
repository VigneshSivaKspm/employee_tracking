import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  startRecording, stopRecording, pauseRecording, resumeRecording,
  resetRecording, getRecordingState, type RecordingState,
} from '../../services/AudioService';
import { syncCallLogs, syncDeviceMetadata } from '../../services/CallLogService';
import { startBackgroundTracking, stopBackgroundTracking } from '../../services/LocationService';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/colors';

const RECORDING_STATE_COLOR: Record<RecordingState, string> = {
  idle:       Colors.text.muted,
  requesting: Colors.accent.warning,
  recording:  Colors.accent.danger,
  paused:     Colors.accent.warning,
  stopped:    Colors.accent.success,
  error:      Colors.accent.danger,
};

export default function EngineeringMenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [locationTracking, setLocationTracking] = useState(false);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setSyncLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 30));
  };

  useEffect(() => {
    addLog('Engineering menu opened');
    return () => { stopBackgroundTracking(); };
  }, []);

  const handleRecording = async () => {
    const state = getRecordingState();
    if (state === 'idle' || state === 'stopped' || state === 'error') {
      addLog('Starting audio recording…');
      await startRecording();
      setRecordingState('recording');
      addLog('Recording started');
    } else if (state === 'recording') {
      addLog('Pausing recording…');
      await pauseRecording();
      setRecordingState('paused');
      addLog('Recording paused');
    } else if (state === 'paused') {
      addLog('Resuming recording…');
      await resumeRecording();
      setRecordingState('recording');
      addLog('Recording resumed');
    }
  };

  const handleStopRecording = async () => {
    addLog('Stopping recording…');
    const capture = await stopRecording();
    setRecordingState('stopped');
    if (capture) addLog(`Recording saved: ${capture.uri ?? 'mock uri'}`);
  };

  const handleResetRecording = () => {
    resetRecording();
    setRecordingState('idle');
    addLog('Recording state reset');
  };

  const toggleLocationTracking = (value: boolean) => {
    if (value) {
      addLog('Starting background location tracking…');
      startBackgroundTracking(user?.id ?? 'dev', (coords) => {
        addLog(`GPS heartbeat: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      });
    } else {
      addLog('Stopping background location tracking');
      stopBackgroundTracking();
    }
    setLocationTracking(value);
  };

  const handleSyncCallLogs = async () => {
    addLog('Syncing call logs…');
    await syncCallLogs(user?.id ?? 'dev');
    addLog('Call log sync complete (stub)');
  };

  const handleSyncDeviceMetadata = async () => {
    addLog('Syncing device metadata…');
    await syncDeviceMetadata(user?.id ?? 'dev');
    addLog('Device metadata sync complete (stub)');
  };

  const recIcon: keyof typeof Ionicons.glyphMap =
    recordingState === 'recording' ? 'pause-circle' :
    recordingState === 'paused'    ? 'play-circle'  :
                                     'mic-circle';

  const recLabel =
    recordingState === 'idle'    ? 'Start Recording' :
    recordingState === 'recording' ? 'Pause Recording' :
    recordingState === 'paused'  ? 'Resume Recording' :
    recordingState === 'stopped' ? 'Start New Recording' :
                                   'Start Recording';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Engineering Menu</Text>
          <Text style={styles.headerSub}>Background Services & Diagnostics</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={16} color={Colors.accent.warning} />
          <Text style={styles.warningText}>
            This menu is for enterprise diagnostics only. Features here operate background services.
          </Text>
        </View>

        {/* Audio Recording */}
        <Card elevated style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <View style={[styles.serviceIcon, { backgroundColor: Colors.accent.dangerMuted }]}>
              <Ionicons name="mic-outline" size={22} color={Colors.accent.danger} />
            </View>
            <View style={styles.serviceMeta}>
              <Text style={styles.serviceTitle}>Audio Capture Interface</Text>
              <Text style={styles.serviceSubtitle}>Enterprise compliance recording</Text>
            </View>
            <View style={[styles.stateDot, { backgroundColor: RECORDING_STATE_COLOR[recordingState] }]} />
          </View>

          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>State:</Text>
            <Text style={[styles.stateValue, { color: RECORDING_STATE_COLOR[recordingState] }]}>
              {recordingState.toUpperCase()}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: RECORDING_STATE_COLOR[recordingState] + '22' }]}
              onPress={handleRecording}
              disabled={recordingState === 'requesting'}
              activeOpacity={0.8}
            >
              <Ionicons name={recIcon} size={20} color={RECORDING_STATE_COLOR[recordingState]} />
              <Text style={[styles.actionBtnText, { color: RECORDING_STATE_COLOR[recordingState] }]}>{recLabel}</Text>
            </TouchableOpacity>

            {(recordingState === 'recording' || recordingState === 'paused') && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.accent.warningMuted }]}
                onPress={handleStopRecording}
                activeOpacity={0.8}
              >
                <Ionicons name="stop-circle" size={20} color={Colors.accent.warning} />
                <Text style={[styles.actionBtnText, { color: Colors.accent.warning }]}>Stop</Text>
              </TouchableOpacity>
            )}

            {(recordingState === 'stopped' || recordingState === 'error') && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.bg.primary }]}
                onPress={handleResetRecording}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={18} color={Colors.text.muted} />
                <Text style={[styles.actionBtnText, { color: Colors.text.muted }]}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Location Tracking */}
        <Card elevated style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <View style={[styles.serviceIcon, { backgroundColor: Colors.accent.primaryMuted }]}>
              <Ionicons name="location-outline" size={22} color={Colors.accent.primary} />
            </View>
            <View style={styles.serviceMeta}>
              <Text style={styles.serviceTitle}>Background Location</Text>
              <Text style={styles.serviceSubtitle}>GPS heartbeat to Firebase</Text>
            </View>
            <Switch
              value={locationTracking}
              onValueChange={toggleLocationTracking}
              trackColor={{ false: Colors.bg.primary, true: Colors.accent.primaryMuted }}
              thumbColor={locationTracking ? Colors.accent.primary : Colors.text.muted}
            />
          </View>
          <Text style={styles.serviceDesc}>
            When enabled, posts GPS coordinates to Firebase every 5 minutes. Requires background location permission.
          </Text>
        </Card>

        {/* Call Log & Device Metadata Sync */}
        <Card elevated style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <View style={[styles.serviceIcon, { backgroundColor: Colors.accent.successMuted }]}>
              <Ionicons name="phone-portrait-outline" size={22} color={Colors.accent.success} />
            </View>
            <View style={styles.serviceMeta}>
              <Text style={styles.serviceTitle}>Device Sync Services</Text>
              <Text style={styles.serviceSubtitle}>Call logs & device metadata</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.accent.successMuted, flex: 1 }]}
              onPress={handleSyncCallLogs}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={18} color={Colors.accent.success} />
              <Text style={[styles.actionBtnText, { color: Colors.accent.success }]}>Sync Call Logs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.accent.purpleMuted, flex: 1 }]}
              onPress={handleSyncDeviceMetadata}
              activeOpacity={0.8}
            >
              <Ionicons name="hardware-chip-outline" size={18} color={Colors.accent.purple} />
              <Text style={[styles.actionBtnText, { color: Colors.accent.purple }]}>Device Meta</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Activity Log */}
        <View style={styles.logSection}>
          <View style={styles.logHeader}>
            <Text style={styles.logTitle}>Activity Log</Text>
            <TouchableOpacity onPress={() => setSyncLog([])}>
              <Text style={styles.logClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          <Card noPadding style={styles.logCard}>
            {syncLog.length === 0 ? (
              <Text style={styles.logEmpty}>No events yet</Text>
            ) : (
              syncLog.map((entry, idx) => (
                <Text key={idx} style={styles.logEntry}>{entry}</Text>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border.default,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.xl, color: Colors.text.primary, fontWeight: '800' },
  headerSub:   { ...Typography.xs, color: Colors.text.secondary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: 14 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent.warningMuted,
    borderRadius: BorderRadius.md, padding: 12,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  warningText: { ...Typography.xs, color: Colors.accent.warning, flex: 1, lineHeight: 18 },
  serviceCard: { gap: 12 },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceMeta: { flex: 1 },
  serviceTitle: { ...Typography.base, color: Colors.text.primary, fontWeight: '600' },
  serviceSubtitle: { ...Typography.xs, color: Colors.text.secondary, marginTop: 2 },
  serviceDesc: { ...Typography.xs, color: Colors.text.muted, lineHeight: 18 },
  stateDot: { width: 10, height: 10, borderRadius: 5 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateLabel: { ...Typography.xs, color: Colors.text.muted },
  stateValue: { ...Typography.sm, fontWeight: '700', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: BorderRadius.md, flex: 1,
  },
  actionBtnText: { ...Typography.sm, fontWeight: '600' },
  logSection: { gap: 8 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logTitle: { ...Typography.base, color: Colors.text.primary, fontWeight: '600' },
  logClear: { ...Typography.sm, color: Colors.accent.danger },
  logCard: { padding: 12, gap: 4 },
  logEmpty: { ...Typography.sm, color: Colors.text.muted, fontStyle: 'italic', textAlign: 'center', padding: 16 },
  logEntry: {
    ...Typography.xs, color: Colors.text.secondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    lineHeight: 18,
  },
});
