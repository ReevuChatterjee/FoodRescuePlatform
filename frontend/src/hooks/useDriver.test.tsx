import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiErrorMessage,
  useActionKey,
  useConfirmDelivery,
  useConfirmPickup,
  useCurrentJob,
  useReportIssue,
  useSetAvailability,
  useStartTrip,
} from './useDriver';

const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock('../api/client', () => ({ apiClient: { get, post, patch } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

let uuid = 0;

describe('driver hooks', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    uuid = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `key-${++uuid}` });
  });

  it('loads the current job from /drivers/me/current-job', async () => {
    get.mockResolvedValue({ data: { data: { driver: { driver_id: 'drv' }, job: null } } });
    const { result } = renderHook(() => useCurrentJob(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/v1/drivers/me/current-job');
    expect(result.current.data?.job).toBeNull();
  });

  it('sends start, pickup, deliver and report-issue with the Idempotency-Key header', async () => {
    post.mockResolvedValue({ data: { data: {} } });
    const start = renderHook(() => useStartTrip(), { wrapper }).result;
    const pickup = renderHook(() => useConfirmPickup(), { wrapper }).result;
    const deliver = renderHook(() => useConfirmDelivery(), { wrapper }).result;
    const issue = renderHook(() => useReportIssue(), { wrapper }).result;

    await act(async () => {
      await start.current.mutateAsync({ deliveryId: 'dlv_1', idempotencyKey: 'k-start' });
      await pickup.current.mutateAsync({ deliveryId: 'dlv_1', idempotencyKey: 'k-pick', confirmed_quantity_kg: 35 });
      await deliver.current.mutateAsync({
        deliveryId: 'dlv_1', idempotencyKey: 'k-del', quantity_handed_over: 33.5, condition: 'GOOD', recipient_confirmation: true,
      });
      await issue.current.mutateAsync({ deliveryId: 'dlv_1', idempotencyKey: 'k-issue', reason: 'Flat tyre' });
    });

    expect(post.mock.calls).toEqual([
      ['/api/v1/deliveries/dlv_1/start', undefined, { headers: { 'Idempotency-Key': 'k-start' } }],
      ['/api/v1/deliveries/dlv_1/pickup', { confirmed_quantity_kg: 35 }, { headers: { 'Idempotency-Key': 'k-pick' } }],
      ['/api/v1/deliveries/dlv_1/deliver', { quantity_handed_over: 33.5, condition: 'GOOD', recipient_confirmation: true },
        { headers: { 'Idempotency-Key': 'k-del' } }],
      ['/api/v1/deliveries/dlv_1/report-issue', { reason: 'Flat tyre' }, { headers: { 'Idempotency-Key': 'k-issue' } }],
    ]);
  });

  it('reuses one key when an action is retried, and makes a new one after reset', async () => {
    post.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: { data: {} } });
    const { result } = renderHook(() => ({ key: useActionKey(), pickup: useConfirmPickup() }), { wrapper });
    const first = result.current.key.key;

    await act(async () => {
      await result.current.pickup
        .mutateAsync({ deliveryId: 'dlv_1', idempotencyKey: result.current.key.key, confirmed_quantity_kg: 35 })
        .catch(() => undefined);
    });
    expect(result.current.key.key).toBe(first); // a rerender keeps the key
    await act(async () => {
      await result.current.pickup.mutateAsync({ deliveryId: 'dlv_1', idempotencyKey: result.current.key.key, confirmed_quantity_kg: 35 });
    });
    const keys = post.mock.calls.map((call) => call[2].headers['Idempotency-Key']);
    expect(keys).toEqual([first, first]);

    act(() => result.current.key.reset());
    expect(result.current.key.key).not.toBe(first);
  });

  it('sends the current position when going online, none when going offline', async () => {
    patch.mockResolvedValue({ data: { data: {} } });
    const { result } = renderHook(() => useSetAvailability(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ availability_status: 'AVAILABLE', location: { latitude: 12.9, longitude: 77.6 } });
      await result.current.mutateAsync({ availability_status: 'OFFLINE', location: null });
    });
    expect(patch.mock.calls).toEqual([
      ['/api/v1/drivers/me/availability', { availability_status: 'AVAILABLE', latitude: 12.9, longitude: 77.6 }],
      ['/api/v1/drivers/me/availability', { availability_status: 'OFFLINE' }],
    ]);
  });

  it('reads backend error messages from either envelope shape', () => {
    expect(apiErrorMessage({ response: { data: { detail: { error: { message: 'Not yours' } } } } })).toBe('Not yours');
    expect(apiErrorMessage({ response: { data: { error: { message: 'Bad' } } } })).toBe('Bad');
    expect(apiErrorMessage(new Error('x'), 'fallback')).toBe('fallback');
  });
});
