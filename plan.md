# Implementation Plan

## Proposed Changes

### Backend
#### [MODIFY] `backend/app/dispatch/router.py`
Add a new endpoint `GET /api/v1/drivers/me/deliveries` that returns a list of the driver's deliveries, joined with `Donation` and `NGO` tables to provide context.

### Frontend
#### [MODIFY] `frontend/src/hooks/useDriver.ts`
Add a `useDriverDeliveries(category: 'active' | 'history')` hook using React Query to fetch the new endpoint.

#### [MODIFY] `frontend/src/pages/driver/DriverDeliveries.tsx`
Fetch active deliveries and render them in a list instead of showing a hardcoded empty state.

#### [MODIFY] `frontend/src/pages/driver/DriverHistory.tsx`
Fetch historical deliveries (completed/cancelled) and render them in a list instead of showing a hardcoded empty state.

