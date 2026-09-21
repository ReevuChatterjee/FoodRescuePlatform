import { useEffect, useRef } from 'react';
import { useAuthStore } from './useAuthStore';
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketEvent } from '../types/api';

// In production, set VITE_WS_BASE_URL to the backend origin.
const API_WS_URL = import.meta.env.VITE_WS_BASE_URL || (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

export function useDonationWebSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const wsDonations = useRef<WebSocket | null>(null);
  const wsDeliveries = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Connect to /ws/donations
    const wsDonationsUrl = `${API_WS_URL}/ws/donations?token=${accessToken}`;
    wsDonations.current = new WebSocket(wsDonationsUrl);

    wsDonations.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;
        if (data.type === 'donation.status_changed') {
          // Invalidate queries to refresh the list and detail views
          queryClient.invalidateQueries({ queryKey: ['donations'] });
          queryClient.invalidateQueries({ queryKey: ['donation', data.donation_id] });
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    // Connect to /ws/deliveries
    const wsDeliveriesUrl = `${API_WS_URL}/ws/deliveries?token=${accessToken}`;
    wsDeliveries.current = new WebSocket(wsDeliveriesUrl);

    wsDeliveries.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;
        if (data.type === 'delivery.status_changed') {
          queryClient.invalidateQueries({ queryKey: ['donations'] });
          queryClient.invalidateQueries({ queryKey: ['delivery', data.delivery_id] });
        } else if (data.type === 'delivery.location_update') {
           // Optionally invalidate or just update cache for location
           // queryClient.invalidateQueries({ queryKey: ['driver_location', data.driver_id] });
           queryClient.setQueryData(['driver_location', data.driver_id], {
             latitude: data.latitude,
             longitude: data.longitude,
             timestamp: data.timestamp
           });
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    return () => {
      wsDonations.current?.close();
      wsDeliveries.current?.close();
    };
  }, [accessToken, isAuthenticated, queryClient]);
}
