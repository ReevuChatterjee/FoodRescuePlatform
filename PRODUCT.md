# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Food Donors**: Commercial kitchens, restaurants, grocers, and caterers who generate surplus edible food. Needs: Fast, low-friction logging of surplus quantities, dietary/storage tags, and strict pickup time windows before disposal.
- **NGOs & Recipient Organizations**: Shelters, soup kitchens, food banks, and community aid organizations. Needs: Verified intake capacity, dietary category filters, real-time incoming offer review, and delivery receipt confirmation.
- **Drivers / Couriers**: Volunteer and on-demand couriers. Needs: Turn-by-turn routing, optimized pickup-dropoff chaining, location autocomplete, and digital handover confirmation (signatures/proof of delivery).
- **Platform Admins & Municipal Partners**: Operations coordinators and municipal oversight teams. Needs: Real-time network telemetry, automated/manual NGO verification queue, audit logging, and aggregate impact reporting (kg diverted, meals recovered, CO2/distance savings).

## Product Purpose
RePlate is an algorithmic micro-donation and food-waste routing service designed to prevent edible food from ending up in landfills. It bridges the gap between commercial food surplus and vulnerable community demand by automating matching, dispatching rapid logistics, and documenting transparent chain-of-custody before food spoils. Success is measured by food diversion volume (kg), meal recovery rate, dispatch efficiency, and verified delivery completion without spoilage.

## Positioning
Unlike static food donation drop-offs or consumer discount apps (which sell surplus for personal consumption), RePlate is an automated, real-time logistics and dispatch coordination layer that pairs rapid-spoilage micro-donations directly with verified institutional recipient capacity and route-optimized drivers in a single closed-loop lifecycle.

## Operating Context
- Fast-paced commercial kitchens with tight closing windows and shifting prep schedules.
- Resource-constrained NGOs with strict storage bounds (refrigerated vs ambient kg limits) and specific dietary demographics.
- Mobile drivers operating in urban road networks requiring dynamic OSRM routing and turn-by-turn navigation deep-links.
- Municipal and ESG compliance reporting requiring auditable, tamper-evident handover tracking and frozen API contract guarantees.

## Capabilities and Constraints
- **Multi-Role RBAC**: Strict separation across ADMIN, DONOR, NGO, and DRIVER roles via JWT auth and route guards.
- **Matching & Scoring Engine**: Automated multi-variable scoring (`optimizer.py`) evaluating food category, quantity, distance, NGO storage capacity, and urgency/shelf-life expiry windows.
- **Dispatch & Routing**: Real-time driver matching, vehicle routing heuristics (VRP), dynamic OSRM road geometry, and Google Maps deep-links.
- **NGO Verification Workflow**: State-machine governance (`PENDING` → `APPROVED` / `REJECTED`) with admin verification rationale and audit trail.
- **System-Wide Analytics**: Real-time KPI aggregation for kg diverted, meals recovered, delivery success rate, average matching time, and beneficiary reach estimates.
- **Frozen Contract Architecture**: Strict envelope schema (`SuccessEnvelope`, `ErrorEnvelope`) across all endpoints.

## Brand Commitments
- **Name**: RePlate (Algorithmic Micro-Donation & Food-Waste Routing Service).
- **Tone & Voice**: Purposeful, operational, authoritative, and mission-driven. Prioritizes clarity, real-time status visibility, and logistical precision over decorative fluff.
- **Identity Assets**: RePlate leaf motif, dark/light theme support, clean telemetry and status badges.

## Evidence on Hand
- Frozen OpenAPI contract specifications and API schemas in `contracts/` and `docs/`.
- Full-stack architecture: FastAPI async backend, PostgreSQL 16 + PostGIS, Redis 7, React 18 frontend with TypeScript, Tailwind CSS, Leaflet maps, and TanStack Query.
- 7 automated end-to-end integration test scenarios covering capacity rejection, expiry handling, rematching, concurrent acceptance, and complete delivery lifecycles.
- Working landing page, admin command center, donor donation manager, NGO intake portal, and driver delivery telemetry screens.

## Product Principles
1. **Time is the enemy of food rescue**: Every design and workflow decision must minimize latency between surplus declaration and recipient intake.
2. **Never exceed recipient capacity**: An offer matched to an over-capacity or under-refrigerated NGO is a failure; capacity boundaries and storage constraints are inviolable.
3. **Frictionless logging for donors**: Donors are working in hot, busy kitchens; donation submission must be effortless, unambiguous, and fast.
4. **Complete chain of custody**: Every kilogram moved must be accounted for—from donor pickup through driver transit to NGO intake confirmation.
5. **Operational transparency over decorative abstraction**: Dashboards and portals must lead with real telemetry, actionable queues, and clear verification statuses.

## Accessibility & Inclusion
- Clean WCAG 2.1 AA compliant contrast across both light and dark operational themes.
- Accessible keyboard navigation and ARIA landmarks across high-speed data entry forms (donation creation, intake acceptance).
- Responsive layouts suitable for desktop dispatch monitors as well as mobile in-cab driver navigation.
