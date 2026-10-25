/**
 * Live location streaming for the driver app (Person 5).
 *
 * watchPosition keeps the latest fix; while `enabled` (driver AVAILABLE or on a
 * job) the newest fix is sent to POST /api/v1/drivers/location at most once per
 * SEND_INTERVAL_MS. The backend allows 1 request per 5 s, so a 429 is treated as
 * a skipped beat, not an error. Denied permission is surfaced so the UI can tell
 * the driver they can't be dispatched without location.
 */

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import type { GeoPoint } from './useDriver';
import { apiErrorStatus } from './useDriver';

export const SEND_INTERVAL_MS = 5_000;

export type LocationPermission = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface DriverLocationState {
  permission: LocationPermission;
  position: GeoPoint | null;
  lastSentAt: number | null;
  lastError: string | null;
}

export interface DriverLocationReturn extends DriverLocationState {
  setOverridePosition: (point: GeoPoint | null) => void;
}

/** True when enough time has passed since the last accepted send. */
export function shouldSend(lastSentAt: number | null, now: number, intervalMs = SEND_INTERVAL_MS): boolean {
  return lastSentAt === null || now - lastSentAt >= intervalMs;
}

function getStoredLocation(): GeoPoint | null {
  try {
    const raw = localStorage.getItem('replate_driver_override_location');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
        return { latitude: parsed.latitude, longitude: parsed.longitude };
      }
    }
  } catch {}
  return null;
}

/**
 * Fallback-enabled browser geolocation retriever.
 * Tries high-accuracy GNSS hardware first; if that times out or is unavailable (common on Windows PC/laptops),
 * automatically falls back to standard network Wi-Fi/IP location triangulation.
 */
export function fetchBrowserLocation(
  onSuccess: (coords: GeoPoint) => void,
  onError: (msg: string) => void,
) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('Geolocation is not supported by your browser.');
    return;
  }

  if (!navigator.geolocation.getCurrentPosition) {
    return;
  }

  // Attempt 1: Fast high accuracy (mobile / LTE laptop) with 4-second timeout
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onSuccess({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        onError('Location permission denied. Please allow location access in your browser address bar.');
        return;
      }
      // Attempt 2: Standard network Wi-Fi/IP location (works on Windows laptops/desktops!)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSuccess({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (fallbackErr) => {
          if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
            onError('Location permission denied in your browser settings.');
          } else if (fallbackErr.code === fallbackErr.TIMEOUT) {
            onError('Location request timed out. Please check Windows location permissions.');
          } else {
            onError('Could not retrieve system location. Check your network or enter location manually.');
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
      );
    },
    { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 },
  );
}

export function useDriverLocation(enabled: boolean): DriverLocationReturn {
  const storedOverride = getStoredLocation();
  const [state, setState] = useState<DriverLocationState>(() => ({
    permission: typeof navigator !== 'undefined' && navigator.geolocation ? 'unknown' : 'unsupported',
    position: storedOverride,
    lastSentAt: null,
    lastError: null,
  }));
  const latest = useRef<GeoPoint | null>(storedOverride);
  const manualOverride = useRef<GeoPoint | null>(storedOverride);
  const lastSentAt = useRef<number | null>(null);
  const inFlight = useRef(false);

  // Allow external manual override (pass null to restore live hardware GPS)
  const setOverridePosition = (point: GeoPoint | null) => {
    manualOverride.current = point;
    if (point) {
      try {
        localStorage.setItem('replate_driver_override_location', JSON.stringify(point));
      } catch {}
      latest.current = point;
      setState((s) => ({ ...s, position: point, lastError: null }));
    } else {
      try {
        localStorage.removeItem('replate_driver_override_location');
      } catch {}
      if (latest.current) {
        setState((s) => ({ ...s, position: latest.current, lastError: null }));
      }
    }
  };

  // Watch position whenever the page is open, so going online can include a fix.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    // Fast initial fix if not manually overridden
    if (!manualOverride.current) {
      fetchBrowserLocation(
        (point) => {
          if (!manualOverride.current) {
            latest.current = point;
            setState((s) => ({ ...s, permission: 'granted', position: point, lastError: null }));
          }
        },
        (err) => {
          if (err.includes('denied')) {
            setState((s) => ({ ...s, permission: 'denied', lastError: err }));
          }
        },
      );
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (manualOverride.current) return; // Ignore hardware GPS if manually overridden
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        latest.current = point;
        setState((s) => ({ ...s, permission: 'granted', position: point, lastError: null }));
      },
      (err) => {
        if (manualOverride.current) return;
        const denied = err.code === err.PERMISSION_DENIED;
        setState((s) => ({
          ...s,
          permission: denied ? 'denied' : s.permission,
          lastError: denied ? 'Location permission denied in browser' : null,
        }));
      },
      { enableHighAccuracy: false, maximumAge: 10_000, timeout: 25_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Send the newest fix on a fixed beat while enabled.
  useEffect(() => {
    if (!enabled) return;

    const send = async () => {
      const point = latest.current;
      const now = Date.now();
      if (!point || inFlight.current || !shouldSend(lastSentAt.current, now)) return;
      inFlight.current = true;
      try {
        await apiClient.post('/api/v1/drivers/location', point);
        lastSentAt.current = now;
        setState((s) => ({ ...s, lastSentAt: now, lastError: null }));
      } catch (error) {
        if (apiErrorStatus(error) !== 429) {
          setState((s) => ({ ...s, lastError: 'Location update failed; retrying.' }));
        } // 429: the server already has a recent fix; just wait for the next beat
      } finally {
        inFlight.current = false;
      }
    };

    void send();
    const timer = setInterval(() => void send(), 1_000);
    return () => clearInterval(timer);
  }, [enabled]);

  return { ...state, setOverridePosition };
}
