import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldSend, useDriverLocation } from './useDriverLocation';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../api/client', () => ({ apiClient: { post } }));

type Success = (pos: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (err: { code: number; PERMISSION_DENIED: number }) => void;

let onPosition: Success | undefined;
let onError: Failure | undefined;

function installGeolocation() {
  const geolocation = {
    watchPosition: vi.fn((success: Success, failure: Failure) => {
      onPosition = success;
      onError = failure;
      return 7;
    }),
    clearWatch: vi.fn(),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  return geolocation;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('shouldSend', () => {
  it('allows the first send and then one per 5 s', () => {
    expect(shouldSend(null, 1_000)).toBe(true);
    expect(shouldSend(1_000, 5_999)).toBe(false);
    expect(shouldSend(1_000, 6_000)).toBe(true);
  });
});

describe('useDriverLocation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    post.mockReset();
    onPosition = undefined;
    onError = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams the latest fix at most every 5 seconds while enabled', async () => {
    installGeolocation();
    post.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useDriverLocation(true));

    act(() => onPosition?.({ coords: { latitude: 12.93, longitude: 77.62 } }));
    expect(result.current.permission).toBe('granted');

    for (let second = 0; second < 11; second += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      await flush();
    }
    // Sent at ~1 s, ~6 s and ~11 s: never faster than one per 5 s.
    expect(post.mock.calls.length).toBe(3);
    expect(post).toHaveBeenLastCalledWith('/api/v1/drivers/location', { latitude: 12.93, longitude: 77.62 });
  });

  it('treats 429 as a skipped beat, not an error', async () => {
    installGeolocation();
    post.mockRejectedValue({ response: { status: 429 } });
    const { result } = renderHook(() => useDriverLocation(true));
    act(() => onPosition?.({ coords: { latitude: 12.93, longitude: 77.62 } }));
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    await flush();
    expect(post).toHaveBeenCalled();
    expect(result.current.lastError).toBeNull();
    expect(result.current.lastSentAt).toBeNull();
  });

  it('does not send while disabled (offline, no job)', async () => {
    installGeolocation();
    renderHook(() => useDriverLocation(false));
    act(() => onPosition?.({ coords: { latitude: 12.93, longitude: 77.62 } }));
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('reports denied permission', () => {
    installGeolocation();
    const { result } = renderHook(() => useDriverLocation(true));
    act(() => onError?.({ code: 1, PERMISSION_DENIED: 1 }));
    expect(result.current.permission).toBe('denied');
  });

  it('stops watching on unmount', () => {
    const geolocation = installGeolocation();
    const { unmount } = renderHook(() => useDriverLocation(true));
    unmount();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
  });
});
