import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './client';
import donationsMock from './mockData/donations_mock.json';

const mock = new MockAdapter(apiClient, { delayResponse: 500 });

console.log('Mock API enabled');

// Allow auth requests to pass through to the real backend (or mock them if needed)
// For now, we want to mock /api/v1/donations
mock.onGet('/api/v1/donations').reply(() => {
  return [200, {
    data: donationsMock,
    meta: { request_id: 'mock-req-123' }
  }];
});

mock.onGet(/\/api\/v1\/donations\/don_mock\d+/).reply((config) => {
  const id = config.url?.split('/').pop();
  const donation = donationsMock.find(d => d.id === id);
  if (donation) {
    return [200, {
      data: donation,
      meta: { request_id: 'mock-req-123' }
    }];
  }
  return [404, {
    error: {
      code: 'DONATION_NOT_FOUND',
      message: 'Donation not found',
      field: null,
      request_id: 'mock-req-123'
    }
  }];
});

mock.onPost('/api/v1/donations').reply((config) => {
  const body = JSON.parse(config.data);
  const newDonation = {
    id: `don_mock_new_${Date.now()}`,
    donor_id: 'don_org_1',
    food_name: body.food_name,
    food_category: body.food_category,
    quantity_kg: body.quantity_kg,
    prepared_at: body.prepared_at,
    available_from: body.available_from,
    expiry_time: body.expiry_time,
    pickup_location: body.pickup_location,
    special_handling: body.special_handling,
    food_safety_info: body.food_safety_info,
    status: 'AVAILABLE',
    matched_ngo_id: null,
    match_score: null,
    weights_version_id: null,
    driver_id: null,
    eta_minutes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Also push it to the mock array to simulate state update if necessary
  // donationsMock.unshift(newDonation);
  
  return [201, {
    data: newDonation,
    meta: { request_id: 'mock-req-123' }
  }];
});

mock.onPatch(/\/api\/v1\/donations\/.*\/cancel/).reply((config) => {
  const id = config.url?.split('/')[4];
  const donation = donationsMock.find(d => d.id === id);
  if (donation) {
    // Return a mocked canceled version
    const updated = { ...donation, status: 'CANCELLED', updated_at: new Date().toISOString() };
    return [200, {
      data: updated,
      meta: { request_id: 'mock-req-123' }
    }];
  }
  return [404, { error: { code: 'NOT_FOUND', message: 'Not found' } }];
});

mock.onPost(/\/api\/v1\/donations\/.*\/photos/).reply((config) => {
  return [201, {
    data: {
      donation_id: config.url?.split('/')[4],
      filename: 'mock_photo.jpg',
      stored_at: 'mock/path/mock_photo.jpg'
    },
    meta: { request_id: 'mock-req-123' }
  }];
});

// Pass through all other requests to the real backend
mock.onAny().passThrough();

export default mock;
