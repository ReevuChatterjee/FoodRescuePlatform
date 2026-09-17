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

/** True when enough time has passed since the last accepted send. */
export function shouldSend(lastSentAt: number | null, now: number, intervalMs = SEND_INTERVAL_MS): boolean {
  return lastSentAt === null || now - lastSentAt >= intervalMs;
}

export function useDriverLocation(enabled: boolean): DriverLocationState {
  const [state, setState] = useState<DriverLocationState>(() => ({
    permission: typeof navigator !== 'undefined' && navigator.geolocation ? 'unknown' : 'unsupported',
    position: null,
    lastSentAt: null,
    lastError: null,
  }));
  const latest = useRef<GeoPoint | null>(null);
  const lastSentAt = useRef<number | null>(null);
  const inFlight = useRef(false);

  // Watch position whenever the page is open, so going online can include a fix.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        latest.current = point;
        setState((s) => ({ ...s, permission: 'granted', position: point }));
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState((s) => ({
          ...s,
          permission: denied ? 'denied' : s.permission,
          lastError: denied ? null : 'Waiting for a GPS fix…',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
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

  return state;
}
