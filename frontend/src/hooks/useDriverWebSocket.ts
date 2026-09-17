/**
 * Driver WebSocket subscription (Person 5): /ws/deliveries and /ws/drivers.
 *
 * The backend names events under the key `event` (older frontend types use
 * `type`; both are read). Anything about this driver or their current delivery
 * invalidates the current-job query. The driver's own location echoes are
 * ignored, otherwise the job would refetch every 5 s.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './useAuthStore';
import { CURRENT_JOB_KEY } from './useDriver';

const API_WS_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';
const CHANNELS = ['deliveries', 'drivers'] as const;
const RECONNECT_MS = 3_000;

export interface DriverSocketEvent {
  event?: string;
  type?: string;
  driver_id?: string;
  delivery_id?: string;
  id?: string; // delivery.driver_assigned carries the delivery view, keyed `id`
}

export function eventName(message: DriverSocketEvent): string | undefined {
  return message.event ?? message.type;
}

export function shouldRefreshJob(
  message: DriverSocketEvent,
  driverId: string | undefined,
  currentDeliveryId: string | undefined,
): boolean {
  const name = eventName(message);
  if (!name || name.endsWith('location_update')) return false;
  if (driverId && message.driver_id === driverId) return true;
  const deliveryId = message.delivery_id ?? message.id;
  return !!currentDeliveryId && deliveryId === currentDeliveryId;
}

export function useDriverWebSocket(currentDeliveryId: string | undefined) {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let closed = false;
    const sockets: WebSocket[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const connect = (channel: (typeof CHANNELS)[number]) => {
      const socket = new WebSocket(`${API_WS_URL}/ws/${channel}?token=${accessToken}`);
      sockets.push(socket);
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data) as DriverSocketEvent;
          if (shouldRefreshJob(data, user?.id, currentDeliveryId)) {
            void queryClient.invalidateQueries({ queryKey: CURRENT_JOB_KEY });
          }
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        if (!closed) timers.push(setTimeout(() => connect(channel), RECONNECT_MS));
      };
    };

    CHANNELS.forEach(connect);
    return () => {
      closed = true;
      timers.forEach(clearTimeout);
      sockets.forEach((s) => s.close());
    };
  }, [accessToken, isAuthenticated, user?.id, currentDeliveryId, queryClient]);
}
