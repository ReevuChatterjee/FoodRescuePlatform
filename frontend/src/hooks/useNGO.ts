/**
 * NGO hooks — profile, incoming offers, capacity/demand updates.
 * All calls use the authenticated apiClient.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { SuccessEnvelope } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NGOProfile {
  ngo_id: string;
  organisation_name: string;
  address: string;
  location: { latitude: number | null; longitude: number | null };
  storage_capacity_kg: number;
  available_capacity_kg: number;
  operating_hours: { start: string; end: string };
  accepted_categories: string[];
  is_verified: boolean;
  verification_status: string;
  demand: {
    food_category: string;
    required_quantity_kg: number;
    priority: number;
    valid_until: string;
  }[];
  created_at: string;
}

export interface IncomingOffer {
  donation_id: string;
  food_category: string;
  food_name: string;
  quantity_kg: number;
  match_score: number | null;
  eta_minutes: number | null;
  distance_km: number | null;
  remaining_shelf_life_min: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMyNGOProfile() {
  return useQuery({
    queryKey: ['ngo', 'profile'],
    queryFn: async () => {
      // First, get current user to find ngo_id
      const meRes = await apiClient.get('/api/v1/auth/me');
      const ngoId = meRes.data.data.ngo_id || meRes.data.data.user_id;
      const res = await apiClient.get<SuccessEnvelope<NGOProfile>>(`/api/v1/ngos/${ngoId}`);
      return res.data.data;
    },
    refetchInterval: 60000,
  });
}

export function useIncomingOffers(ngoId: string | undefined) {
  return useQuery({
    queryKey: ['ngo', 'incoming', ngoId],
    queryFn: async () => {
      const res = await apiClient.get<SuccessEnvelope<IncomingOffer[]>>(`/api/v1/ngos/${ngoId}/incoming`);
      return res.data.data;
    },
    enabled: !!ngoId,
    refetchInterval: 15000,
  });
}

export function useUpdateNGOCapacity(ngoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (available_capacity_kg: number) => {
      const res = await apiClient.patch(`/api/v1/ngos/${ngoId}/capacity`, { available_capacity_kg });
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ngo', 'profile'] }),
  });
}

export function useUpdateNGODemand(ngoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      food_category: string;
      required_quantity_kg: number;
      priority: number;
      valid_until: string;
    }) => {
      const res = await apiClient.patch(`/api/v1/ngos/${ngoId}/demand`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ngo', 'profile'] }),
  });
}

export function useUpdateNGOProfile(ngoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<{
      organisation_name: string;
      address: string;
      operating_start: string;
      operating_end: string;
      accepted_categories: string[];
    }>) => {
      const res = await apiClient.patch(`/api/v1/ngos/${ngoId}`, payload);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ngo', 'profile'] }),
  });
}
