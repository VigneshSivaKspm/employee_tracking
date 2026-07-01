/**
 * AudioService.ts
 *
 * Enterprise audio recording interface skeleton.
 * Implements a state machine for mic capture using Expo AV.
 *
 * Production setup:
 *   npm install expo-av
 *   Add NSMicrophoneUsageDescription to Info.plist (iOS)
 *   Add RECORD_AUDIO to AndroidManifest.xml (Android)
 */

// Uncomment when expo-av is installed:
// import { Audio } from 'expo-av';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface AudioCapture {
  uri: string | null;
  durationMs: number;
  startedAt: string;
  stoppedAt: string | null;
}

// ─── State machine ────────────────────────────────────────────────────────────

let currentState: RecordingState = 'idle';
let activeCapture: AudioCapture | null = null;
// let recording: Audio.Recording | null = null; // Uncomment for real implementation

export function getRecordingState(): RecordingState {
  return currentState;
}

export function getActiveCapture(): AudioCapture | null {
  return activeCapture;
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestMicrophonePermission(): Promise<boolean> {
  currentState = 'requesting';
  try {
    // const { status } = await Audio.requestPermissionsAsync();
    // return status === 'granted';
    console.log('[AudioService] requestMicrophonePermission stub — simulating granted');
    return true;
  } catch (error) {
    currentState = 'error';
    console.error('[AudioService] requestMicrophonePermission error:', error);
    return false;
  }
}

// ─── Recording controls ───────────────────────────────────────────────────────

export async function startRecording(): Promise<void> {
  const permitted = await requestMicrophonePermission();
  if (!permitted) throw new Error('Microphone permission denied');

  currentState = 'recording';
  activeCapture = {
    uri: null,
    durationMs: 0,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
  };

  try {
    // await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    // const { recording: rec } = await Audio.Recording.createAsync(
    //   Audio.RecordingOptionsPresets.HIGH_QUALITY,
    // );
    // recording = rec;
    console.log('[AudioService] startRecording stub — recording session started');
  } catch (error) {
    currentState = 'error';
    console.error('[AudioService] startRecording error:', error);
    throw error;
  }
}

export async function pauseRecording(): Promise<void> {
  if (currentState !== 'recording') return;
  currentState = 'paused';
  try {
    // await recording?.pauseAsync();
    console.log('[AudioService] pauseRecording stub');
  } catch (error) {
    console.error('[AudioService] pauseRecording error:', error);
  }
}

export async function resumeRecording(): Promise<void> {
  if (currentState !== 'paused') return;
  currentState = 'recording';
  try {
    // await recording?.startAsync();
    console.log('[AudioService] resumeRecording stub');
  } catch (error) {
    console.error('[AudioService] resumeRecording error:', error);
  }
}

export async function stopRecording(): Promise<AudioCapture | null> {
  if (currentState !== 'recording' && currentState !== 'paused') return null;

  currentState = 'stopped';
  try {
    // await recording?.stopAndUnloadAsync();
    // const uri = recording?.getURI() ?? null;
    // recording = null;

    const finalCapture: AudioCapture = {
      uri: 'file://mock/recording_001.m4a', // Replace with real uri
      durationMs: 5000, // Replace with real duration
      startedAt: activeCapture?.startedAt ?? new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
    };

    activeCapture = finalCapture;
    console.log('[AudioService] stopRecording stub — capture:', finalCapture);

    // Firebase upload stub:
    // const storageRef = storage.ref(`audio/${userId}/${Date.now()}.m4a`);
    // await storageRef.putFile(finalCapture.uri);
    // const downloadUrl = await storageRef.getDownloadURL();
    // await db.collection('audioCaptures').add({ ...finalCapture, userId, url: downloadUrl });

    return finalCapture;
  } catch (error) {
    currentState = 'error';
    console.error('[AudioService] stopRecording error:', error);
    return null;
  }
}

export function resetRecording(): void {
  currentState = 'idle';
  activeCapture = null;
  // recording = null;
  console.log('[AudioService] Recording state reset');
}
