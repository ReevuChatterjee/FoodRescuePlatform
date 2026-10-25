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
 * Fast multi-source IP Geolocation fallback.
 * Used when hardware GNSS / browser Wi-Fi triangulation is unavailable (e.g. desktop PCs on Ethernet,
 * Windows devices with location services off, or local development environments).
 */
export async function fetchIpLocation(): Promise<{ coords: GeoPoint; source: string } | null> {
  // Source 1: ipapi.co (Accurate city-level resolution)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number' && !data.error) {
        return { coords: { latitude: data.latitude, longitude: data.longitude }, source: data.city || 'Network IP' };
      }
    }
  } catch {}

  // Source 2: free.freeipapi.com (Fast, CORS-enabled global API)
  try {
    const res = await fetch('https://free.freeipapi.com/api/v1/json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number' && data.latitude !== 0) {
        return { coords: { latitude: data.latitude, longitude: data.longitude }, source: data.cityName || 'Network IP' };
      }
    }
  } catch {}

  // Source 3: ipwho.is (CORS-enabled)
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return { coords: { latitude: data.latitude, longitude: data.longitude }, source: data.city || 'Network IP' };
      }
    }
  } catch {}

  // Source 4: get.geojs.io
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const lat = parseFloat(data.latitude);
      const lng = parseFloat(data.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { coords: { latitude: lat, longitude: lng }, source: data.city || 'Network IP' };
      }
    }
  } catch {}

  return null;
}

/**
 * Multi-tier browser & network geolocation retriever:
 * 1. Fast High-Accuracy Hardware GNSS (up to 6s)
 * 2. Standard Network Wi-Fi / Cellular Triangulation (up to 6s)
 * 3. Automatic Multi-Source IP Geolocation Fallback (instant city/region coordinates)
 */
export function fetchBrowserLocation(
  onSuccess: (coords: GeoPoint, source?: string) => void,
  onError: (msg: string) => void,
) {
  let settled = false;

  const tryIpFallback = async (reasonMsg?: string) => {
    if (settled) return;
    try {
      const ipResult = await fetchIpLocation();
      if (ipResult && !settled) {
        settled = true;
        onSuccess(ipResult.coords, `Network IP (${ipResult.source})`);
        return;
      }
    } catch {}

    if (!settled) {
      settled = true;
      onError(reasonMsg || 'Could not retrieve system location. Check your network or enter location manually.');
    }
  };

  if (
    typeof navigator === 'undefined' ||
    !navigator.geolocation ||
    typeof navigator.geolocation.getCurrentPosition !== 'function'
  ) {
    void tryIpFallback('Geolocation is not supported by your browser.');
    return;
  }

  // Attempt 1: Fast high accuracy (mobile / GNSS) with 6-second timeout
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!settled) {
        settled = true;
        onSuccess({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, 'Hardware GPS');
      }
    },
    (err) => {
      if (settled) return;
      if (err.code === err.PERMISSION_DENIED) {
        void tryIpFallback('Location permission denied in browser. Using network location.');
        return;
      }

      // Attempt 2: Standard network Wi-Fi/IP location (works on Windows laptops/desktops)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!settled) {
            settled = true;
            onSuccess({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, 'Browser Wi-Fi');
          }
        },
        () => {
          // Attempt 3: Automatic IP Geolocation fallback
          void tryIpFallback('GNSS/Wi-Fi unavailable on this device. Using network location.');
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
      );
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
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
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!manualOverride.current) {
        void fetchIpLocation().then((res) => {
          if (res && !manualOverride.current) {
            latest.current = res.coords;
            setState((s) => ({ ...s, permission: 'granted', position: res.coords, lastError: null }));
          }
        });
      }
      return;
    }

    // Fast initial fix if not manually overridden
    if (!manualOverride.current) {
      // Parallel fast IP geolocation resolution (resolves in ~250ms)
      void fetchIpLocation().then((res) => {
        if (res && !manualOverride.current && !latest.current) {
          latest.current = res.coords;
          setState((s) => ({ ...s, permission: 'granted', position: res.coords, lastError: null }));
        }
      });

      // Browser hardware GPS / Wi-Fi triangulation to refine precision
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

    if (typeof navigator.geolocation.watchPosition === 'function') {
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
          if (denied) {
            setState((s) => ({
              ...s,
              permission: 'denied',
              lastError: 'Location permission denied in browser',
            }));
          } else if (!latest.current) {
            // Watch position timed out or failed: acquire IP fallback
            void fetchIpLocation().then((res) => {
              if (res && !manualOverride.current && !latest.current) {
                latest.current = res.coords;
                setState((s) => ({ ...s, permission: 'granted', position: res.coords, lastError: null }));
              }
            });
          }
        },
        { enableHighAccuracy: false, maximumAge: 30_000, timeout: 25_000 },
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
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
