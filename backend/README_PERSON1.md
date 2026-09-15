# Person 1 Module — Backend Auth, Donations/NGO/Driver/Delivery CRUD, WebSocket Broker

This module is the backend foundation everyone else's work sits on: user auth and JWTs, the donations/NGO/driver/delivery CRUD surface, and the in-process WebSocket broker. Persons 2–6 build their UIs and matching/dispatch logic against these endpoints rather than each hand-rolling their own auth or data layer. It's been run and verified against real Postgres 16 + Redis 7 in Docker (not just SQLite) — see "What's verified vs. what's not" below for exactly what that covered.

## How to run the backend

### 1. Full Docker stack

From the repo root:

```bash
docker-compose up -d --build
```

This builds and starts `db` (Postgres+PostGIS), `redis`, `backend`, `worker`, and `frontend`. The `backend` service's compose `command` overrides the Dockerfile's default `CMD`, so **migrations do not run automatically** — run them explicitly once `db` is healthy:

```bash
docker-compose exec backend alembic upgrade head
```

The API listens on `http://localhost:8000` (mapped from the container's port 8000). Check it's up:

```bash
curl http://localhost:8000/health          # liveness, no DB/Redis check
curl http://localhost:8000/ready           # readiness — checks DB + Redis
docker-compose logs -f backend             # tail logs
```

If 5432/6379/8000 are already taken by something else on your machine, don't fight it here — use approach 2 below, or add a `docker-compose.override.yml` remapping ports the same way.

### 2. Local Python + Postgres (no full compose stack)

This is the path actually used this session to verify against real Postgres when 5432/6379/8000 were already held by an unrelated project's containers.

**Venv + deps.** There's no `requirements.txt` — deps live in `pyproject.toml` (Poetry format) but Poetry isn't required; `pip install` the same versions directly:

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install --upgrade pip
.venv/Scripts/python -m pip install \
  "fastapi>=0.111,<0.112" "uvicorn[standard]>=0.30,<0.31" \
  "sqlalchemy[asyncio]>=2.0.30,<2.1" "asyncpg>=0.29,<0.30" \
  "alembic>=1.13.1,<1.14" "psycopg2-binary>=2.9.9,<2.10" \
  "python-jose[cryptography]>=3.3.0,<3.4" "passlib[bcrypt]>=1.7.4,<1.8" \
  "bcrypt<4.1" "argon2-cffi>=23.1.0,<23.2" "pydantic>=2.7.0,<2.8" \
  "pydantic-settings>=2.3.0,<2.4" "python-dotenv>=1.0.1,<1.1" \
  "redis[hiredis]>=5.0.4,<5.1" "httpx>=0.27.0,<0.28" "python-multipart>=0.0.9,<0.0.10"
```

**The `bcrypt<4.1` pin matters.** `passlib` 1.7.4 (what this project pins) predates `bcrypt` 4.1's removal of the `__about__` module passlib reads at import time — installing a bare `bcrypt` (which resolves to ≥4.1 today) breaks password hashing outright, so registration/login fail the moment `pwd_context.hash(...)` runs. `pyproject.toml` already carries this pin (`bcrypt = "<4.1"`); keep it if you're generating deps any other way.

**Postgres + Redis only, on remapped ports.** Add `docker-compose.override.yml` at the repo root (git-ignored, local only — see `.gitignore`):

```yaml
services:
  db:
    ports: !override
      - "5433:5432"
  redis:
    ports: !override
      - "6380:6379"
```

The `!override` tag matters: this Compose version *merges* `ports` lists by default, so without it you'd end up bound to **both** the original 5432/6379 (still colliding with whatever else is using them) **and** the remapped ports. `!override` replaces the list instead. Pick whatever free host ports work for you; 5433/6380 are just what was free this session.

```bash
docker-compose up -d db redis     # from repo root
```

**Point Alembic and the app at that Postgres, then migrate and run:**

```bash
cd backend
export DATABASE_URL_SYNC="postgresql://cpi_user:cpi_pass@localhost:5433/cpi_db"
export DATABASE_URL="postgresql+asyncpg://cpi_user:cpi_pass@localhost:5433/cpi_db"
export REDIS_URL="redis://localhost:6380/0"
export JWT_SECRET="local-dev-secret-at-least-32-characters-long"
export JWT_REFRESH_SECRET="local-dev-refresh-secret-at-least-32-chars"

.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8088
```

Note the credentials (`cpi_user` / `cpi_pass`) come straight from the `db` service definition in `docker-compose.yml`, not from `.env.example` — that file only has a `CHANGEME` placeholder, not a real password. Pick whatever local port uvicorn should listen on (8088 here, since 8000 was taken).

### 3. SQLite-only sanity check (fast, but limited)

For a pure code sanity-check with zero external services: install `aiosqlite`, point `DATABASE_URL` at `sqlite+aiosqlite:///./local_dev.sqlite3`, skip Alembic entirely, and create tables directly from the ORM metadata (`Base.metadata.create_all`) instead. This is the fastest loop, but **don't rely on it alone** — SQLite doesn't enforce foreign-key constraints by default, and it's exactly what let bug #3 below (the `register()` FK-ordering bug) through completely unnoticed. It only surfaced once tested against real Postgres. Treat SQLite as a first-pass smoke test, not a substitute for the Postgres path above.

## Quick start for integration

**Seed an admin user** (safe to re-run — no-ops if the email exists):

```bash
python -m app.scripts.seed_admin --email admin@cpi.local --password ChangeMe123! --name "Admin"
```

**Get a JWT** — register then log in:

```bash
curl -X POST http://localhost:8088/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Donor","email":"donor@example.com","phone":"1234567890","password":"TestPass123!","role":"DONOR","organisation_name":"Test Org","address":"123 Test St"}'

curl -X POST http://localhost:8088/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"donor@example.com","password":"TestPass123!"}'
# -> { "data": { "access_token": "...", "refresh_token": "...", ... } }

curl http://localhost:8088/api/v1/auth/me -H "Authorization: Bearer <access_token>"
```

**OpenAPI docs**: `http://<host>:<port>/docs` (Swagger UI) or `/redoc`, live as soon as the app is running — not disabled anywhere in `main.py`.

## Endpoints implemented

Pulled directly from the router files, not the contract PDF — this is what's actually there right now.

**Auth** — `app/auth/router.py`, prefix `/api/v1/auth`

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/register` | Create User + role-specific Donor/NGO/Vehicle row | none |
| POST | `/login` | Email/password → access + refresh token pair | none |
| POST | `/refresh` | Refresh token → new access + rotated refresh token | none |
| GET | `/me` | Current user profile + linked donor_id/ngo_id/driver_id | Bearer JWT |

**Donations** — `app/donations/router.py`, prefix `/api/v1/donations`

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `` | Create a donation | DONOR |
| GET | `` | List donations (donor sees own; admin sees all; others 403) | any authenticated user |
| GET | `/{donation_id}` | Fetch one | any authenticated user (donor restricted to own) |
| PATCH | `/{donation_id}` | Partial update — status/matched_ngo_id/match_score/weights_version_id | ADMIN or DONOR |
| PATCH | `/{donation_id}/cancel` | Donor cancels pre-pickup | DONOR |
| POST | `/{donation_id}/photos` | Multipart photo upload (audit trail) | DONOR |

**NGOs** — `app/ngos/router.py`, prefix `/api/v1/ngos`

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/{ngo_id}` | Profile, capacity, accepted categories, demand, verification status | any authenticated user |
| PATCH | `/{ngo_id}` | Update profile fields (address, hours, categories) | self (NGO owner) or ADMIN |
| PATCH | `/{ngo_id}/demand` | Add a demand entry for a food category | NGO or ADMIN, self or admin |
| PATCH | `/{ngo_id}/capacity` | Update available_capacity_kg | NGO or ADMIN, self or admin |
| GET | `/{ngo_id}/incoming` | Donations currently matched to this NGO | NGO or ADMIN, self or admin |

**Drivers** — `app/drivers/router.py`, prefix `/api/v1/drivers`

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `` | Driver/vehicle pool, filterable by `?status=` | any authenticated user |
| POST | `/location` | Update current location; rate-limited to 1 request/5s per driver | DRIVER |

**Deliveries + handover** — `app/deliveries/router.py`, prefixes `/api/v1/deliveries` and `/api/v1/handover`

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/deliveries/{delivery_id}` | Fetch one delivery | any authenticated user |
| POST | `/deliveries/{delivery_id}/pickup` | Driver confirms pickup | DRIVER (must be the assigned driver) + `Idempotency-Key` header |
| POST | `/deliveries/{delivery_id}/deliver` | Driver confirms delivery, creates the HandoverRecord | DRIVER (must be the assigned driver) + `Idempotency-Key` header |
| POST | `/handover/{delivery_id}` | NGO's half of the digital sign-off | NGO + `Idempotency-Key` header |

All three mutating endpoints 400 with `MISSING_IDEMPOTENCY_KEY` if the header is absent, and replay the cached response (not reprocessed) if the same key is sent twice.

**WebSocket** — `app/ws/router.py`

| Path | Description | Auth |
|---|---|---|
| `/ws/donations` | `donation.created`, `donation.status_changed`, `donation.cancelled` | `?token=<jwt>` query param — closes with code 4401 if missing/invalid |
| `/ws/deliveries` | `delivery.status_changed`, `delivery.handover_confirmed`, `delivery.location_update` | same |
| `/ws/drivers` | `driver.location_update`, `driver.status_changed` | same |

## Database schema changes

Migration `002_donation_contract_fields.py` (on top of `001_initial_schema.py`), read directly from the migration file:

- **`donations.pickup_location`**: changed from `String(200)` (a `"lat,lng"` string) to `JSON`, storing `{"latitude", "longitude", "address"}` — this is what the contract's `POST /donations` shape actually requires. The migration backfills any existing string values by wrapping them as `{"raw": "<old value>"}` rather than dropping data.
- **`donations.special_handling`**: new nullable `Text` column — the field name the contract actually uses. The old `special_requirements` column is left in place, unused, for anything already written against migration 001.
- **`donations.food_safety_info`**: new nullable `JSON` column for `{"storage_temp_required", "allergen_tags", "packaging_type"}`.

Verified this session: both 001 and 002 apply cleanly via `alembic upgrade head` against real Postgres, and the JSON columns store correctly nested objects/arrays (confirmed directly via `psql`, not just via the API's 201 response).

## What's verified vs. what's not

**Directly exercised this session, against real Postgres + Redis** (plus an earlier SQLite pass for the same auth+donation-create path):

- `alembic upgrade head` applying both migrations cleanly
- `POST /auth/register` for all three roles (DONOR, NGO, DRIVER), `POST /auth/login`, `GET /auth/me` — correct donor_id/ngo_id/driver linkage
- `POST /donations` (create), including the migration-002 JSON columns (`pickup_location`, `food_safety_info`) verified directly in the database, not just via the API response
- `GET /donations/{id}` (used repeatedly to check status transitions)
- `POST /deliveries/{id}/pickup` and `/deliver`: success path, 403 for a driver not assigned to that delivery, 400 for a missing `Idempotency-Key`, and a same-key replay confirmed to return the identical cached response (not reprocessed — same `actual_pickup_time` and `meta.request_id`)
- `POST /handover/{id}`: 400 for missing key, full-quantity handover → donation/delivery status `DELIVERED`, partial-quantity handover → `PARTIALLY_DELIVERED`
- `POST /drivers/location`: one successful call, confirmed it broadcasts to both `/ws/drivers` and `/ws/deliveries`
- `GET /ngos/{id}`, `PATCH /ngos/{id}/demand`, `PATCH /ngos/{id}/capacity`: confirmed values actually persist via a `GET /ngos/{id}` read-back afterward (not just a 200 response) — the demand entry appears with the correct category/quantity/priority, `available_capacity_kg` updates to the new value; also confirmed the `available_capacity_kg > storage_capacity_kg` guard rejects with 400 and leaves the prior value in place
- `GET /health`, `GET /ready`
- WebSocket: valid-token connect accepted on `/ws/donations`; missing/invalid-token connect closes with code 4401; a connected client receives the `donation.created` broadcast after `POST /donations`, and a client on `/ws/deliveries` receives `delivery.location_update` after `POST /drivers/location`
- `GET /donations` (list, own donation appears), `PATCH /donations/{id}` (status write), `PATCH /donations/{id}/cancel`, `GET /drivers` (pool list), `PATCH /ngos/{id}` (profile update accepted, per its 200 response — not independently re-read via a separate GET the way capacity/demand was), `GET /ngos/{id}/incoming`

**Implemented but not exercised this session** — no reason to believe they're broken, just not run:

- `POST /auth/refresh`
- `POST /donations/{id}/photos`
- `GET /deliveries/{id}` (the plain fetch — only the pickup/deliver response bodies were checked, not this endpoint directly)
- The 429 rate-limit branch of `POST /drivers/location` (only one call was made, well under the limit)
- `/ws/drivers` as a direct connection target (the event it's meant to carry was confirmed arriving on `/ws/deliveries`, since `drivers/router.py` broadcasts to both, but nothing connected to `/ws/drivers` itself this session)

## Integration points — what Person 6 (and Persons 2–5) need to know

- **No dispatch/assignment endpoint exists yet.** Nothing in this codebase creates a `Delivery` row — Person 5's dispatch logic needs to add that. `POST /deliveries/{id}/pickup` and `/deliver` both assume a `Delivery` already exists with `driver_id` set; they 404 otherwise.
- **`PATCH /donations/{id}`** is where Person 4's matching engine should write results — it accepts `status`, `matched_ngo_id`, `match_score`, and `weights_version_id` and broadcasts `donation.status_changed` on `/ws/donations` when status actually changes.
- **Shared WebSocket broker**: import `from app.ws.manager import manager` and call `await manager.broadcast(channel, event_dict)` (channels are `"donations"`, `"deliveries"`, `"drivers"`) to emit more events from other modules — this is the one broker everyone should use rather than standing up a separate connection manager. See `donations/router.py` or `drivers/router.py` for examples.
- **Auth dependencies to reuse**, both in `app/auth/dependencies.py`: `require_admin` (already used by Person 6's admin/analytics routers) and `require_role(*roles)` (a generalized version of the same pattern — e.g. `Depends(require_role("DRIVER"))`). Don't hand-roll a second role-check mechanism.
- **`NGO.verification_status`** is read by `GET /ngos/{id}` (exposed as both the raw value and an `is_verified` bool) and should be the same field any admin verify endpoint writes to and any matching-engine candidate filter reads from.

**Four real bugs were found and fixed while verifying this module, worth knowing about if you're touching auth or async DB writes elsewhere:**

1. `passlib` 1.7.4 is incompatible with `bcrypt` ≥4.1 (breaks password hashing). `pyproject.toml` pins `bcrypt<4.1` — keep that pin if you touch these deps.
2. `iso_z()` in `app/core/envelope.py` exists specifically to avoid a double-timezone-suffix bug (`"...+00:00Z"`) when formatting a timezone-aware datetime that came from client input — use it for any new datetime-to-string output rather than calling `.isoformat()` directly.
3. **The one most likely to recur**: `register()` in `app/auth/router.py` used to `db.add()` a `User` and a role-specific child row (`Donor`/`NGO`/`Vehicle`) in the same flush with no ORM `relationship()` between them. Without a declared relationship, SQLAlchemy has no dependency graph to order same-flush inserts by FK, and silently falls back to alphabetical table-name order — which inserted `donors`/`ngo_food_categories` *before* `users`, violating the FK, on Postgres only (SQLite doesn't enforce FKs by default, so it passed there without complaint). Fixed with an explicit `await db.flush()` right after adding the parent row. **If you add a new model with a cross-table insert in the same commit and don't declare a `relationship()` or flush in between, this can happen again** — either declare the relationship or flush the parent first.
4. WebSocket auth rejection in `app/ws/router.py` called `websocket.close(code=4401)` before `websocket.accept()`. A custom close code can only be delivered over an accepted connection; closing pre-accept has no WS handshake to carry it, so the ASGI server just rejects the upgrade with a generic HTTP 403 and the 4401 is lost. Fixed by accepting first, then closing.

## Known limitations

- **`POST /donations/{id}/photos`** writes an audit-log entry with a placeholder storage path (`pending-storage/{donation_id}/{filename}`) — no real object storage (S3/local disk) is wired up yet. The file itself is read by FastAPI but never persisted anywhere.
- **`PATCH /ngos/{id}/demand`** always inserts a new `NGODemand` row; it never updates or deletes an existing row for the same `food_category`. `GET /ngos/{id}` returns every demand row ever inserted for that NGO (ordered by `updated_at` across all categories, not deduplicated per category) — so repeated updates for the same category accumulate in the response rather than the latest one replacing older ones. Fine for a first pass, but will need real upsert-by-category semantics before this is trustworthy for anything reading "current demand."
