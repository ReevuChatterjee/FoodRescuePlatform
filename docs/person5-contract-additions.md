# Person 5 contract proposal (for the §8 PR)

**Proposed by:** Person 5 (Routing + Driver). **Branch:** `arjun`.
**Scope:** additive only. No existing request or response field is removed, renamed, or given a new meaning. The frozen contract PDF and `contracts/openapi-frozen.json` are **not** edited by this branch; if accepted, the PDF and OpenAPI file are updated in the §8 PR with the changelog entry at the end.

This document has three parts:

- **Part A: Person 5 additions.** New endpoints, new fields and new events that Person 5 owns. Needs sign-off from the consumers listed.
- **Part B: Fixes and hooks in other modules.** Changes this branch makes in files owned by other people, **for the owners to review**.
- **Part C: Issues found in other modules.** Observed but deliberately not changed.

All paths are under `/api/v1`, use Bearer JWT, and return the standard envelopes. Timestamps are UTC ISO-8601 with `Z`; weights are kg floats with 1 decimal.

---

## Part A: Person 5 additions

### A1. `POST /routes/calculate`: request body and additive response fields

**Consumers:** Person 4 (in-process via `app.routing.service`), Persons 2/3 (maps), Person 5 driver app.

The contract fixes the response but not the request. Proposed request:

```json
{
  "origin": { "latitude": 12.9352, "longitude": 77.6245 },
  "destination": { "latitude": 12.9345, "longitude": 77.6104 },
  "departure_time": "2026-09-09T12:00:00Z"
}
```

`departure_time` is optional and defaults to now; it drives the congestion estimate. Coordinates out of range return 422. Auth: any role.

Response. The contract fields are unchanged in name **and meaning**; everything after `traffic_aware` is additive:

```json
{
  "data": {
    "distance_km": 5.4,
    "duration_minutes": 21.0,
    "geometry": "encoded_polyline",
    "traffic_aware": false,
    "traffic_source": "time_of_day_model",
    "free_flow_duration_minutes": 11.2,
    "provider": "heuristic",
    "departure_time": "2026-09-09T12:00:00Z"
  },
  "meta": { "request_id": "..." }
}
```

| Field | Status | Meaning |
|---|---|---|
| `distance_km` | contract | Road (or estimated road) distance, 1 dp |
| `duration_minutes` | contract | **ETA including congestion**, 1 dp |
| `geometry` | contract | Google encoded polyline, precision 5 |
| `traffic_aware` | contract | `true` only when live traffic data produced the ETA (TomTom) |
| `traffic_source` | **new** | `live` \| `time_of_day_model` \| `city_average_model` \| `none`. How the congestion in `duration_minutes` was obtained; `none` means free-flow (no congestion applied). Consumers must not add their own congestion on top. |
| `free_flow_duration_minutes` | **new** | ETA without congestion, 1 dp |
| `provider` | **new** | `heuristic` \| `osrm` \| `tomtom`: the engine that actually produced this estimate (after any fallback). `heuristic` geometry is a straight line, not a road. |
| `departure_time` | **new** | The departure the estimate was computed for |

### A2. New endpoints

**Consumer:** the Person 5 driver app. The admin trigger is also for Person 6 (demo and ops).

#### `PATCH /drivers/me/availability` (DRIVER)

```json
{ "availability_status": "AVAILABLE", "latitude": 12.9352, "longitude": 77.6245 }
```

- `availability_status` is `AVAILABLE` or `OFFLINE`. `BUSY` is never client-set: dispatch sets it and delivery completion clears it.
- `latitude`/`longitude` are optional but must be sent together; sending them when going online makes the driver dispatchable immediately.
- **Response:** `{driver_id, vehicle_id, capacity_kg, availability_status, current_location: {latitude, longitude} | null}`.
- **Errors:** 404 `DRIVER_PROFILE_NOT_FOUND`; 409 `ACTIVE_DELIVERY_IN_PROGRESS`; 422 validation.
- **Side effect:** going `AVAILABLE` retries pending dispatch.

#### `GET /drivers/me/current-job` (DRIVER)

```json
{
  "driver": { "driver_id": "...", "vehicle_id": "...", "capacity_kg": 60.0, "availability_status": "BUSY", "current_location": { "latitude": 12.936, "longitude": 77.625 } },
  "job": {
    "delivery_id": "dlv_…", "donation_id": "don_…", "status": "DRIVER_ASSIGNED", "next_stop": "PICKUP",
    "food_name": "Vegetable Rice", "food_category": "COOKED", "quantity_kg": 35.0,
    "special_handling": "Keep refrigerated below 5°C",
    "food_safety_info": { "storage_temp_required": "REFRIGERATED", "allergen_tags": ["dairy"], "packaging_type": "SEALED_CONTAINER" },
    "priority": "MEDIUM", "remaining_shelf_life_min": 176,
    "pickup":  { "latitude": 12.9352, "longitude": 77.6245, "address": "12, MG Road", "organisation_name": "…" },
    "dropoff": { "latitude": 12.9345, "longitude": 77.6104, "ngo_id": "ngo_017", "organisation_name": "…", "address": "…", "operating_hours": { "start": "08:00", "end": "20:00" } },
    "route_to_next_stop": { "…": "same shape as POST /routes/calculate data" },
    "timeline": { "now": "…Z", "available_from": "…Z", "expiry_time": "…Z", "estimated_pickup_time": "…Z", "estimated_delivery_time": "…Z", "actual_pickup_time": null, "slack_minutes": 142.5 },
    "planned": { "…": "same shape as GET /deliveries/{id}" }
  }
}
```

- `job` is `null` when the driver has no active delivery.
- `priority` follows §9: `LOW` >4 h, `MEDIUM` 2–4 h, `HIGH` 1–2 h, `CRITICAL` <1 h, `EXPIRED`.
- **Errors:** 404 `DRIVER_PROFILE_NOT_FOUND`.

#### `POST /deliveries/{id}/start` (DRIVER, own delivery, `Idempotency-Key` required)

- No body. `DRIVER_ASSIGNED` → `PICKUP_STARTED`; this is optional, because pickup may be confirmed directly.
- **Response:** same shape as `GET /deliveries/{id}`.
- **Errors:** 400 `MISSING_IDEMPOTENCY_KEY`, 403 `FORBIDDEN`, 404 `DELIVERY_NOT_FOUND`, 409 `INVALID_DELIVERY_STATUS`.

#### `POST /deliveries/{id}/report-issue` (DRIVER, own delivery, `Idempotency-Key` required)

```json
{ "reason": "Flat tyre" }
```

- `reason` is 3–200 characters. Only allowed before pickup (`DRIVER_ASSIGNED` or `PICKUP_STARTED`).
- **Effect:** delivery and donation → `DRIVER_ISSUE`, the reporting driver → `OFFLINE`, then dispatch reassigns the **same delivery row** to the next feasible driver for the **same NGO** (lifecycle §7.3).
- **Response:** same shape as `GET /deliveries/{id}`.
- **Errors:** as for start; 409 after pickup.

#### `POST /dispatch/{donation_id}` (ADMIN)

Runs dispatch now, for retries and demos.

```json
{ "donation_id": "don_…", "status": "ASSIGNED", "reason": null, "delivery": { "…": "GET /deliveries/{id} shape" }, "eta_to_pickup_minutes": 7, "driver_rejections": { "drv_…": "INSUFFICIENT_VEHICLE_CAPACITY" } }
```

- `status` is one of `ASSIGNED`, `ALREADY_ASSIGNED`, `PENDING`, `NOT_DISPATCHABLE`.
- `reason` is set for `PENDING` (`NO_AVAILABLE_DRIVER`, `NO_FEASIBLE_DRIVER`) and `NOT_DISPATCHABLE` (e.g. `DONATION_EXPIRED`, `DONATION_STATUS_…`).
- Rejection reasons: `DRIVER_NOT_AVAILABLE`, `INSUFFICIENT_VEHICLE_CAPACITY`, `DRIVER_LOCATION_UNKNOWN`, `EXPIRY_NOT_FEASIBLE`.

### A3. Behaviour of existing Person 5 contract endpoints (shapes unchanged)

**`POST /deliveries/{id}/pickup` and `/deliver`**
- Request and response shapes are unchanged.
- **New error cases:**
  - 409 `INVALID_DELIVERY_STATUS` (pickup only from `DRIVER_ASSIGNED`/`PICKUP_STARTED`; deliver only from `PICKED_UP`/`IN_TRANSIT`)
  - 400 `INVALID_QUANTITY` (pickup ≤ 0, deliver < 0)
  - 400 `EXCEEDS_VEHICLE_CAPACITY` (pickup)
- **Idempotency:**
  - The cached response is scoped per delivery and driver, so a retry replays even after reassignment and never crosses drivers.
  - A new key for an action that already happened returns 409.
- **Deliver** sets `DELIVERED` when `quantity_handed_over ≥ quantity_kg`, otherwise **`PARTIALLY_DELIVERED`** (§7.3). This is the same rule `/handover` already applies, so the two sign-offs agree. The contract text "state → DELIVERED" is the full-quantity case.
- **Deliver** frees the driver and retries pending dispatch. A `HandoverRecord` is still created at `/deliver` for Person 3's `/handover`.

**`POST /drivers/location`**
- Request and response are unchanged, and the rate limit is still 1 per 5 s. A new request is accepted 4.5 s after the previous accepted one, so a client sending every 5 s doesn't get spurious 429s from network jitter.
- **New error:** 422 `INVALID_LOCATION` for out-of-range coordinates (not counted against the rate limit).
- **Effects:** `PICKED_UP` → `IN_TRANSIT` once the driver is more than 150 m from the pickup. A first known location of an `AVAILABLE` driver retries pending dispatch.

**`GET /ngos/{id}/incoming` (Person 3's screen)**
- `eta_minutes` (int, with congestion) and `distance_km` (1 dp) are now **filled**, from the heuristic pickup → NGO route departing at `max(now, available_from)`.
- They stay `null` only if a location can't be parsed. The shape is unchanged.

**`GET /donations/{id}` (Person 2's screen)**
- `driver_id` and `eta_minutes` become non-null once dispatch creates the delivery.
- `eta_minutes` is the delivery row's `estimated_duration_min`, the pickup → NGO leg; see C9.

### A4. WebSocket events

**Consumers:** Person 2 (donor tracking), Person 3 (driver ETA once accepted), Person 5 driver app, Person 6.

Every event has `event` (its name) and `timestamp`. Added fields on existing events are additive.

| Channel | Event | Status | Payload |
|---|---|---|---|
| `/ws/deliveries` | `delivery.driver_assigned` | **Named in contract §4; payload defined here** | `GET /deliveries/{id}` fields + `vehicle_id`, `eta_to_pickup_minutes`, `reassigned` |
| `/ws/deliveries` | `delivery.location_update` | Existing, **enriched and narrowed** | `delivery_id`, `donation_id`, `driver_id`, `status`, `next_stop` (`PICKUP`\|`DROPOFF`), `eta_minutes` (heuristic, to the next stop), `latitude`, `longitude`. **Only sent while the driver has an active delivery**; previously it was mirrored for every ping, including available drivers. |
| `/ws/deliveries` | `delivery.status_changed` | Existing, additive fields | `delivery_id`, `status` + `donation_id`, `driver_id` |
| `/ws/deliveries` | `delivery.driver_issue` | **New** | `delivery_id`, `donation_id`, `driver_id`, `reason` |
| `/ws/donations` | `donation.status_changed` | Existing | `donation_id`, `status` (now also emitted for `DRIVER_ASSIGNED` … `PARTIALLY_DELIVERED` and `DRIVER_ISSUE`) |
| `/ws/donations` | `donation.dispatch_pending` | **New** | `donation_id`, `reason` |
| `/ws/drivers` | `driver.location_update` | Existing, additive `timestamp` | `driver_id`, `latitude`, `longitude` |
| `/ws/drivers` | `driver.status_changed` | **New** | `driver_id`, `vehicle_id`, `availability_status` |

### A5. Day-1 fixture

`backend/app/routing/fixtures/sample_coordinates.json` contains 19 Bengaluru places (including the contract's Koramangala pickup and `ngo_017`), 12 origin/destination pairs and 3 driver start points. The coordinates are approximate neighbourhood reference points.

---

## Part B: Fixes and hooks in other modules (for owners to review)

Each change is minimal and marked with a `# Person 5` comment in the code where it's a hook. Commits are on branch `arjun`.

| File | Owner | Change | Why | Commit |
|---|---|---|---|---|
| `backend/alembic/versions/003_matching_engine_tables.py` | Person 4 (migrations: Person 1) | Seed insert uses `TRUE` and `CURRENT_TIMESTAMP` instead of SQLite-only `1` and `datetime('now')` | **Migration 003 failed on Postgres**, which also broke the CI backend job | 2604259 |
| `backend/app/services/matching_service.py` | Person 4 | `load_routes` body calls `routing.service.estimate_routes_from` (signature unchanged) and fills `traffic_duration_minutes` | Replaces the placeholder route mock with Person 5's routing, as its docstring asked | f4266de |
| `backend/app/matching/router.py` `accept_match` | Person 4 | Adds `BackgroundTasks` and schedules `run_dispatch(donation.id)` after the commit (6 lines) | Contract: NGO accepts → Person 5 dispatch | becf819 |
| `backend/app/donations/router.py` `cancel_donation` | Person 1 (consumer: Person 2) | Before its commit, calls `release_for_cancelled_donation` (locks the donation row, cancels a pre-pickup delivery, frees the driver, 409 if picked up meanwhile); publishes after commit; retries pending dispatch | A cancel after assignment left the driver `BUSY` forever | 9e0e015 |
| `backend/app/ngos/router.py` `/incoming` | Person 1 (consumer: Person 3) | Fills `eta_minutes` and `distance_km` via `routing.service.offer_route_summary`; docstring updated | Fields were always `null` pending Person 5 | 23ed011 |
| `backend/app/deliveries/router.py` `pickup`, `deliver` | Person 1 file; endpoints are Person 5 outputs (§6) | Bodies delegate to `dispatch.service` (status guards, capacity, partial delivery, driver release, lock order, per-delivery+driver idempotency, publish after commit). `HandoverRecord` creation and `pickup_confirmed` audit kept; `delivery_confirmed` audit added. `get_delivery` and `handover` untouched. | Real lifecycle instead of unconditional status writes | a5d9dc6, a213516, 07f8a92, e8a44d4 |
| `backend/app/drivers/router.py` `update_location` | Person 1 file; endpoint is a Person 5 output (§6) | Delegates to `dispatch.service.record_driver_location`; 0.5 s grace; monotonic clock. `list_drivers` untouched. | IN_TRANSIT detection, enriched broadcast, dispatch trigger | d71fe0e |
| `backend/app/main.py` | Person 1 | Mounts the routing, `drivers/me`, delivery-actions and dispatch routers | New Person 5 endpoints | f4266de, a213516 |

---

## Part C: Issues found in other modules (not changed here)

1. **WebSocket event key mismatch (Person 2 / frontend types).** The backend names events under `event`, but `frontend/src/types/api.ts` types them with `type` (`DriverLocationUpdateEvent.type`, etc.), and `hooks/useDonationWebSocket.ts` reads `data.type`, so the donor UI ignores every live update. `DonationStatusUpdateEvent` also expects `old_status`/`new_status`, but the backend sends `status`. The Person 5 driver app reads `event` (falling back to `type`).
2. **Cross-module table reads.** §0 says nobody talks to anybody's database directly. Dispatch reads `vehicles`, `donations` and `ngos` in-process instead of calling `GET /drivers?status=AVAILABLE`, and writes donation status. Every module in this single backend app does the same (e.g. matching writes donations); flagged so Person 6/Person 1 can decide whether §0 applies inside one process.
3. **Expiry monitoring.** `docker-compose.yml` starts a Celery worker from `app.worker`, which doesn't exist, and nothing marks donations `EXPIRED`.
4. **`accept_match` doesn't require `Idempotency-Key`**, although §1 lists accept as idempotent. On the frontend only `useNGO.test.tsx` expects one to be sent, from a `useOfferDecision` hook that no longer exists.
5. **`/handover` idempotency scope** is the global `handover` key, not per delivery, so one key could replay another delivery's response. The driver endpoints had the same issue; this branch fixes theirs only.
6. **Tests failing before this branch (verified on d76791c):**
   - `backend/tests/test_health.py` expects `"healthy"`, but `/health` returns `"ok"`.
   - All 7 `tests/ngo` tests error with asyncpg "another operation is in progress". The module-level pooled engine in `tests/fixtures/seed.py` (and the app's global Redis client in `app/core/idempotency.py`) outlive each test's event loop; `tests/dispatch/conftest.py` shows a per-test `NullPool` pattern that avoids it.
   - `test_full_e2e_pipeline` fails at admin login.
7. **Frontend already failing before this branch:**
   - `npx tsc --noEmit`: 6 errors, in `useNGO.test.tsx` (`useOfferDecision` not exported), `NGOVerificationQueue.tsx`, `LoginPage.tsx`, `DonationDetails.tsx` (`Loader2` ×2) and `LandingPage.tsx`.
   - Vitest: 4 failures (`donor.test.tsx`, `useNGO.test.tsx`).
   - As a result `npm run build` fails at `tsc`, while `vite build` itself succeeds.
8. **Repo hygiene:**
   - `.env` is committed and differs from `.env.example`.
   - 12 `__pycache__/*.pyc` files are tracked, so every local run modifies them.
   - Duplicate NGO routers exist (`app/ngo/router.py` not mounted, `app/ngos/router.py` mounted).
   - `ruff` already fails on main in several files outside Person 5.
9. **Donor `eta_minutes` meaning (Persons 1/2).** `GET /donations/{id}` fills `eta_minutes` from `deliveries.estimated_duration_min`, the pickup → NGO leg. If the donor dashboard means "time until my food is collected" or "time until it arrives", a separate field should be agreed. The data exists: `eta_to_pickup_minutes` in `delivery.driver_assigned`, and `estimated_delivery_time` on the delivery.
10. **Audit hash chain** is still a placeholder (`record_hash=""`) in every module, including Person 5's audit entries.

---

## Proposed changelog entry (§8)

> **v1.1: Person 5 additive.**
> - `POST /routes/calculate`: request body defined; `duration_minutes`/`traffic_aware` meaning restated; additive `traffic_source`, `free_flow_duration_minutes`, `provider`, `departure_time`.
> - New `PATCH /drivers/me/availability`, `GET /drivers/me/current-job`, `POST /deliveries/{id}/start`, `POST /deliveries/{id}/report-issue`, `POST /dispatch/{donation_id}`.
> - Pickup/deliver status guards and `PARTIALLY_DELIVERED` on partial handover.
> - Location rate-limit grace and 422.
> - `/ngos/{id}/incoming` ETA and distance filled.
> - WebSocket: `delivery.driver_assigned` payload defined; `delivery.location_update` enriched and limited to active deliveries; new `delivery.driver_issue`, `donation.dispatch_pending`, `driver.status_changed`; additive `timestamp`, `donation_id` and `driver_id` on existing events.
>
> Sign-off: Person 5 (owner); Persons 2, 3, 4, 6 (consumers); Person 1 (co-lead, hooks in `deliveries`, `drivers`, `donations`, `ngos`, `main`).
