/**
 * TypeScript types matching the frozen API contract.
 *
 * These types mirror the exact JSON shapes in contracts/openapi-frozen.json.
 * Any change to these types requires a PR against the frozen contract per [orig §51].
 */

// ============================================================================
// Envelopes (all responses use these)
// ============================================================================

export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    request_id: string;
    next_cursor?: string;
    has_more?: boolean;
  };
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    field: string | null;
    request_id: string;
  };
}

// ============================================================================
// Analytics responses
// ============================================================================

export interface AnalyticsOverview {
  total_donations: number;
  total_food_rescued_kg: number;
  active_donations: number;
  active_deliveries: number;
  registered_ngos: number;
  registered_donors: number;
  available_drivers: number;
}

export interface FoodMetrics {
  kg_diverted: number;
  meals_recovered: number;
}

export interface LogisticsMetrics {
  delivery_success_rate: number; // 0–1, not percentage
  avg_matching_time_sec: number;
  avg_delivery_time_min: number;
  route_distance_saved_km: number;
}

export interface SocialMetrics {
  organisations_served: number;
  beneficiaries_reached: number; // ESTIMATE — see API docs
}

// ============================================================================
// Admin responses
// ============================================================================

export interface NGOVerificationResult {
  ngo_id: string;
  verification_status: 'APPROVED' | 'REJECTED';
  reason: string;
  verified_by: string;
  verified_at: string; // ISO-8601 UTC
}

export interface VerifyNGORequest {
  status: 'APPROVED' | 'REJECTED';
  reason: string;
}

// ============================================================================
// NGO models (for verification queue)
// ============================================================================

export interface NGO {
  id: string;
  organisation_name: string;
  address: string;
  storage_capacity_kg: number;
  available_capacity_kg: number;
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export type DemandPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NGOProfile extends NGO {
  location: string;
  operating_start: string;
  operating_end: string;
}

export interface NGODemand {
  id: number;
  food_category: string;
  required_quantity_kg: number;
  priority: DemandPriority;
  valid_until: string;
  updated_at: string;
}

export interface IncomingDonation {
  id: string;
  food_name: string;
  food_category: string;
  quantity_kg: number;
  available_from: string;
  expiry_time: string;
  pickup_location: string;
  special_requirements: string | null;
  status: 'MATCHED';
}

export interface NGOVerificationDocument {
  document_type: string;
  file_url: string;
  uploaded_at: string;
}

// ============================================================================
// Donation models (for admin dashboard tables)
// ============================================================================

export type DonationStatus =
  | 'AVAILABLE'
  | 'MATCHING'
  | 'MATCHED'
  | 'ACCEPTED'
  | 'DRIVER_ASSIGNED'
  | 'PICKUP_STARTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'NO_MATCH_FOUND'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DRIVER_ISSUE';

export interface Donation {
  id: string;
  food_name: string;
  food_category: string;
  quantity_kg: number;
  expiry_time: string;
  pickup_location: { latitude: number; longitude: number; address: string };
  status: DonationStatus;
  matched_ngo_id: string | null;
  driver_id: string | null;
  eta_minutes: number | null;
  created_at: string;
}

// ============================================================================
// Delivery models
// ============================================================================

export type DeliveryStatus =
  | 'DRIVER_ASSIGNED'
  | 'PICKUP_STARTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'CANCELLED'
  | 'DRIVER_ISSUE';

export interface Delivery {
  id: string;
  donation_id: string;
  ngo_id: string;
  driver_id: string;
  status: DeliveryStatus;
  route_distance_km: number | null;
  actual_pickup_time: string | null;
  actual_delivery_time: string | null;
}

// ============================================================================
// WebSocket event types (Section D)
// ============================================================================

export interface DonationStatusUpdateEvent {
  type: 'donation.status_changed';
  donation_id: string;
  old_status: DonationStatus;
  new_status: DonationStatus;
  timestamp: string;
}

export interface DeliveryStatusUpdateEvent {
  type: 'delivery.status_changed';
  delivery_id: string;
  status: DeliveryStatus;
  timestamp: string;
}

export interface DriverLocationUpdateEvent {
  type: 'delivery.location_update';
  delivery_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface NGOVerificationUpdateEvent {
  type: 'ngo.verification_status_changed';
  ngo_id: string;
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export type WebSocketEvent =
  | DonationStatusUpdateEvent
  | DeliveryStatusUpdateEvent
  | DriverLocationUpdateEvent
  | NGOVerificationUpdateEvent;
