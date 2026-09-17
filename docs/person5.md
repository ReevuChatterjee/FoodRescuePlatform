# Person 5: Routing, Dispatch and Driver App

Person 5 turns an accepted match into food that actually moves (contract §6, project description §9). This document explains how routing and dispatch work, which numbers are **sourced** and which are **assumed**, and how to configure and test the module.

Contract changes and hooks in other people's files are listed separately in [person5-contract-additions.md](person5-contract-additions.md).

## Where the code lives

| Area | Path |
|---|---|
| Routing engine | `backend/app/routing/` (`geo.py`, `traffic.py`, `providers.py`, `service.py`, `router.py`, `settings.py`, `fixtures/sample_coordinates.json`) |
| Dispatch and delivery lifecycle | `backend/app/dispatch/` (`selection.py` pure ranking, `service.py` DB + events, `router.py` driver endpoints) |
| Contract endpoints Person 5 owns in Person 1's routers | `deliveries/router.py` (pickup, deliver), `drivers/router.py` (location) |
| Driver app | `frontend/src/pages/driver/DriverDashboard.tsx`, `frontend/src/components/driver/`, `frontend/src/hooks/useDriver*.ts` |
| Tests | `backend/tests/test_routing.py`, `backend/tests/test_dispatch_selection.py`, `tests/dispatch/`, `frontend/src/**/*Driver*.test.tsx`, `frontend/src/components/driver/polyline.test.ts` |

## Routing

`app.routing.service` is the only import point for other modules. It has two deliberate paths:

- **`estimate_route` / `estimate_routes_from`** (sync, no I/O). They always use the heuristic provider, and are used wherever many routes are scored at once: Person 4's `load_routes`, NGO incoming offers (`offer_route_summary`), dispatch's first ranking pass, and the ETA in `delivery.location_update`. Matching never waits on the network.
- **`calculate_route`** (async). It uses the configured provider with automatic fallback to the heuristic and a small TTL cache. It serves the single route that actually gets driven: dispatch's re-check of the top candidates, the driver's current job, and `POST /api/v1/routes/calculate`.

With the default `ROUTING_PROVIDER=heuristic`, both paths return identical numbers.

### Providers

Every provider returns the same `RouteEstimate`: distance, free-flow duration, ETA with congestion, encoded polyline (precision 5), provider name, departure time and traffic source.

| Provider | Distance and geometry | Congestion | Notes |
|---|---|---|---|
| `heuristic` (default) | Straight line × circuity factor; the geometry is a straight line | Traffic model (below) | Offline and deterministic. The driver map draws it **dashed** and labelled "not a road route". |
| `osrm` | Road network from an OSRM server | Traffic model on top (OSRM has no traffic) | The public demo server is for light use only; self-host for anything heavier. |
| `tomtom` | Road network | **Live traffic** (`traffic=true`) | Needs `ROUTING_TOMTOM_API_KEY`. Only tested against mocked responses so far. The request URL carries the key, so it is never logged. |

Any failure of `osrm`/`tomtom` degrades silently to the heuristic, and the estimate's `provider` then says `heuristic`.

### HTTP response of `POST /api/v1/routes/calculate`

The contract fields keep their contract meaning:

- `duration_minutes` is the **ETA including congestion**.
- `traffic_aware` is `true` **only** when live traffic data produced it (TomTom).

`traffic_source` tells consumers where the congestion came from, so they never apply their own on top:

| `traffic_source` | Meaning |
|---|---|
| `live` | TomTom live traffic |
| `time_of_day_model` | Default Bengaluru hourly model (below) |
| `city_average_model` | Flat city-average congestion (`ROUTING_TRAFFIC_MODEL=city_average`) |
| `none` | No congestion applied (`ROUTING_TRAFFIC_MODEL=free_flow`): the ETA is free-flow time |

The additive fields are `traffic_source`, `free_flow_duration_minutes`, `provider` and `departure_time`. `GET /drivers/me/current-job` returns `route_to_next_stop` in exactly this shape.

### Traffic model: sourced vs assumed

| Constant | Value | Status |
|---|---|---|
| Free-flow travel time, Bengaluru | 2 min 4 s per km | **SOURCED**: TomTom Traffic Index, 2025 data (project description §9) |
| City-average travel time, Bengaluru | 3 min 37 s per km (≈1.75× free-flow) | **SOURCED**: same |
| Hour-by-hour congestion shape (quiet overnight, 09:00 and 18:00 peaks) | `HOURLY_SHAPE` in `traffic.py` | **ASSUMED**. It is scaled so its 24-hour mean equals the sourced city average; it only redistributes the published average across the day, never makes the city busier or quieter. Replace with hourly data when available. |
| Circuity factor (road km per straight-line km) | 1.3 | **ASSUMED**. It is the same value Person 4's placeholder used, so ETAs stay comparable. |

Times are evaluated in IST (fixed +05:30, no DST); the database stores naive UTC.

## Dispatch

Dispatch runs when an NGO accepts (`accept_match` background task). It is retried whenever a driver becomes available: goes online, finishes a delivery, has their job cancelled, or sends a first known location. Admins can also trigger it with `POST /api/v1/dispatch/{donation_id}`. Nothing polls.

### Driver selection (`dispatch/selection.py`, pure functions)

Hard constraints, in order. The first one that fails is recorded as the driver's rejection reason:

1. Vehicle `AVAILABLE` (`DRIVER_NOT_AVAILABLE`)
2. Vehicle capacity ≥ donation quantity (`INSUFFICIENT_VEHICLE_CAPACITY`)
3. Driver location known (`DRIVER_LOCATION_UNKNOWN`)
4. Food reaches the NGO before expiry (`EXPIRY_NOT_FEASIBLE`), counting: drive to pickup → wait for `available_from` → **loading buffer** → delivery leg (estimated at the actual departure time) → **unloading buffer**.

Survivors are ranked by earliest arrival at the NGO (to the minute), then the smallest vehicle that fits (large vans stay free for large donations), then `driver_id` so ties are deterministic. The top 3 are re-checked with `calculate_route` (live traffic or road geometry when enabled). The first one whose vehicle can be claimed wins.

Outcomes:
- `ASSIGNED`
- `ALREADY_ASSIGNED`
- `PENDING` (`NO_AVAILABLE_DRIVER` or `NO_FEASIBLE_DRIVER`; retried later, `donation.dispatch_pending` is emitted once)
- `NOT_DISPATCHABLE` (wrong status, expired, missing locations)

Expiry priority follows §9: >4 h `LOW`, 2–4 h `MEDIUM`, 1–2 h `HIGH`, <1 h `CRITICAL`.

| Constant | Value | Status |
|---|---|---|
| Loading buffer | 5 min | **ASSUMED** (`DispatchConfig`) |
| Unloading buffer | 5 min | **ASSUMED** |
| Candidates re-checked with the configured provider | 3 | Design choice |
| Donations retried per pending run | 10, earliest expiry first | Design choice |
| Distance from pickup that counts as `IN_TRANSIT` | 150 m | **ASSUMED** (clears GPS noise) |
| Location rate limit | 1 per 5 s (contract) with 0.5 s jitter grace | Contract + **ASSUMED** grace |

### Delivery lifecycle

```
DRIVER_ASSIGNED ──start──▶ PICKUP_STARTED ──pickup──▶ PICKED_UP ──ping >150 m──▶ IN_TRANSIT ──deliver──▶ DELIVERED | PARTIALLY_DELIVERED
       │  └──────────────────pickup (start is optional)────▲                  └──────────deliver──────────▲
       ├─ report-issue (before pickup) ─▶ DRIVER_ISSUE ─▶ reassigned to the next driver, same NGO, same delivery row
       └─ donor cancel (before pickup)  ─▶ CANCELLED, driver back to AVAILABLE
```

- The donation status mirrors the delivery status at each step.
- **`PICKUP_STARTED` comes only from `POST /deliveries/{id}/start`**, never from location, because available drivers stream location too.
- **`/deliver`** sets `DELIVERED` if the quantity handed over is ≥ the donation quantity, otherwise `PARTIALLY_DELIVERED`. This is the same rule as `POST /handover/{id}`. It also frees the vehicle and moves it to the NGO's location.
- **Report issue** works before pickup only. It sets the reporting driver `OFFLINE` and dispatch reuses the delivery row, so analytics count one delivery, not a failure plus a new one.
- **Donor cancel** before pickup cancels the delivery (including one waiting for reassignment) and frees a busy driver. After pickup it returns 409.

### Concurrency and idempotency

- **Lock order everywhere a delivery changes:** donation row → delivery row → vehicle row. Cancel, start, pickup, deliver, report-issue and the `IN_TRANSIT` location ping follow it exactly, so none of them can deadlock another (`tests/dispatch/test_lock_order.py`). Dispatch holds the donation lock throughout and claims a vehicle with a compare-and-set `UPDATE … WHERE availability_status = 'AVAILABLE'`, so a donation or a driver is never double-assigned (`tests/dispatch/test_end_to_end.py`).
- **Idempotency:** driver actions (`start`, `pickup`, `deliver`, `report-issue`) cache their response in Redis under `deliveries.<action>:{delivery_id}:{driver_id}` for 24 h. A retry with the same key replays the original response, even if the delivery was reassigned in the meantime, and one driver can never receive another driver's cached response. A different key for an action that already happened returns 409.
- WebSocket events are published **after** the commit.

### WebSocket events

| Channel | Event | When |
|---|---|---|
| `/ws/deliveries` | `delivery.driver_assigned` | Driver assigned or reassigned (delivery view + `vehicle_id`, `eta_to_pickup_minutes`, `reassigned`) |
| `/ws/deliveries` | `delivery.status_changed` | Every delivery status change |
| `/ws/deliveries` | `delivery.driver_issue` | Driver reported an issue |
| `/ws/deliveries` | `delivery.location_update` | Location ping **only while the driver has an active delivery**: `delivery_id`, `donation_id`, `driver_id`, `status`, `next_stop`, `eta_minutes` (heuristic, to the next stop), `latitude`, `longitude`, `timestamp` |
| `/ws/donations` | `donation.status_changed` | Donation status follows the delivery |
| `/ws/donations` | `donation.dispatch_pending` | Accepted, but no feasible driver yet |
| `/ws/drivers` | `driver.location_update` | Every accepted location ping |
| `/ws/drivers` | `driver.status_changed` | AVAILABLE / BUSY / OFFLINE changes |

Every event names itself under the key `event` and carries a UTC `timestamp`.

## Driver app

`/driver` (DRIVER role) is built for a phone:

- **Job view:** next stop, priority badge, ETA and distance, live remaining shelf life, slack before expiry, food details, special handling and safety info.
- **Map:** driver, pickup and NGO markers with the route to the next stop; the line is dashed for heuristic estimates.
- **Actions:** large-target start / confirm pickup / confirm delivery / report issue. Each action creates one `Idempotency-Key` and reuses it on "Try again".
- **Online/offline toggle:** sends the current position when going online, and is disabled during a job.
- **Location:** `watchPosition` feeds a send loop at most every 5 s while the driver is online or on a job. A 429 is a skipped beat. Denied permission shows a banner: without location the driver can't be dispatched.
- **Live updates:** subscribes to `/ws/deliveries` and `/ws/drivers` and refetches the job when an event concerns this driver or their delivery. The driver's own location echoes are ignored.

## Configuration

All variables are optional; defaults work offline. Set them in `.env` (see `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `ROUTING_PROVIDER` | `heuristic` | `heuristic` \| `osrm` \| `tomtom` |
| `ROUTING_OSRM_BASE_URL` | `https://router.project-osrm.org` | OSRM server (demo server: light use only) |
| `ROUTING_TOMTOM_API_KEY` | *(empty)* | Required for `tomtom`; without it the heuristic is used and a warning is logged. **Never commit a real key.** |
| `ROUTING_TOMTOM_BASE_URL` | `https://api.tomtom.com` | |
| `ROUTING_TIMEOUT_SECONDS` | `4` | Per request to OSRM/TomTom |
| `ROUTING_CIRCUITY_FACTOR` | `1.3` | Heuristic road-km per straight-line km (assumption) |
| `ROUTING_TRAFFIC_MODEL` | `time_of_day` | `time_of_day` \| `city_average` \| `free_flow`, used by heuristic and OSRM; reported as `traffic_source` |
| `ROUTING_CACHE_TTL_SECONDS` | `120` | Route cache for `calculate_route`; `0` disables it. Keys use ~11 m endpoint rounding and 5-minute departure buckets. |

Frontend: `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` (existing) point the driver app at the backend.

## Running the tests

Postgres and Redis are required for the API tests (`docker-compose up -d db redis`). The tests **drop every table**, so `DATABASE_URL` must point at a database whose name ends in `_test`:

```bash
# from the repo root
export DATABASE_URL=postgresql+asyncpg://cpi_user:cpi_pass@localhost:5432/cpi_test
export DATABASE_URL_SYNC=postgresql://cpi_user:cpi_pass@localhost:5432/cpi_test
export REDIS_URL=redis://localhost:6379/0            # tests use Redis DB 15
export JWT_SECRET=<32+ chars> JWT_REFRESH_SECRET=<32+ chars>

(cd backend && pytest tests/test_routing.py tests/test_dispatch_selection.py)   # unit, no services
PYTHONPATH=backend:. pytest -o asyncio_mode=auto tests/dispatch                  # API + concurrency
(cd frontend && npx vitest --run src/hooks/useDriver.test.tsx src/hooks/useDriverLocation.test.tsx \
   src/hooks/useDriverWebSocket.test.ts src/components/driver src/pages/driver)
```

On Windows PowerShell use `$env:NAME = "..."` and `$env:PYTHONPATH = "backend;."`.

## Known limitations

- The TomTom provider has only been exercised with mocked responses, not the live API.
- One driver carries one donation at a time; multi-stop routing (VRP) is future scope, as in the brief.
- The location rate limiter is in memory, per backend process; running several workers would need a shared limiter (Redis).
- There is no worker yet that marks donations `EXPIRED` (a shared gap: docker-compose starts a Celery worker that doesn't exist). Dispatch refuses expired donations, and pending retries skip them.
