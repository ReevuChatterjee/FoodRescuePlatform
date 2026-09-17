import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentJob, DriverJob } from '../../hooks/useDriver';
import { DriverDashboard } from './DriverDashboard';

const { get, post, patch, location } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  location: { permission: 'granted', position: { latitude: 12.936, longitude: 77.625 }, lastSentAt: null, lastError: null },
}));

vi.mock('../../api/client', () => ({ apiClient: { get, post, patch } }));
vi.mock('../../components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../../components/driver/DriverRouteMap', () => ({ DriverRouteMap: () => <div data-testid="route-map" /> }));
vi.mock('../../hooks/useDriverLocation', () => ({ useDriverLocation: () => location }));
vi.mock('../../hooks/useDriverWebSocket', () => ({ useDriverWebSocket: vi.fn() }));

const driver = { driver_id: 'drv_a', vehicle_id: 'veh', capacity_kg: 60, availability_status: 'BUSY' as const, current_location: null };

function makeJob(overrides: Partial<DriverJob> = {}): DriverJob {
  return {
    delivery_id: 'dlv_1', donation_id: 'don_1', status: 'DRIVER_ASSIGNED', next_stop: 'PICKUP',
    food_name: 'Vegetable Rice', food_category: 'COOKED', quantity_kg: 35,
    special_handling: 'Keep refrigerated below 5°C',
    food_safety_info: { storage_temp_required: 'REFRIGERATED', allergen_tags: ['dairy'], packaging_type: 'SEALED_CONTAINER' },
    priority: 'HIGH', remaining_shelf_life_min: 95,
    pickup: { latitude: 12.9352, longitude: 77.6245, address: '12, MG Road', organisation_name: 'Test Kitchen' },
    dropoff: { latitude: 12.9345, longitude: 77.6104, ngo_id: 'ngo_1', organisation_name: 'Food Bank A', address: 'HSR', operating_hours: { start: '08:00', end: '20:00' } },
    route_to_next_stop: {
      distance_km: 1.2, duration_minutes: 6.4, geometry: '', traffic_aware: false, traffic_source: 'time_of_day_model',
      free_flow_duration_minutes: 2.5, provider: 'heuristic', departure_time: '2026-09-17T06:30:00Z',
    },
    timeline: {
      now: '2026-09-17T06:30:00Z', available_from: '2026-09-17T06:00:00Z',
      expiry_time: new Date(Date.now() + 95 * 60_000).toISOString(),
      estimated_pickup_time: null, estimated_delivery_time: null, actual_pickup_time: null, slack_minutes: 62.5,
    },
    ...overrides,
  };
}

function renderWith(data: CurrentJob) {
  get.mockResolvedValue({ data: { data } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><DriverDashboard /></QueryClientProvider>);
}

describe('DriverDashboard', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    location.permission = 'granted';
    let n = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `key-${++n}` });
  });

  it('shows the current job: next stop, priority, shelf life, slack, handling and safety info', async () => {
    renderWith({ driver, job: makeJob() });
    expect(await screen.findByText('Test Kitchen')).toBeInTheDocument();
    expect(screen.getByText(/Next stop · Pickup/)).toBeInTheDocument();
    expect(screen.getByTestId('priority-badge')).toHaveTextContent('HIGH');
    expect(screen.getByText('Keep refrigerated below 5°C')).toBeInTheDocument();
    expect(screen.getByText('Allergen: dairy')).toBeInTheDocument();
    expect(screen.getByText('1 h 03 min')).toBeInTheDocument(); // slack 62.5 min
    expect(screen.getByTestId('route-map')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start trip to pickup/ })).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled(); // can't go offline mid-job
  });

  it('confirms pickup with an idempotency key and refetches the job', async () => {
    post.mockResolvedValue({ data: { data: {} } });
    renderWith({ driver, job: makeJob({ status: 'PICKUP_STARTED' }) });
    fireEvent.click(await screen.findByRole('button', { name: /Confirm pickup/ }));
    fireEvent.change(screen.getByLabelText(/Quantity loaded/), { target: { value: '34.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/api/v1/deliveries/dlv_1/pickup');
    expect(body).toEqual({ confirmed_quantity_kg: 34.5 });
    expect(config.headers['Idempotency-Key']).toMatch(/^key-/);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('blocks a pickup above vehicle capacity', async () => {
    renderWith({ driver, job: makeJob() });
    fireEvent.click(await screen.findByRole('button', { name: /Confirm pickup/ }));
    fireEvent.change(screen.getByLabelText(/Quantity loaded/), { target: { value: '61' } });
    expect(screen.getByRole('button', { name: 'Confirm pickup' })).toBeDisabled();
    expect(screen.getByText(/up to your vehicle's 60.0 kg/)).toBeInTheDocument();
  });

  it('retries a failed delivery with the same key and shows the server message', async () => {
    post
      .mockRejectedValueOnce({ response: { status: 503, data: { detail: { error: { message: 'Server busy' } } } } })
      .mockResolvedValueOnce({ data: { data: {} } });
    renderWith({ driver, job: makeJob({ status: 'IN_TRANSIT', next_stop: 'DROPOFF' }) });

    fireEvent.click(await screen.findByRole('button', { name: /Confirm delivery/ }));
    expect(screen.queryByRole('button', { name: /Report an issue/ })).not.toBeInTheDocument(); // after pickup
    fireEvent.change(screen.getByLabelText(/Quantity handed over/), { target: { value: '28' } });
    expect(screen.getByText(/recorded as a partial delivery/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delivery' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server busy');
    fireEvent.click(screen.getByRole('button', { name: /Try again: confirm delivery/ }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));

    const [first, second] = post.mock.calls;
    expect(first[1]).toEqual({ quantity_handed_over: 28, condition: 'GOOD', recipient_confirmation: true });
    expect(second[2].headers['Idempotency-Key']).toBe(first[2].headers['Idempotency-Key']);
  });

  it('requires recipient confirmation before delivery can be sent', async () => {
    renderWith({ driver, job: makeJob({ status: 'PICKED_UP', next_stop: 'DROPOFF' }) });
    fireEvent.click(await screen.findByRole('button', { name: /Confirm delivery/ }));
    expect(screen.getByRole('button', { name: 'Confirm delivery' })).toBeDisabled();
  });

  it('reports an issue before pickup', async () => {
    post.mockResolvedValue({ data: { data: {} } });
    renderWith({ driver, job: makeJob() });
    fireEvent.click(await screen.findByRole('button', { name: /Report an issue/ }));
    fireEvent.change(screen.getByPlaceholderText(/Flat tyre/), { target: { value: 'Flat tyre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Report issue' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/api/v1/deliveries/dlv_1/report-issue');
    expect(post.mock.calls[0][1]).toEqual({ reason: 'Flat tyre' });
  });

  it('goes online with the current position when idle', async () => {
    patch.mockResolvedValue({ data: { data: {} } });
    renderWith({ driver: { ...driver, availability_status: 'OFFLINE' }, job: null });
    expect(await screen.findByText('You are offline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/v1/drivers/me/availability', {
      availability_status: 'AVAILABLE', latitude: 12.936, longitude: 77.625,
    }));
  });

  it('tells the driver they cannot be dispatched without location', async () => {
    location.permission = 'denied';
    renderWith({ driver: { ...driver, availability_status: 'AVAILABLE' }, job: null });
    expect(await screen.findByText('Location is off')).toBeInTheDocument();
    expect(screen.getByText(/can't be dispatched without location/)).toBeInTheDocument();
  });
});
