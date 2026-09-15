import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfferDecision } from './useNGO';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../api/client', () => ({
  apiClient: { post },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useOfferDecision', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('calls the frozen Person 4 accept endpoint with an idempotency key', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'accept-key' });
    post.mockResolvedValue({ data: { data: {} } });
    const { result } = renderHook(() => useOfferDecision('ngo_001'), { wrapper });

    result.current.mutate({ donationId: 'don_001', decision: 'accept' });

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith(
      '/api/v1/matching/don_001/accept',
      { ngo_id: 'ngo_001' },
      { headers: { 'Idempotency-Key': 'accept-key' } },
    );
  });

  it('calls the frozen Person 4 reject endpoint without implementing rematching', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'reject-key' });
    post.mockResolvedValue({ data: { data: {} } });
    const { result } = renderHook(() => useOfferDecision('ngo_001'), { wrapper });

    result.current.mutate({ donationId: 'don_001', decision: 'reject', reason: 'No storage today' });

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith(
      '/api/v1/matching/don_001/reject',
      { ngo_id: 'ngo_001', reason: 'No storage today' },
      { headers: { 'Idempotency-Key': 'reject-key' } },
    );
  });
});
