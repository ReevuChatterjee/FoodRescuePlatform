/**
 * Driver hooks (Person 5) — current job, availability, and the delivery actions.
 *
 * Every mutating delivery action sends `Idempotency-Key`. The key is created once
 * per user action (useActionKey) and reused if that action is retried, so a
 * flaky connection can never pick up or deliver twice.
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { DeliveryStatus, SuccessEnvelope } from '../types/api';

// ─── Types (GET /api/v1/drivers/me/current-job) ──────────────────────────────

export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EXPIRED';
export type TrafficSource = 'live' | 'time_of_day_model' | 'city_average_model' | 'none';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RouteEstimate {
  distance_km: number;
  duration_minutes: number; // ETA including congestion
  geometry: string; // encoded polyline, precision 5
  traffic_aware: boolean;
  traffic_source: TrafficSource;
  free_flow_duration_minutes: number;
  provider: 'heuristic' | 'osrm' | 'tomtom';
  departure_time: string;
}

export interface DriverProfile {
  driver_id: string;
  vehicle_id: string;
  capacity_kg: number;
  availability_status: AvailabilityStatus;
  current_location: GeoPoint | null;
}

export interface DriverJob {
  delivery_id: string;
  donation_id: string;
  status: DeliveryStatus;
  next_stop: 'PICKUP' | 'DROPOFF';
  food_name: string;
  food_category: string;
  quantity_kg: number;
  special_handling: string | null;
  food_safety_info: {
    storage_temp_required?: string;
    allergen_tags?: string[];
    packaging_type?: string;
  } | null;
  priority: Priority;
  remaining_shelf_life_min: number;
  pickup: { latitude: number | null; longitude: number | null; address: string | null; organisation_name: string | null };
  dropoff: {
    latitude: number | null;
    longitude: number | null;
    ngo_id: string;
    organisation_name: string | null;
    address: string | null;
    operating_hours: { start: string; end: string } | null;
  };
  route_to_next_stop: RouteEstimate | null;
  timeline: {
    now: string;
    available_from: string;
    expiry_time: string;
    estimated_pickup_time: string | null;
    estimated_delivery_time: string | null;
    actual_pickup_time: string | null;
    slack_minutes: number | null;
  };
}

export interface CurrentJob {
  driver: DriverProfile;
  job: DriverJob | null;
}

export const CURRENT_JOB_KEY = ['driver', 'current-job'] as const;

export const PRE_PICKUP_STATUSES: DeliveryStatus[] = ['DRIVER_ASSIGNED', 'PICKUP_STARTED'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Backend errors arrive as {detail: {error}} (HTTPException) or {error}. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  const data = (error as { response?: { data?: any } })?.response?.data;
  return data?.detail?.error?.message ?? data?.error?.message ?? fallback;
}

export function apiErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * One idempotency key per user action: stable across retries of that action,
 * replaced only after it succeeds (or the form is dismissed).
 */
export function useActionKey() {
  const [key, setKey] = useState<string>(() => crypto.randomUUID());
  const reset = useCallback(() => setKey(crypto.randomUUID()), []);
  return { key, reset };
}

const idempotent = (key: string) => ({ headers: { 'Idempotency-Key': key } });

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useCurrentJob() {
  return useQuery({
    queryKey: CURRENT_JOB_KEY,
    queryFn: async () => {
      const res = await apiClient.get<SuccessEnvelope<CurrentJob>>('/api/v1/drivers/me/current-job');
      return res.data.data;
    },
    // WebSocket events invalidate this; the interval is only a safety net.
    refetchInterval: 60_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

function useInvalidateJob() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CURRENT_JOB_KEY });
}

export function useSetAvailability() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (payload: { availability_status: 'AVAILABLE' | 'OFFLINE'; location?: GeoPoint | null }) => {
      const body = {
        availability_status: payload.availability_status,
        ...(payload.location ? { latitude: payload.location.latitude, longitude: payload.location.longitude } : {}),
      };
      const res = await apiClient.patch<SuccessEnvelope<DriverProfile>>('/api/v1/drivers/me/availability', body);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useStartTrip() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async ({ deliveryId, idempotencyKey }: { deliveryId: string; idempotencyKey: string }) => {
      const res = await apiClient.post(`/api/v1/deliveries/${deliveryId}/start`, undefined, idempotent(idempotencyKey));
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useConfirmPickup() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (vars: { deliveryId: string; idempotencyKey: string; confirmed_quantity_kg: number }) => {
      const res = await apiClient.post(
        `/api/v1/deliveries/${vars.deliveryId}/pickup`,
        { confirmed_quantity_kg: vars.confirmed_quantity_kg },
        idempotent(vars.idempotencyKey),
      );
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useConfirmDelivery() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (vars: {
      deliveryId: string;
      idempotencyKey: string;
      quantity_handed_over: number;
      condition: string;
      recipient_confirmation: boolean;
    }) => {
      const res = await apiClient.post(
        `/api/v1/deliveries/${vars.deliveryId}/deliver`,
        {
          quantity_handed_over: vars.quantity_handed_over,
          condition: vars.condition,
          recipient_confirmation: vars.recipient_confirmation,
        },
        idempotent(vars.idempotencyKey),
      );
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useReportIssue() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (vars: { deliveryId: string; idempotencyKey: string; reason: string }) => {
      const res = await apiClient.post(
        `/api/v1/deliveries/${vars.deliveryId}/report-issue`,
        { reason: vars.reason },
        idempotent(vars.idempotencyKey),
      );
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}
