import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { DemandPriority, IncomingDonation, NGODemand, NGOProfile, SuccessEnvelope } from '../types/api';

type ProfileInput = Omit<NGOProfile, 'id' | 'verification_status' | 'created_at'>;
type DemandInput = Omit<NGODemand, 'id' | 'updated_at'>;

const unwrap = <T>(response: { data: SuccessEnvelope<T> }) => response.data.data;

export function useMyNGO() {
  return useQuery({
    queryKey: ['ngo', 'profile'],
    queryFn: async () => unwrap(await apiClient.get<SuccessEnvelope<NGOProfile[]>>('/api/v1/ngos')),
    select: (ngos) => ngos[0] ?? null,
  });
}

export function useSaveNGO() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, profile }: { id?: string; profile: ProfileInput }) =>
      unwrap(id
        ? await apiClient.patch<SuccessEnvelope<NGOProfile>>(`/api/v1/ngos/${id}`, profile)
        : await apiClient.post<SuccessEnvelope<NGOProfile>>('/api/v1/ngos', profile)),
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
