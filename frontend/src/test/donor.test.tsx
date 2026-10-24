import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/donor/StatusBadge';
import { describe, it, expect } from 'vitest';
import { DonationStatus } from '../types/api';

describe('StatusBadge', () => {
  it('renders AVAILABLE status with correct classes', () => {
    render(<StatusBadge status={'AVAILABLE' as DonationStatus} />);
    const badge = screen.getByText('Available');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-success');
  });

  it('replaces underscores with spaces', () => {
    render(<StatusBadge status={'DRIVER_ASSIGNED' as DonationStatus} />);
    const badge = screen.getByText('Driver Assigned');
    expect(badge).toBeInTheDocument();
  });
});
