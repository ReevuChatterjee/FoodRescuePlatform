import { useEffect, useRef } from 'react';
import { useAuthStore } from './useAuthStore';
import { useQueryClient } from '@tanstack/react-query';

// In production, set VITE_WS_BASE_URL to the backend origin.
const API_WS_URL = import.meta.env.VITE_WS_BASE_URL || (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
const RECONNECT_MS = 3_000;

export function useDonationWebSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!isAuthenticated || !accessToken) return;

    let wsDonations: WebSocket | null = null;
    let wsDeliveries: WebSocket | null = null;
    let donTimer: any = null;
    let delTimer: any = null;

    const connectDonations = () => {
      if (!isMounted.current) return;
      try {
        const wsUrl = `${API_WS_URL}/ws/donations?token=${accessToken}`;
        wsDonations = new WebSocket(wsUrl);

        wsDonations.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventName = data.event || data.type;
            if (!eventName) return;

            // Optimistically update NGO available capacity if payload includes it
            if (typeof data.available_capacity_kg === 'number') {
              queryClient.setQueryData(['ngo', 'profile'], (old: any) => {
                if (!old) return old;
                return { ...old, available_capacity_kg: data.available_capacity_kg };
              });
            }

            // Invalidate all related live numerical counters
            queryClient.invalidateQueries({ queryKey: ['donations'] });
            queryClient.invalidateQueries({ queryKey: ['ngo', 'profile'] });
            queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
            queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['analytics'] });

            if (data.donation_id) {
              queryClient.invalidateQueries({ queryKey: ['donation', data.donation_id] });
            }
          } catch (err) {
            console.error('Failed to parse WS donation message', err);
          }
        };

        wsDonations.onclose = () => {
          if (isMounted.current) {
            donTimer = setTimeout(connectDonations, RECONNECT_MS);
          }
        };

        wsDonations.onerror = () => {
          wsDonations?.close();
        };
      } catch (e) {
        if (isMounted.current) {
          donTimer = setTimeout(connectDonations, RECONNECT_MS);
        }
      }
    };

    const connectDeliveries = () => {
      if (!isMounted.current) return;
      try {
        const wsUrl = `${API_WS_URL}/ws/deliveries?token=${accessToken}`;
        wsDeliveries = new WebSocket(wsUrl);

        wsDeliveries.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventName = data.event || data.type;
            if (!eventName) return;

            if (eventName === 'delivery.location_update') {
              queryClient.setQueryData(['driver_location', data.driver_id], {
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: data.timestamp,
              });
              return;
            }

            // Optimistically update NGO available capacity if payload includes it
            if (typeof data.available_capacity_kg === 'number') {
              queryClient.setQueryData(['ngo', 'profile'], (old: any) => {
                if (!old) return old;
                return { ...old, available_capacity_kg: data.available_capacity_kg };
              });
            }

            // Invalidate all relevant numerical queries across donor, NGO, driver and admin
            queryClient.invalidateQueries({ queryKey: ['donations'] });
            queryClient.invalidateQueries({ queryKey: ['ngo', 'profile'] });
            queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
            queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['driver', 'job'] });
            queryClient.invalidateQueries({ queryKey: ['driver', 'deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['analytics'] });

            if (data.delivery_id) {
              queryClient.invalidateQueries({ queryKey: ['delivery', data.delivery_id] });
            }
            if (data.donation_id) {
              queryClient.invalidateQueries({ queryKey: ['donation', data.donation_id] });
            }
          } catch (err) {
            console.error('Failed to parse WS delivery message', err);
          }
        };

        wsDeliveries.onclose = () => {
          if (isMounted.current) {
            delTimer = setTimeout(connectDeliveries, RECONNECT_MS);
          }
        };

        wsDeliveries.onerror = () => {
          wsDeliveries?.close();
        };
      } catch (e) {
        if (isMounted.current) {
          delTimer = setTimeout(connectDeliveries, RECONNECT_MS);
        }
      }
    };

    connectDonations();
    connectDeliveries();

    return () => {
      isMounted.current = false;
      clearTimeout(donTimer);
      clearTimeout(delTimer);
      wsDonations?.close();
      wsDeliveries?.close();
    };
  }, [accessToken, isAuthenticated, queryClient]);
}
