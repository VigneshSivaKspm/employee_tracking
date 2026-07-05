/**
 * LocationService — company device GPS heartbeats for admin live tracking.
 */
import * as Location from 'expo-location';

const OFFICE_COORDINATES = {
  lat: 12.9716,
  lng: 77.5946,
  radiusMeters: 150,
};

const TRACKING_INTERVAL_MS = 30 * 1000;

export interface GPSCoordinates {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;
  await Location.requestBackgroundPermissionsAsync();
  return true;
}

export async function getCurrentPosition(): Promise<GPSCoordinates | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 0,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('[LocationService] getCurrentPosition error:', error);
    return null;
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinOfficeBoundary(coords: GPSCoordinates): boolean {
  const distance = haversineDistance(coords.lat, coords.lng, OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng);
  return distance <= OFFICE_COORDINATES.radiusMeters;
}

async function getBatteryPercent(): Promise<number> {
  try {
    const Battery = await import('expo-battery');
    const level = await Battery.getBatteryLevelAsync();
    return Math.round(level * 100);
  } catch {
    return 0;
  }
}

let trackingInterval: ReturnType<typeof setInterval> | null = null;

interface TrackingOptions {
  userId: string;
  employeeName: string;
  department: string;
  onCoordinates?: (coords: GPSCoordinates) => void;
}

async function sendHeartbeat(opts: TrackingOptions): Promise<void> {
  const coords = await getCurrentPosition();
  if (!coords) return;

  const withinBoundary = isWithinOfficeBoundary(coords);
  opts.onCoordinates?.(coords);
  const battery = await getBatteryPercent();

  try {
    const { recordLocationHeartbeat } = await import('./FirebaseService');
    await recordLocationHeartbeat(
      opts.userId,
      opts.employeeName,
      opts.department,
      { lat: coords.lat, lng: coords.lng },
      battery,
      withinBoundary,
    );
  } catch (e) {
    console.warn('[LocationService] heartbeat failed', e);
  }
}

export function stopBackgroundTracking(): void {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

let lastTrackingOpts: TrackingOptions | null = null;

export async function sendImmediateHeartbeat(): Promise<void> {
  if (lastTrackingOpts) await sendHeartbeat(lastTrackingOpts);
}

export function startBackgroundTracking(options: TrackingOptions | string, onCoordinates?: (coords: GPSCoordinates) => void): void {
  if (trackingInterval) return;

  const opts: TrackingOptions = typeof options === 'string'
    ? { userId: options, employeeName: '', department: '', onCoordinates }
    : options;

  lastTrackingOpts = opts;
  sendHeartbeat(opts);
  trackingInterval = setInterval(() => sendHeartbeat(opts), TRACKING_INTERVAL_MS);
}
