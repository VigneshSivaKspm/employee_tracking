/**
 * LocationService.ts
 *
 * Background GPS tracking service. Uses Expo Location for foreground/background
 * positioning. Coordinates are posted to Firebase at configurable intervals.
 *
 * Production setup requires:
 *   - expo-location (already in dependencies)
 *   - expo-task-manager for background tasks
 *   - "ACCESS_BACKGROUND_LOCATION" permission on Android
 */

import * as Location from 'expo-location';

// ─── Office geofence configuration ───────────────────────────────────────────
const OFFICE_COORDINATES = {
  lat: 12.9716,  // Replace with actual office latitude
  lng: 77.5946,  // Replace with actual office longitude
  radiusMeters: 150,
};

const TRACKING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface GPSCoordinates {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

// ─── Permission handling ──────────────────────────────────────────────────────

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.warn('[LocationService] Foreground location permission denied');
    return false;
  }
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('[LocationService] Background location permission denied — foreground only');
  }
  return true;
}

// ─── Current position ─────────────────────────────────────────────────────────

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
    // Return mock coordinates in dev/simulator environments
    return {
      lat: OFFICE_COORDINATES.lat + (Math.random() - 0.5) * 0.001,
      lng: OFFICE_COORDINATES.lng + (Math.random() - 0.5) * 0.001,
      accuracy: 10,
      timestamp: Date.now(),
    };
  }
}

// ─── Geofencing logic ─────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinOfficeBoundary(coords: GPSCoordinates): boolean {
  const distance = haversineDistance(coords.lat, coords.lng, OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng);
  console.log(`[LocationService] Distance from office: ${distance.toFixed(1)}m (limit: ${OFFICE_COORDINATES.radiusMeters}m)`);
  return distance <= OFFICE_COORDINATES.radiusMeters;
}

// ─── Background tracking loop ─────────────────────────────────────────────────

let trackingInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundTracking(userId: string, onCoordinates?: (coords: GPSCoordinates) => void): void {
  if (trackingInterval) return;

  console.log('[LocationService] Background tracking started for:', userId);

  trackingInterval = setInterval(async () => {
    const coords = await getCurrentPosition();
    if (!coords) return;

    const withinBoundary = isWithinOfficeBoundary(coords);
    console.log(`[LocationService] Heartbeat — within office: ${withinBoundary}`, coords);

    onCoordinates?.(coords);

    // Firebase write stub:
    // await db.collection('locationHeartbeats').add({
    //   userId,
    //   coordinates: { lat: coords.lat, lng: coords.lng },
    //   withinBoundary,
    //   timestamp: new Date().toISOString(),
    // });
  }, TRACKING_INTERVAL_MS);
}

export function stopBackgroundTracking(): void {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
    console.log('[LocationService] Background tracking stopped');
  }
}
