import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { DemandPriority, IncomingDonation, NGODemand, NGOProfile, SuccessEnvelope } from '../types/api';

type ProfileInput = Omit<NGOProfile, 'id' | 'verification_status' | 'created_at'>;
type DemandInput = Omit<NGODemand, 'id' | 'updated_at'>;
type ConsolidatedNGOProfile = {
  ngo_id: string;
  organisation_name: string;
  address: string;
  location_text: string;
  storage_capacity_kg: number;
  available_capacity_kg: number;
  operating_hours: { start: string; end: string };
  verification_status: NGOProfile['verification_status'];
  created_at: string;
};

const unwrap = <T>(response: { data: SuccessEnvelope<T> }) => response.data.data;
const normalizeProfile = (profile: ConsolidatedNGOProfile | null): NGOProfile | null => {
  if (profile === null) return null;

  return {
    id: profile.ngo_id,
    organisation_name: profile.organisation_name,
    address: profile.address,
    location: profile.location_text,
    storage_capacity_kg: profile.storage_capacity_kg,
    available_capacity_kg: profile.available_capacity_kg,
    operating_start: profile.operating_hours.start,
    operating_end: profile.operating_hours.end,
    verification_status: profile.verification_status,
    created_at: profile.created_at,
  };
};

export function useMyNGO() {
  return useQuery({
    queryKey: ['ngo', 'profile'],
    queryFn: async () => normalizeProfile(unwrap(await apiClient.get<SuccessEnvelope<ConsolidatedNGOProfile | null>>('/api/v1/ngos/me'))),
  });
}

export function useSaveNGO() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, profile }: { id?: string; profile: ProfileInput }) =>
      normalizeProfile(unwrap(id
        ? await apiClient.patch<SuccessEnvelope<ConsolidatedNGOProfile>>(`/api/v1/ngos/${id}`, profile)
        : await apiClient.post<SuccessEnvelope<ConsolidatedNGOProfile>>('/api/v1/ngos', profile))),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ngo'] }),
  });
}

export function useNGOCategories(ngoId?: string) {
  return useQuery({
    queryKey: ['ngo', ngoId, 'categories'],
    enabled: Boolean(ngoId),
    queryFn: async () => unwrap(await apiClient.get<SuccessEnvelope<string[]>>(`/api/v1/ngos/${ngoId}/categories`)),
  });
}

export function useSaveCategories(ngoId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (categories: string[]) => unwrap(await apiClient.put<SuccessEnvelope<string[]>>(`/api/v1/ngos/${ngoId}/categories`, { categories })),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ngo', ngoId, 'categories'] }),
  });
}

export function useNGODemands(ngoId?: string) {
  return useQuery({
    queryKey: ['ngo', ngoId, 'demands'], enabled: Boolean(ngoId),
    queryFn: async () => unwrap(await apiClient.get<SuccessEnvelope<NGODemand[]>>(`/api/v1/ngos/${ngoId}/demand`)),
  });
}

export function useSaveDemand(ngoId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, demand }: { id?: number; demand: DemandInput }) => unwrap(id
      ? await apiClient.patch<SuccessEnvelope<NGODemand>>(`/api/v1/ngos/${ngoId}/demand/${id}`, demand)
      : await apiClient.post<SuccessEnvelope<NGODemand>>(`/api/v1/ngos/${ngoId}/demand`, demand)),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ngo', ngoId, 'demands'] }),
  });
}

export function useDeleteDemand(ngoId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (demandId: number) => apiClient.delete(`/api/v1/ngos/${ngoId}/demand/${demandId}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ngo', ngoId, 'demands'] }),
  });
}

export function useIncomingDonations(ngoId?: string) {
  return useQuery({
    queryKey: ['ngo', ngoId, 'incoming'], enabled: Boolean(ngoId),
    queryFn: async () => unwrap(await apiClient.get<SuccessEnvelope<IncomingDonation[]>>(`/api/v1/ngos/${ngoId}/incoming`)),
  });
}

export function useOfferDecision(ngoId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ donationId, decision, reason }: { donationId: string; decision: 'accept' | 'reject'; reason?: string }) => {
      const headers = { 'Idempotency-Key': crypto.randomUUID() };
      const body = decision === 'accept' ? { ngo_id: ngoId } : { ngo_id: ngoId, reason: reason || 'Unable to accept this donation' };
      return apiClient.post(`/api/v1/matching/${donationId}/${decision}`, body, { headers });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['ngo', ngoId, 'incoming'] }),
  });
}

export const DEMAND_PRIORITIES: DemandPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
