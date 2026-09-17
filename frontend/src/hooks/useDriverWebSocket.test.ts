import { describe, expect, it } from 'vitest';
import { eventName, shouldRefreshJob } from './useDriverWebSocket';

describe('driver websocket events', () => {
  it('reads the backend `event` key and falls back to `type`', () => {
    expect(eventName({ event: 'delivery.status_changed' })).toBe('delivery.status_changed');
    expect(eventName({ type: 'delivery.status_changed' })).toBe('delivery.status_changed');
  });

  it("refreshes the job for this driver's assignment, status and issue events", () => {
    expect(shouldRefreshJob({ event: 'delivery.driver_assigned', driver_id: 'drv_a', id: 'dlv_1' }, 'drv_a', undefined)).toBe(true);
    expect(shouldRefreshJob({ event: 'driver.status_changed', driver_id: 'drv_a' }, 'drv_a', undefined)).toBe(true);
    expect(shouldRefreshJob({ event: 'delivery.status_changed', delivery_id: 'dlv_1' }, 'drv_a', 'dlv_1')).toBe(true);
  });

  it('ignores other drivers, location echoes and nameless frames', () => {
    expect(shouldRefreshJob({ event: 'delivery.driver_assigned', driver_id: 'drv_b', id: 'dlv_9' }, 'drv_a', 'dlv_1')).toBe(false);
    expect(shouldRefreshJob({ event: 'delivery.location_update', driver_id: 'drv_a', delivery_id: 'dlv_1' }, 'drv_a', 'dlv_1')).toBe(false);
    expect(shouldRefreshJob({ event: 'driver.location_update', driver_id: 'drv_a' }, 'drv_a', undefined)).toBe(false);
    expect(shouldRefreshJob({ driver_id: 'drv_a' }, 'drv_a', undefined)).toBe(false);
  });
});
