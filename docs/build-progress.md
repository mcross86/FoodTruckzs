# foodtruckzs Build Progress

Last updated: 2026-05-26

## Current Phase

Phase 20: Authenticated web UX polish.

Goal: replace pasted access-token fields on MVP customer, vendor, notification, and admin pages with first-class login/register, saved-user search/selection, and active vendor selection while keeping the existing API workflow intact.

## Completed Setup

- Confirmed the repository started as a docs-only folder with no package manifests, README, or git metadata visible to the shell.
- Created a pnpm workspace monorepo:
  - `apps/web` for the Next.js application shell.
  - `apps/api` for the Node.js/TypeScript Fastify API shell.
  - `packages/shared` for future cross-app TypeScript types, constants, DTOs, and validators.
  - `docs` for product and build continuity documentation.
- Added root development tooling:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `tsconfig.base.json`
  - `eslint.config.mjs`
  - `.prettierrc.json`
  - `.prettierignore`
  - `.editorconfig`
  - `.gitignore`
  - `.env.example`
- Added a foundation-only Fastify API with `/healthz` and `/readyz`.
- Added a foundation-only Next.js app with `/api/health`.
- Added an empty shared package export surface with `APP_NAME`.
- Added README setup, development, and check instructions.
- Installed dependencies with pnpm and generated `pnpm-lock.yaml`.
- Expanded the API backend foundation:
  - Fastify app and server entrypoints now use validated environment config, structured pino logging, request IDs, secure headers, CORS allowlist, centralized errors, and graceful database shutdown.
  - `/healthz` reports process health with a request ID.
  - `/readyz` checks the PostgreSQL readiness dependency through the database client shell and returns a consistent `503` error when unavailable.
  - Environment validation now uses Zod for required API, CORS, logging, request body, and database configuration.
  - Added centralized `AppError` subclasses and a Fastify error handler with the documented error response shape.
  - Added a request context/request ID middleware and a reusable Zod validation helper.
  - Added a Drizzle/PostgreSQL client shell, initial empty schema export, transaction type shell, and Drizzle config before the domain schema phase.
  - Added Vitest backend unit/integration test setup and focused tests for env validation, Zod parsing, health checks, readiness success, and readiness failure.
- Added the first PostgreSQL/Drizzle schema foundation:
  - Auth and tenant identity tables: `users`, `sessions`, `refresh_tokens`, and `vendor_memberships`.
  - Marketplace/vendor tables: `vendors`, `vendor_profiles`, `cuisines`, `vendor_cuisines`, `vendor_service_areas`, `addresses`, and `files`.
  - RFQ workflow tables: `rfqs`, `rfq_vendor_targets`, `rfq_requirements`, and `rfq_status_history`.
  - Quote workflow tables: `quotes`, `quote_revisions`, `quote_line_items`, and `payment_schedule_items`.
  - Agreement tables: `agreements`, `agreement_versions`, and `agreement_signatures`.
  - Messaging tables: `message_threads`, `messages`, and `thread_read_states`.
  - Scheduling tables: `calendar_events`, `catering_events`, `availability_rules`, and `availability_exceptions`.
  - Payment tables: `payments`, `payment_attempts`, `refunds`, `payouts`, and `stripe_webhook_events`.
  - Platform billing tables: `vendor_billing_settings`, `platform_agreement_fees`, `vendor_invoices`, and `vendor_invoice_line_items`.
  - Notification/event/audit tables: `notifications`, `notification_preferences`, `notification_deliveries`, `outbox_events`, and `audit_logs`.
- Generated the initial Drizzle migration: `apps/api/src/db/migrations/0000_nasty_leopardon.sql`.
- Added optional database-backed schema constraint tests that run when `TEST_DATABASE_URL` is set.
- Documented `TEST_DATABASE_URL` in `.env.example`.
- Added the production-shaped auth and authorization foundation:
  - Registered `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, and `/api/v1/auth/me`.
  - Added Argon2id password hashing and verification.
  - Added HS256 JWT access tokens with short configurable TTL and bearer-token authentication middleware.
  - Added opaque refresh tokens stored in an HttpOnly SameSite cookie and HMAC-hashed before persistence.
  - Added refresh token rotation, single-use refresh behavior, refresh-token reuse detection, token-family revocation, and session invalidation.
  - Added request context fields for authenticated user, session, global roles, active vendor, and vendor memberships.
  - Added RBAC primitives for `customer`, `vendor_user`, `platform_admin`, and `support_admin`.
  - Added vendor membership guard with optional vendor-role checks.
  - Added auth tests for happy path, invalid credentials, expired access tokens, expired sessions, revoked sessions, refresh rotation/reuse detection, and vendor access denial.
  - Added API auth environment variables for JWT and refresh-token secrets and TTLs.
- Added the vendor operational setup backend:
  - Registered vendor account/profile setup routes, vendor-scoped profile reads/updates, soft vendor closure, membership list/create/update/remove, cuisine lookup/admin management, vendor cuisine assignment, service area replacement, availability get/replace, menu/item/package routes, vendor platform-billing read, and admin billing-settings read/write.
  - Reused the existing bearer auth, request context, global role guard, and vendor membership guard so owner/manager/staff/viewer permissions are enforced at the route boundary.
  - Added service-layer validation for required vendor setup fields, cuisine existence, minimum lead time, travel radius, non-overlapping recurring availability windows, valid blackout/special-hour ranges, menu guest ranges, menu item/package presence, and preserving at least one active owner.
- Extended the Drizzle schema for vendor operations:
  - Added `vendor_operating_settings`.
  - Added `vendor_menus`, `vendor_menu_items`, and `vendor_menu_packages`.
  - Expanded `vendor_profiles` with owner contact, business phone/email, website URL, social links, average response time, business license metadata, and insurance metadata.
  - Generated migration `apps/api/src/db/migrations/0001_tricky_toxin.sql`.
- Added focused vendor tests with an in-memory vendor repository:
  - Owner can create/update vendor setup.
  - Viewer can read but cannot edit vendor-scoped resources.
  - Overlapping availability rules are rejected.
  - Empty menus are rejected.
  - Valid menus with items/packages can be created.
  - Platform admin can update billing settings and vendor owner can read the configured signed-agreement fee percentage.
- Added minimal web UI/API integration:
  - Added a root web app layout/home page.
  - Added `/vendor-operational-setup`, a development screen for calling cuisine, vendor creation, profile, availability, menu, and billing endpoints with a bearer token and vendor ID.
  - Added a small web API helper for vendor operations requests.
- Added the public marketplace discovery slice:
  - Registered public marketplace routes for active cuisines, vendor listing/search, and vendor profile reads.
  - Search now supports filters for cuisine, service area, service style, guest count, and budget maximum/minimum validation where the current schema supports reliable matching.
  - Public vendor visibility is limited to active, approved, published, non-deleted vendors; unpublished and suspended vendors are hidden from search and profile reads.
  - Public profiles expose approved marketplace data, service areas, service styles, catering minimums, planning fit, and public published menu previews while hiding draft/private menus.
  - Added focused in-memory marketplace tests for public search filtering and hidden unpublished/suspended vendors.
  - Added minimal Next.js marketplace UI: landing page search entry, `/marketplace`, `/vendors/[slug]`, `/rfq/start` stub, reusable `VendorCard` and `VendorProfile` components, API-unavailable states, no-results empty state, and RFQ CTAs.
- Added the RFQ backend lifecycle foundation:
  - Registered customer RFQ creation, customer RFQ list/detail, vendor RFQ inbox, vendor RFQ detail, target accept/reject, and clarification request API routes.
  - RFQ creation now captures event basics, venue/site logistics, service style and guest flow, food/dietary requirements, equipment expectations, budget/payment timing, special notes, and attachment metadata using the existing RFQ and flexible requirement tables.
  - General RFQs use deterministic vendor matching against approved/published vendors, service area, cuisine, service style, headcount, budget minimum, and blackout exceptions.
  - Specific RFQs validate selected vendors are active, approved, published, and available for RFQ targeting.
  - RFQ creation writes venue address, RFQ, requirement rows, vendor targets, message threads, status history, audit log, and `rfq.submitted` outbox event in one repository transaction.
  - Vendor accept/reject/clarification actions enforce active non-viewer vendor membership, update target/status state, write audit logs, and write `rfq.clarification_requested` outbox events when applicable.
  - RFQ responses include completeness score/status and risk flags for logistics, budget, timing, allergy, COI, parking, power/generator, weather backup, and permit review.
  - Added a small RFQ status state machine and focused in-memory tests for lifecycle transitions, validation gates, deterministic matching, audit/outbox writes, and vendor/customer authorization boundaries.
- Added the customer RFQ web experience:
  - Replaced the `/rfq/start` placeholder with a mobile-friendly guided RFQ wizard covering request type, event basics, venue/site logistics, service style/guest flow, cuisine/menu/food requirements, rentals/equipment/service supplies, budget/payment timing, attachments/special notes, and review/submit.
  - Added client-side validation that mirrors the backend DTO and service gates for UUID vendor IDs, 7-day lead time, event/service time ordering, service window within event window, required contact/venue/service/food/equipment/budget fields, budget min/max ordering, quote deadline before event start, and attachment metadata size/category/name requirements.
  - Added operator-friendly helper copy explaining why operators need headcount, service windows, venue access, parking, power/generator rules, permits, dietary/allergy information, equipment expectations, and budget ranges before quoting.
  - Added browser-local RFQ draft persistence with an explicit local save action because the current backend supports submitted RFQs but does not expose draft create/update APIs.
  - Added authenticated RFQ submission to `POST /api/v1/rfqs`, including support for general matching or selected vendor targets.
  - Added `/rfq/confirmation` with RFQ number, submission expectations, vendor targeting summary when available, and next-step links.
  - Added `/customer/dashboard` backed by `GET /api/v1/customers/me/rfqs` for active RFQ cards, completeness, budget, vendor targets, risk counts, and API-unavailable/token prompts.
  - Added `/customer/rfqs/[rfqId]` backed by `GET /api/v1/rfqs/:rfqId` for RFQ status, event summary, operational health, requirements sections, vendor responses, messages, status timeline, and clearly labeled deferred customer actions.
  - Added a shared web RFQ API helper and RFQ response/payload types in `apps/web/src/lib/rfq-api.ts`.
- Added the vendor RFQ triage and messaging slice:
  - Extended RFQ API DTOs, repository, routes, and service output to expose visible message threads, persisted messages, per-thread unread counts, and total unread message counts.
  - Added thread message endpoints for visible participants: `GET /api/v1/message-threads/:threadId/messages`, `POST /api/v1/message-threads/:threadId/messages`, and `POST /api/v1/message-threads/:threadId/read`.
  - Added basic read cursor persistence through the existing `thread_read_states` table and in-memory test repository.
  - Customer clarification replies now persist as messages and move RFQs from `clarification_requested` back to `vendor_reviewing`.
  - Vendor clarification requests now mark the sender read state in addition to writing the clarification message and outbox event.
  - Added `/vendor/dashboard` for RFQ action cards covering triage, clarification/unread, accepted review, and high-risk RFQs.
  - Added `/vendor/rfqs` with target-status, risk, city/state, and event-type filters, risk badges, quick accept/decline actions, and a Start Quote stub.
  - Added `/vendor/rfqs/[rfqId]` as the vendor event packet view with event basics, venue logistics, service style, food requirements, equipment, budget/timing, risk/completeness, accept/decline/clarify actions, messages, mark-read support, and a Start Quote stub.
  - Updated customer dashboard/detail messaging display so customers can see unread counts and answer vendor clarification requests from RFQ detail.
  - Added focused RFQ integration coverage for thread visibility, customer replies, unread/read behavior, cross-vendor thread denial, and customer/vendor authorization boundaries.
- Added the vendor quote creation, revision, and customer review slice:
  - Registered quote routes for `POST /api/v1/rfqs/:rfqId/quotes`, `GET /api/v1/rfqs/:rfqId/quotes`, `GET /api/v1/quotes/:quoteId`, `POST /api/v1/quotes/:quoteId/revisions`, `POST /api/v1/quotes/:quoteId/accept`, `POST /api/v1/quotes/:quoteId/decline`, and `POST /api/v1/quotes/:quoteId/request-revision`.
  - Added a dedicated quote module with DTO validation, server-side quote calculation, quote repository persistence, quote lifecycle service rules, audit/outbox writes, and app registration.
  - Quote creation now requires a vendor owner/manager on an accepted RFQ target, creates a sent quote/current revision, persists line items and payment schedule items, updates the RFQ through `quote_in_progress` to `quote_sent`, and marks the vendor target `quote_sent`.
  - Quote line items now support food, service, staffing, travel, rental, tax, gratuity, service charge, overtime, fee, and discount categories with unit, taxable, optional, and internal flags.
  - Quote totals are calculated server-side from customer-visible line items, with subtotal, fees, taxes, total, deposit, expiration, payment schedule sum, and deposit schedule validation.
  - Quote revisions are immutable: each revision stores its own line items, payment schedule items, totals, expiration, service/menu summary, assumptions, exclusions, cancellation policy summary, notes, and revision number while the quote points to the current revision.
  - Customer quote acceptance validates the current revision, rejects stale revision acceptance, checks expiration, marks competing quotes `not_selected`, and initially moves the RFQ to `accepted`; the later agreement phase now immediately generates an agreement draft and advances the RFQ to `agreement_pending`.
  - Customer decline and revision-request actions persist audit/outbox records and move quote-sent RFQs into `negotiation`.
  - Extended the Drizzle schema and generated migration `apps/api/src/db/migrations/0002_nifty_valkyrie.sql` for quote revision snapshots, richer line item metadata, and new quote line item enum values.
  - Added focused quote integration tests for server-side totals, payment schedule setup, revision immutability/history, vendor authorization, and stale revision acceptance.
  - Added `/vendor/rfqs/[rfqId]/quote` as a minimal authenticated vendor quote builder/revision page and linked it from vendor RFQ detail.
  - Added `/customer/quotes/[quoteId]` as a customer quote review page with summary, line items, payment schedule, assumptions/exclusions, revision history, accept, decline, and request-revision actions.
  - Customer RFQ detail now loads quote cards and links to quote review when quotes are available.
- Added the agreement generation, versioning, and customer signature slice:
  - Registered agreement routes for `GET /api/v1/agreements/:agreementId`, `POST /api/v1/agreements/:agreementId/generate`, `POST /api/v1/quotes/:quoteId/agreement`, `POST /api/v1/agreements/:agreementId/sign`, and `GET /api/v1/agreements/:agreementId/download-url`.
  - Added a dedicated agreement module with DTO validation, repository persistence, service authorization/status rules, generated term snapshots, file-record stubs, audit logs, outbox events, platform fee creation, and app registration.
  - Quote acceptance now creates or returns an idempotent agreement draft for the accepted current quote revision and moves the RFQ from `accepted` to `agreement_pending`.
  - Agreement term snapshots preserve event details, venue/logistics requirements, menu selections, customer-visible pricing, payment schedule, payment terms, cancellation policy, vendor requirements, and customer responsibilities.
  - Agreement versions are immutable records. Vendors can generate a new pending-signature version before signature; signed agreements reject regeneration and repeat signatures.
  - Customer signature validates RFQ customer ownership, current agreement version, required acknowledgements, typed legal name, IP/user-agent/request metadata, and then moves the RFQ to `agreement_signed`.
  - Signing creates a signed document file-record stub and a platform agreement fee record from vendor billing settings when the billing foundation is present.
  - Agreement responses return the next payment action for the due deposit schedule item, but no Stripe Checkout/payment collection was built.
  - Added `/customer/agreements/[agreementId]` as a minimal authenticated customer agreement review/signature page with document snapshot display, acknowledgements, typed-name signing, download URL stub retrieval, and next payment action display.
  - Customer quote review and RFQ detail now link to the generated agreement when a quote has been accepted.
  - Added focused agreement integration tests for stale version signing, customer-only signature authorization, signed agreement immutability, RFQ status transition, signed metadata, next payment action, and platform fee creation.
- Added the platform monetization billing and caterer invoicing slice:
  - Added a dedicated billing module with DTO validation, repository, service, routes, fee-calculation helper, admin billing summary, vendor billing summary, and vendor invoice generation.
  - Vendor billing settings continue to store the signed-agreement fee percentage as basis points with no fee amount cap; admin setting updates now write an audit log entry.
  - Agreement signing now uses the shared platform fee calculation helper and keeps one platform agreement fee record per signed agreement through the existing agreement-level uniqueness/idempotency guard.
  - Platform billing summaries expose pending agreement fees, the signed agreement total used for fee calculation, fee basis points, issued vendor invoices, line items, and totals while remaining separate from customer deposits and customer payment schedules.
  - Admins can generate issued vendor invoices for billable pending platform fees by vendor and billing period; generated invoices create line items, mark included fees as invoiced, emit an outbox event, and return the existing invoice on repeated generation for the same vendor/period.
  - Issued invoice line items preserve the original fee amount and basis points; later billing setting changes do not mutate existing fee records or invoiced line items.
  - Added the `adjusted` vendor invoice status value and generated migration `apps/api/src/db/migrations/0003_clumsy_skreet.sql`.
  - Added `/admin/platform-billing` for admin billing settings, pending fee review, and invoice generation.
  - Added `/vendor/platform-billing` for vendor visibility into fee percentage, pending fees, and issued platform invoices.
  - Added focused tests for fee calculation, no cap behavior, billing setting changes after signature, invoice generation, and immutability after invoice issuance.
- Added the in-app customer deposit collection slice:
  - Added a payments module with DTOs, routes, repository, service, Stripe wrapper, app wiring, and an in-memory payment repository for tests.
  - Registered Stripe Connect onboarding link creation at `POST /api/v1/vendors/:vendorId/stripe-connect/onboarding-link` for vendor owners.
  - Extended vendor records with Stripe readiness fields for account ID, charges enabled, payouts enabled, details submitted, and disabled reason; generated migration `apps/api/src/db/migrations/0004_mean_riptide.sql`.
  - Added deposit checkout session creation at `POST /api/v1/payments/deposits/checkout-session`, using signed agreement payment schedule amounts only and requiring an `Idempotency-Key`.
  - Added Stripe webhook handling at `POST /api/v1/webhooks/stripe` with signature verification through the Stripe wrapper, event persistence, duplicate event handling, and idempotent success/failure processing.
  - Persisted payment records, payment attempts, and webhook events; successful deposit webhooks mark the schedule item paid, payment succeeded, and RFQ `deposit_paid`.
  - Added customer payment lookup at `GET /api/v1/payments/:paymentId` and vendor payment status at `GET /api/v1/vendors/:vendorId/payments`.
  - Added `/customer/payments/deposits/[agreementId]` for loading signed agreement deposit due, creating Checkout sessions, and showing retry/failure states.
  - Added `/vendor/payments` for Stripe readiness/onboarding and customer payment status display, while linking platform billing separately.
  - Added mocked Stripe payment tests for onboarding/readiness, checkout creation idempotency, successful webhook idempotency, failed payment handling, and duplicate webhook events.
- Added the scheduling and operational event management slice:
  - Added a dedicated scheduling module with DTOs, repository, service, routes, app wiring, and an in-memory scheduling repository for tests.
  - Confirmed catering events and linked vendor calendar events are generated idempotently from signed agreements once required deposit conditions are satisfied.
  - Successful deposit webhook handling now moves RFQs through `deposit_paid` to `confirmed`, creates confirmed catering/calendar records, writes status history, audit logs, and outbox events, and keeps duplicate webhook/event processing idempotent.
  - Added unique generated migration support for one catering event per agreement and one calendar event per catering event.
  - Added vendor calendar endpoints for month/week/day/agenda/timeline data at `GET /api/v1/vendors/:vendorId/calendar-events`.
  - Added manual event creation at `POST /api/v1/vendors/:vendorId/calendar-events` for manual bookings, blocked time, festivals, and public food truck operating locations.
  - Added conflict and warning detection for overlapping confirmed catering events, blocked time/blocking manual events, overlapping non-blocking events, and tight setup/travel buffers based on vendor operating settings.
  - Added event operations detail at `GET /api/v1/vendors/:vendorId/calendar-events/:eventId/operations` with run-sheet data for contacts, venue logistics, agreed menu, staffing notes, prep notes, equipment checklist, payment status, documents, internal notes, and warnings.
  - Added `/vendor/calendar` for calendar views, manual event creation, warnings, and run-sheet links.
  - Added `/vendor/events/[eventId]` for the event operations run sheet.
  - Added focused scheduling tests for idempotent confirmed event generation, conflict/setup-buffer warnings, calendar view API, and operations run-sheet API.
  - Updated payment tests to verify successful deposit webhooks create confirmed calendar operations.
- Added the notification infrastructure and worker processing slice:
  - Added a dedicated notifications module with DTOs, repository, service, routes, a development email provider, and app wiring.
  - Implemented worker-safe outbox claiming using PostgreSQL `FOR UPDATE SKIP LOCKED`, status transitions from pending/failed to processing/processed/dead-letter, exponential retry scheduling, and max-attempt dead-letter handling.
  - Added canonical notification handlers for `rfq.submitted`, `rfq.clarification_requested`, `quote.sent`, `quote.accepted`, `agreement.ready`, `agreement.signed`, `payment.deposit_paid`, `event.confirmed`/existing `calendar.confirmed_event_created`, and `platform_fee.created`.
  - Added in-app notification list/unread/read APIs and notification preference APIs at `/api/v1/notifications` and `/api/v1/notification-preferences`.
  - Added email delivery adapter interfaces plus a development/mock provider, with `notification_deliveries` rows tracking sent/skipped/failed attempts.
  - Added notification idempotency by linking notifications to outbox events and enforcing one delivery row per notification/channel; generated migration `apps/api/src/db/migrations/0006_chemical_big_bertha.sql`.
  - Replaced the worker foundation stub with a polling worker process that processes notification outbox batches and added API package worker scripts.
  - Added `/notifications` as a minimal notification center UI for loading notifications, unread counts, mark-read actions, mark-all-read, and email/in-app preference display/toggles.
  - Added focused notification tests for outbox claiming, transient retries, dead-letter behavior, duplicate event idempotency, and preference behavior.
- Added the admin portal MVP slice:
  - Added a dedicated admin backend module with DTOs, repository, service, routes, app wiring, and an in-memory test repository.
  - Registered admin dashboard, vendor review, vendor approve/reject/request-changes, marketplace visibility moderation, RFQ review, RFQ admin notes, RFQ dispute status, payment monitoring, and Stripe webhook diagnostics endpoints under `/api/v1/admin`.
  - Enforced admin authorization boundaries: platform and support admins can read operations views, while platform admins are required for vendor approval/moderation and RFQ dispute/note writes.
  - Vendor approval now can approve, reject, or request changes; approval publishes the vendor for marketplace visibility, rejection/request-changes hide the profile, and marketplace moderation can publish/hide or suspend/reactivate visibility state without deleting vendor records.
  - Sensitive admin reads and writes now create audit log rows for vendor detail reads, RFQ detail reads, RFQ notes/dispute status, payment monitoring reads, Stripe webhook diagnostics reads, vendor approval decisions, and marketplace visibility changes.
  - Admin RFQ review exposes RFQ summary, requirements, status history, targets, messages, quotes, agreements, payments, and audit activity for support workflows.
  - Admin payment monitoring exposes payment status, attempts, failure codes/messages, RFQ context, vendor context, and failed Stripe webhook records for operational visibility.
  - Added `/admin` as a minimal admin operations console for dashboard loading, vendor approval/moderation actions, RFQ/dispute review actions, payment monitoring, and Stripe webhook diagnostics.
  - Linked the existing `/admin/platform-billing` page from the admin portal and root page so the already-built platform billing settings, pending fee review, and invoice generation tools remain part of the admin surface.
  - Added focused admin integration tests for authorization, support-admin read/platform-admin write boundaries, vendor decision auditing, marketplace visibility auditing, RFQ dispute review, payment monitoring, webhook failure visibility, and dashboard counts.
- Added the durable file/document storage slice:
  - Added a shared storage adapter interface plus local development disk storage and S3-compatible storage adapter implementations.
  - Added environment configuration for storage provider, local storage root, bucket, signed URL TTL, signing secret, and S3-compatible endpoint/credential settings.
  - Added a dedicated storage module with DTO validation, repository, service, routes, and app wiring for JSON/base64 MVP uploads and signed download URL issuance.
  - Added upload support for RFQ attachments, vendor images, menu files, vendor documents, agreement documents, and signed agreement documents with server-side file size/type metadata validation.
  - Enforced file access authorization for private files through owner, RFQ participant, agreement participant, vendor membership, and admin visibility checks before signed URLs are created.
  - Agreement draft/signed document stubs now write stored file records through the storage service when storage is configured; signed agreement output uses a minimal generated PDF placeholder rather than a full PDF design system.
  - Added local signed download handling for development storage and short-lived S3-compatible signed download URLs for object storage.
  - Added vendor document center API support at `/api/v1/vendors/:vendorId/documents`.
  - Added `/vendor/documents` as a minimal vendor document center UI for listing vendor files and requesting signed download URLs.
  - Added focused storage integration tests for private RFQ attachment visibility, signed agreement document authorization, vendor document center listing, and agreement document access audit logging.
- Added the UI flow alignment slice:
  - Audited the current Next.js page inventory against all documented functional page sections and kept changes scoped to UI route/page-state alignment.
  - Added a shared application navigation shell with public, customer, vendor, and admin groups so marketplace, RFQ, customer account, vendor operations, and admin pages are reachable consistently.
  - Added global mobile/tablet CSS defaults for the existing inline-styled pages, including responsive main widths, single-column grids on narrow screens, inherited form typography, and disabled button affordances.
  - Expanded the public landing and marketplace discovery UI with event date entry, vendor onboarding CTA, clearer cuisine/event/service positioning, budget min/max entry, richer search helper copy, visible-vendor multi-RFQ entry, and no-instant-booking availability language.
  - Added route-level MVP pages for `/vendor/onboarding`, `/vendor/menus`, and `/vendor/availability` so documented vendor setup, menu management, and availability/operating settings flows are represented in the vendor navigation.
  - Improved public vendor cards/profiles with dietary/menu visibility, response/availability expectation copy, service/event fit, and operational requirement guidance before RFQ submission.
  - Improved customer dashboard filtering by status, event date, and vendor, updated customer action-item copy, and removed stale deferred language for quote/agreement/deposit flows that now exist.
  - Updated vendor dashboard/inbox/detail copy so quote creation is treated as available, added operator-first no-RFQ guidance, linked Start Quote from the RFQ inbox, and added clarification templates on RFQ detail.
  - Clarified customer quote, agreement, and deposit payment copy so customer-visible totals come from vendor event charges and do not include foodtruckzs platform agreement billing.
  - Added a lightweight navigation UI test using Node's test runner through `tsx` without adding a browser test stack.
- Added the MVP production readiness hardening slice:
  - Added configurable in-memory API rate limiting for auth register/login/refresh, RFQ submission, RFQ-scoped messaging, Stripe Connect onboarding link creation, and deposit checkout session creation.
  - Kept rate-limit responses inside the centralized error envelope with `RATE_LIMITED`, request IDs, retry metadata, and standard rate-limit headers.
  - Tightened CORS behavior to only echo configured origins while continuing to allow same-origin/server-side requests without an `Origin` header.
  - Added unit coverage for RFQ lifecycle transitions, quote calculations, payment schedule totals, platform fee basis-point calculations, conflict detection warnings, and shared authorization policy helpers.
  - Added integration hardening coverage for consistent API error responses, inbound request ID correlation, security headers, strict CORS behavior, request body limits, auth rate limiting, RFQ submission rate limiting, messaging rate limiting, and payment creation rate limiting.
  - Expanded quote integration tests to reject payment schedules that do not sum to the quote total or match required deposit amounts.
  - Expanded payment webhook coverage so duplicate Stripe events and follow-on `payment_intent.succeeded` replays do not duplicate deposit status history or confirmed calendar events.
  - Expanded platform billing idempotency coverage so repeat agreement-sign attempts do not create duplicate platform agreement fee records, and existing invoice generation idempotency coverage remains in place.
- Added the GoDaddy VPS deployment preparation slice:
  - Added a production environment template covering public URLs, local process bindings, PostgreSQL, auth secrets, rate limits, Stripe, email, object storage, worker tuning, backups, and smoke-test configuration.
  - Added a PM2 ecosystem config for `foodtruckzs-web`, `foodtruckzs-api`, and `foodtruckzs-worker`, using the current release directory and local-only ports behind Apache2.
  - Added an Apache2 reverse proxy example with HTTP-to-HTTPS redirect, SSL placeholders, secure headers, body-size limit, frontend proxying, API proxying, and public `/api/healthz` and `/api/readyz` mappings.
  - Added deploy scripts for encrypted/offsite-ready PostgreSQL `pg_dump` backups, health/readiness smoke tests, server-side release deployment, and SSH-triggered deployment.
  - Added the root production migration command `pnpm db:migrate:prod`, which delegates to the API package Drizzle migration script.
  - Added a manual GitHub Actions production deployment workflow that runs typecheck, lint, tests, build, then deploys over SSH using repository secrets.
  - Added `docs/production-runbook.md` with first-time VPS setup, deployment, migration, rollback, restart, backup restore, smoke test, and log inspection procedures.
- Added the final MVP route-level verification slice:
  - Added `apps/api/src/tests/integration/mvp-e2e.test.ts` to run the MVP happy path through the HTTP route layer with in-memory repositories and a mocked Stripe client.
  - Verified vendor signup/setup, profile creation, public menu creation, availability configuration, Stripe Connect onboarding/readiness, admin billing settings, and admin vendor approval.
  - Verified customer marketplace search, RFQ submission, vendor clarification request, customer clarification reply, vendor RFQ acceptance, quote send, customer quote acceptance, generated agreement signature, and platform signed-agreement fee creation.
  - Verified caterer platform invoice generation, customer deposit checkout without a foodtruckzs application fee deduction, successful Stripe webhook processing, confirmed booking creation, vendor calendar visibility, vendor event operations run sheet, vendor payment visibility, and admin vendor/RFQ/payment review.
  - No MVP-blocking product defects were found during the final route-level verification.

## Decisions Made

- Use a pnpm monorepo because the architecture docs recommend a small-team monorepo with shared TypeScript types and validation schemas.
- Use `apps/web`, `apps/api`, and `packages/shared` to match the architecture and technical design docs.
- Keep app shells health-only in this phase to avoid prematurely implementing auth, RFQs, payments, agreements, or UI pages.
- Use TypeScript strict mode from the start.
- Use ESLint flat config and Prettier at the root so package checks share one baseline.
- Use Fastify for the API shell and Next.js for the web shell per the architecture decision.
- Use pino-backed Fastify structured logging with redaction for sensitive headers and secret-like fields.
- Use Zod for environment validation and route/controller DTO validation helpers.
- Use Drizzle with `postgres` as the PostgreSQL driver.
- Keep auth, Stripe, object storage, RFQs, marketplace, payments, agreements, and other product workflows for later phases even though their database foundations now exist.
- Use one broad initial `public` schema migration for MVP tables, with domain grouping in the Drizzle schema source.
- Keep implementation schema-only in this phase; no API routes, services, repositories, UI, Stripe calls, auth token issuance, or business state machines were added.
- Use PostgreSQL enums for stable lifecycle/status fields and check constraints for hard invariants such as valid time ranges, non-negative money fields, unique quote per RFQ/vendor, unique Stripe webhook event IDs, and non-negative platform fee basis points.
- Store flexible snapshots and metadata as JSONB only where the docs call for snapshots, arrays, provider metadata, or future shape flexibility.
- Use Argon2id for password hashing and keep password verification behind a small service interface.
- Use opaque refresh tokens rather than refresh JWTs so sessions can be invalidated server-side.
- Store refresh-token hashes with an HMAC secret, rotate on every refresh, and revoke the whole token family on detected reuse.
- Keep access tokens short-lived and validate session/user state on every authenticated request so logout and admin/user suspension can take effect before JWT expiry.
- Keep auth tests database-independent with an in-memory auth repository while preserving a Drizzle repository for production persistence.
- Keep vendor operations in a dedicated backend module with DTOs, repository, service, and routes rather than mixing setup logic into auth.
- Keep RFQ submission, RFQ triage, quote builder, marketplace search pages, Stripe Connect onboarding, payments, and agreement workflows deferred from the vendor setup phase.
- Use owner/manager for vendor operational writes, any active vendor member for safe setup reads, owner-only for membership removal/vendor closure, and platform-admin-only for billing fee writes.
- Store vendor signed-agreement fee percentages as basis points in `vendor_billing_settings`; vendors can read the configured percentage, while admins can update it.
- Keep the new web setup page as a development/API exercise surface, not a polished onboarding flow.
- Keep public marketplace discovery in a dedicated backend module that reads existing vendor setup data instead of duplicating vendor profile state.
- Treat `status = active`, `approval_status = approved`, `is_published = true`, and `deleted_at IS NULL` as the public marketplace visibility gate; suspended, closed, pending, rejected, unpublished, and deleted vendors are not publicly discoverable.
- Use public, published menus only for marketplace profile/menu previews; draft, archived, private, unavailable, and deleted menu content stays hidden.
- Budget filtering currently uses vendor catering minimums and validates the requested range because the schema does not yet model full event quote estimates.
- Keep marketplace CTAs linked to `/rfq/start` with selected vendor IDs, but leave the RFQ multi-step form and submission backend deferred.
- Keep RFQ backend lifecycle in a dedicated module with DTO, repository, service, route, and state-machine files; detailed page-flow data is stored as typed JSON requirement sections until more specialized RFQ tables are justified.
- Keep RFQ attachment support metadata-only for this phase; direct upload, object storage, and file authorization flows remain deferred.
- Treat vendor clarification requests as RFQ lifecycle actions backed by the existing message thread/message tables, without building the broader messaging UI yet.
- Keep quote builder, agreements, payments, Stripe, and calendar booking transitions deferred after RFQ triage.
- Keep customer RFQ draft persistence local in the browser until a backend draft lifecycle exists; do not simulate drafts by creating submitted RFQs.
- Keep the current customer RFQ frontend as an authenticated API exercise surface that accepts a bearer token because polished customer auth/account UI is not implemented yet.
- Keep attachment handling metadata-only in the customer RFQ flow until object storage, direct upload, signed URL, authorization, and virus scanning support are implemented.
- Keep customer dashboard and RFQ detail focused on available RFQ APIs; customer clarification replies are now supported, while quote cards, cancellation, agreement, and payment actions remain stubs/deferred.
- Keep RFQ thread messaging in the RFQ module for this phase because threads are currently scoped one-to-one to RFQ vendor targets; a dedicated messaging module can be extracted when standalone inboxes, templates, attachments, and notifications are built.
- Use the existing `thread_read_states` cursor table for MVP unread counts instead of per-message read receipts.
- Keep vendor RFQ web pages as authenticated API exercise surfaces that accept a bearer token and vendor ID until polished vendor auth/account switching exists.
- Keep quote creation/pricing/revisions deferred; vendor pages expose only a disabled Start Quote CTA/stub.
- Keep Stripe payment collection deferred from the agreement phase; quote acceptance now creates an agreement draft instead of stopping at RFQ `accepted`.
- Store deposit/down-payment and balance timing as `payment_schedule_items` tied to quote revisions in this phase, but do not create payment records or checkout sessions until the payment phase.
- Use immutable quote revisions as the quote source of truth; edits create a new revision and update `quotes.current_revision_id` instead of mutating prior revision rows.
- Keep customer revision requests as audited/outbox lifecycle events for now; a richer structured negotiation object or message-thread integration can be added when standalone quote negotiation polish is prioritized.
- Generate the MVP agreement draft automatically after quote acceptance rather than requiring a separate customer-visible action, while keeping an idempotent quote-to-agreement generation endpoint for recovery.
- Use the accepted quote revision and generated agreement version as immutable agreement sources of truth; signed agreements cannot be regenerated or re-signed in this phase.
- Use `files` rows with `storage_provider = "stub"` for draft and signed agreement document hooks until real object storage/PDF generation is implemented.
- Create the platform agreement fee record at customer signature time from `vendor_billing_settings.agreement_fee_basis_points`; this remains separate from customer deposits and does not use Stripe application fees.
- Return the next due deposit schedule item as a server-owned next payment action after signature, but leave Stripe Checkout/payment records for the next payment phase.
- Keep platform billing in a dedicated backend module instead of adding invoice-generation behavior to customer payment code.
- Generate platform invoices directly as `issued` records for this MVP billing workflow, with line items tied to platform fee records and repeated vendor/period generation returning the existing invoice.
- Preserve fee immutability after invoice issuance by snapshotting signed agreement total, fee basis points, and fee amount on `platform_agreement_fees` and invoice line metadata; corrections should use future adjustment or credit line items.
- Keep zero-dollar platform fee records visible as pending billing records but exclude zero-amount fees from invoice line item generation because invoice line items enforce non-zero amounts.
- Keep Stripe account readiness on the existing `vendors` table for this phase, matching the previous decision to represent Stripe account identity there instead of introducing the deferred `vendor_stripe_accounts` table.
- Require vendor Stripe `charges_enabled` and `details_submitted` before creating customer deposit checkout sessions; store `payouts_enabled` separately because payout readiness is visible to vendors but not required to collect the deposit.
- Use Stripe Checkout direct connected-account sessions with no Stripe application fee configured so customer deposits remain caterer payments and do not deduct foodtruckzs signed-agreement fees.
- Require `Idempotency-Key` on deposit checkout creation and store it on payment attempts so duplicate customer clicks return the original payment attempt/session instead of creating another Stripe Checkout session.
- Treat Stripe webhooks as final payment truth for `succeeded` and `failed` deposit outcomes; checkout creation only moves the local payment to `checkout_created`.
- Move RFQs from `agreement_signed` to `deposit_paid` after confirmed required deposit payment, then create the confirmed catering/calendar event and advance the RFQ to `confirmed`.
- Keep confirmed catering event generation server-owned and idempotent; frontend users can create only manual calendar event types.
- Treat overlapping confirmed catering, blocked time, and blocking manual events as hard conflict warnings in this MVP rather than failing deposit webhooks after money has already succeeded.
- Use vendor operating settings `defaultSetupMinutes` and `defaultTravelBufferMinutes` to generate advisory setup/travel buffer warnings without maps-based route optimization.
- Derive the event operations run sheet from the confirmed calendar event, signed agreement snapshot/context, RFQ requirements, quote line items, payment schedule, and payment records; full editable staffing scheduler and persisted checklist completion remain deferred.
- Keep notifications in a dedicated backend module instead of distributing delivery logic across RFQ, quote, agreement, payment, billing, and scheduling services.
- Treat `outbox_events` as the retry/dead-letter unit; `notification_deliveries` record per-channel outcomes for diagnostics and idempotency.
- Use one canonical notification type for event confirmations (`event.confirmed`) while accepting the existing scheduling outbox event name `calendar.confirmed_event_created`.
- Keep in-app transactional notifications required for now, while allowing email delivery preferences to be disabled per notification type.
- Use a development email provider that records mock provider message IDs; production email provider credentials and vendor selection remain future integration work.
- Do not add SMS in this phase because in-app notifications, email adapter plumbing, worker processing, retries, preferences, and tests are now the completed notification foundation.
- Keep durable file handling in a dedicated storage module instead of scattering storage calls across RFQs, vendors, menus, agreements, and scheduling.
- Use server-proxied JSON/base64 uploads for this MVP phase because it avoids multipart/direct-upload complexity while still enforcing authorization, metadata validation, and durable adapter-backed writes.
- Keep the existing `files` table as the metadata model because it already stores provider, bucket, object key, content type, size, checksum, visibility, owner, vendor scope, status, and JSON metadata needed for the current phase.
- Store file purpose and entity links such as `rfqId`, `agreementId`, `menuId`, and `fileName` in `files.metadata` for this phase rather than introducing specialized attachment join tables before workflows need richer document-specific state.
- Use local disk storage only for development through signed local download URLs; private production files should use S3-compatible object storage with short-lived signed URLs.
- Treat vendor images as public by default, while RFQ attachments, agreement documents, signed agreements, vendor documents, and menu files default to private unless a menu/image use case explicitly requests public visibility.
- Generate only a minimal signed agreement PDF placeholder during signature so storage and authorization are complete before investing in a full PDF design system.
- Audit signed agreement/document download URL issuance with `audit_logs` so document access history has a durable MVP record.
- Keep deployment automation VPS-native for the initial production target: release directories, a `current` symlink, PM2 process reloads, Apache2 reverse proxying, and PostgreSQL running on the same server.
- Run `pg_dump` before production migrations and prefer forward database fixes over destructive rollbacks, matching the failure recovery design.
- Expose public health checks through Apache as `/api/healthz` and `/api/readyz` while leaving the Fastify health routes unchanged at `/healthz` and `/readyz`.
- Use a manually triggered production deployment workflow so deployment requires an intentional operator action and configured GitHub environment/secrets.
- Keep the filled production environment file outside the repository at `/etc/foodtruckzs/foodtruckzs.env`.
- Treat the route-level MVP happy-path test as the final launch-readiness verification for product workflow completeness in this workspace because no live PostgreSQL, real Stripe account, browser E2E stack, or production VPS credentials are configured here.
- Keep access tokens hidden in browser session storage behind the shared account panel; customer, vendor, notification, and admin pages should ask users to log in/select an account instead of pasting bearer tokens.

## Files Changed

- `.editorconfig`
- `.env.example`
- `.github/workflows/deploy.yml`
- `.gitignore`
- `.prettierrc.json`
- `README.md`
- `.prettierignore`
- `eslint.config.mjs`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/api/drizzle.config.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/app.ts`
- `apps/api/src/modules/admin/admin.dto.ts`
- `apps/api/src/modules/admin/admin.repository.ts`
- `apps/api/src/modules/admin/admin.routes.ts`
- `apps/api/src/modules/admin/admin.service.ts`
- `apps/api/src/config/logger.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/db/client.ts`
- `apps/api/src/db/schema/index.ts`
- `apps/api/src/modules/auth/auth.dto.ts`
- `apps/api/src/modules/agreements/agreements.dto.ts`
- `apps/api/src/modules/agreements/agreements.repository.ts`
- `apps/api/src/modules/agreements/agreements.routes.ts`
- `apps/api/src/modules/agreements/agreements.service.ts`
- `apps/api/src/modules/billing/billing-calculation.ts`
- `apps/api/src/modules/billing/billing.dto.ts`
- `apps/api/src/modules/billing/billing.repository.ts`
- `apps/api/src/modules/billing/billing.routes.ts`
- `apps/api/src/modules/billing/billing.service.ts`
- `apps/api/src/modules/auth/auth.errors.ts`
- `apps/api/src/modules/auth/auth.repository.ts`
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.types.ts`
- `apps/api/src/modules/auth/password.service.ts`
- `apps/api/src/modules/auth/token.service.ts`
- `apps/api/src/modules/marketplace/marketplace.dto.ts`
- `apps/api/src/modules/marketplace/marketplace.repository.ts`
- `apps/api/src/modules/marketplace/marketplace.routes.ts`
- `apps/api/src/modules/marketplace/marketplace.service.ts`
- `apps/api/src/modules/notifications/email-provider.ts`
- `apps/api/src/modules/notifications/notifications.dto.ts`
- `apps/api/src/modules/notifications/notifications.repository.ts`
- `apps/api/src/modules/notifications/notifications.routes.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/payments/payments.dto.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/payments/payments.routes.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/scheduling/scheduling.dto.ts`
- `apps/api/src/modules/scheduling/scheduling.repository.ts`
- `apps/api/src/modules/scheduling/scheduling.routes.ts`
- `apps/api/src/modules/scheduling/scheduling.service.ts`
- `apps/api/src/modules/storage/storage.dto.ts`
- `apps/api/src/modules/storage/storage.repository.ts`
- `apps/api/src/modules/storage/storage.routes.ts`
- `apps/api/src/modules/storage/storage.service.ts`
- `apps/api/src/shared/storage/local-storage.adapter.ts`
- `apps/api/src/shared/storage/s3-compatible.adapter.ts`
- `apps/api/src/shared/storage/storage-adapter.ts`
- `apps/api/src/modules/quotes/quote-calculation.ts`
- `apps/api/src/modules/quotes/quotes.dto.ts`
- `apps/api/src/modules/quotes/quotes.repository.ts`
- `apps/api/src/modules/quotes/quotes.routes.ts`
- `apps/api/src/modules/quotes/quotes.service.ts`
- `apps/api/src/modules/rfqs/rfq-state-machine.ts`
- `apps/api/src/modules/rfqs/rfqs.dto.ts`
- `apps/api/src/modules/rfqs/rfqs.repository.ts`
- `apps/api/src/modules/rfqs/rfqs.routes.ts`
- `apps/api/src/modules/rfqs/rfqs.service.ts`
- `apps/api/src/modules/vendors/vendors.dto.ts`
- `apps/api/src/modules/vendors/vendors.repository.ts`
- `apps/api/src/modules/vendors/vendors.routes.ts`
- `apps/api/src/modules/vendors/vendors.service.ts`
- `apps/api/src/shared/auth/authenticate.ts`
- `apps/api/src/shared/auth/require-role.ts`
- `apps/api/src/shared/auth/require-vendor.ts`
- `apps/api/src/tests/fakes/in-memory-auth-repository.ts`
- `apps/api/src/tests/fakes/in-memory-agreement-repository.ts`
- `apps/api/src/tests/fakes/in-memory-admin-repository.ts`
- `apps/api/src/tests/fakes/in-memory-billing-repository.ts`
- `apps/api/src/tests/fakes/in-memory-marketplace-repository.ts`
- `apps/api/src/tests/fakes/in-memory-notification-repository.ts`
- `apps/api/src/tests/fakes/in-memory-payment-repository.ts`
- `apps/api/src/tests/fakes/in-memory-quote-repository.ts`
- `apps/api/src/tests/fakes/in-memory-rfq-repository.ts`
- `apps/api/src/tests/fakes/in-memory-scheduling-repository.ts`
- `apps/api/src/tests/fakes/in-memory-storage-repository.ts`
- `apps/api/src/tests/fakes/in-memory-vendor-repository.ts`
- `apps/api/src/tests/integration/auth.test.ts`
- `apps/api/src/tests/integration/agreements.test.ts`
- `apps/api/src/tests/integration/admin.test.ts`
- `apps/api/src/tests/integration/marketplace.test.ts`
- `apps/api/src/tests/integration/mvp-e2e.test.ts`
- `apps/api/src/tests/integration/notifications.test.ts`
- `apps/api/src/tests/integration/payments.test.ts`
- `apps/api/src/tests/integration/quotes.test.ts`
- `apps/api/src/tests/integration/rfqs.test.ts`
- `apps/api/src/tests/integration/scheduling.test.ts`
- `apps/api/src/tests/integration/storage.test.ts`
- `apps/api/src/tests/integration/vendors.test.ts`
- `apps/api/src/db/migrations/0000_nasty_leopardon.sql`
- `apps/api/src/db/migrations/0001_tricky_toxin.sql`
- `apps/api/src/db/migrations/0002_nifty_valkyrie.sql`
- `apps/api/src/db/migrations/0003_clumsy_skreet.sql`
- `apps/api/src/db/migrations/0004_mean_riptide.sql`
- `apps/api/src/db/migrations/0005_overconfident_gravity.sql`
- `apps/api/src/db/migrations/0006_chemical_big_bertha.sql`
- `apps/api/src/db/migrations/meta/_journal.json`
- `apps/api/src/db/migrations/meta/0000_snapshot.json`
- `apps/api/src/db/migrations/meta/0001_snapshot.json`
- `apps/api/src/db/migrations/meta/0002_snapshot.json`
- `apps/api/src/db/migrations/meta/0003_snapshot.json`
- `apps/api/src/db/migrations/meta/0004_snapshot.json`
- `apps/api/src/db/migrations/meta/0005_snapshot.json`
- `apps/api/src/db/migrations/meta/0006_snapshot.json`
- `apps/api/src/db/transaction.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/server.ts`
- `apps/api/src/shared/errors/app-error.ts`
- `apps/api/src/shared/errors/error-codes.ts`
- `apps/api/src/shared/errors/error-handler.ts`
- `apps/api/src/shared/middleware/rate-limit.ts`
- `apps/api/src/shared/middleware/request-context.ts`
- `apps/api/src/shared/stripe/stripe-client.ts`
- `apps/api/src/shared/validation/zod.ts`
- `apps/api/src/tests/integration/api-hardening.test.ts`
- `apps/api/src/tests/integration/health.test.ts`
- `apps/api/src/tests/integration/schema-constraints.test.ts`
- `apps/api/src/tests/test-env.ts`
- `apps/api/src/tests/unit/domain-rules.test.ts`
- `apps/api/src/tests/unit/env.test.ts`
- `apps/api/src/tests/unit/validation.test.ts`
- `apps/api/vitest.config.ts`
- `apps/api/src/workers/worker.ts`
- `apps/web/package.json`
- `apps/web/next-env.d.ts`
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/platform-billing/page.tsx`
- `apps/web/src/app/api/health/route.ts`
- `apps/web/src/app/marketplace/page.tsx`
- `apps/web/src/app/notifications/page.tsx`
- `apps/web/src/app/notifications/notification-center.tsx`
- `apps/web/src/app/rfq/start/page.tsx`
- `apps/web/src/app/rfq/start/rfq-wizard.tsx`
- `apps/web/src/app/rfq/confirmation/page.tsx`
- `apps/web/src/app/rfq/confirmation/rfq-confirmation.tsx`
- `apps/web/src/app/customer/dashboard/page.tsx`
- `apps/web/src/app/customer/dashboard/customer-dashboard.tsx`
- `apps/web/src/app/customer/rfqs/[rfqId]/page.tsx`
- `apps/web/src/app/customer/rfqs/[rfqId]/customer-rfq-detail.tsx`
- `apps/web/src/app/customer/quotes/[quoteId]/page.tsx`
- `apps/web/src/app/customer/quotes/[quoteId]/customer-quote-review.tsx`
- `apps/web/src/app/customer/agreements/[agreementId]/page.tsx`
- `apps/web/src/app/customer/agreements/[agreementId]/customer-agreement-review.tsx`
- `apps/web/src/app/customer/payments/deposits/[agreementId]/page.tsx`
- `apps/web/src/app/customer/payments/deposits/[agreementId]/customer-deposit-payment.tsx`
- `apps/web/src/app/vendor/rfq-shared.ts`
- `apps/web/src/app/vendor/dashboard/page.tsx`
- `apps/web/src/app/vendor/dashboard/vendor-dashboard.tsx`
- `apps/web/src/app/vendor/availability/page.tsx`
- `apps/web/src/app/vendor/calendar/page.tsx`
- `apps/web/src/app/vendor/documents/page.tsx`
- `apps/web/src/app/vendor/documents/vendor-document-center.tsx`
- `apps/web/src/app/vendor/menus/page.tsx`
- `apps/web/src/app/vendor/onboarding/page.tsx`
- `apps/web/src/app/vendor/events/[eventId]/page.tsx`
- `apps/web/src/app/vendor/events/[eventId]/vendor-event-operations.tsx`
- `apps/web/src/app/vendor/platform-billing/page.tsx`
- `apps/web/src/app/vendor/payments/page.tsx`
- `apps/web/src/app/vendor/rfqs/page.tsx`
- `apps/web/src/app/vendor/rfqs/vendor-rfq-inbox.tsx`
- `apps/web/src/app/vendor/rfqs/[rfqId]/page.tsx`
- `apps/web/src/app/vendor/rfqs/[rfqId]/vendor-rfq-detail.tsx`
- `apps/web/src/app/vendor/rfqs/[rfqId]/quote/page.tsx`
- `apps/web/src/app/vendor/rfqs/[rfqId]/quote/vendor-quote-builder.tsx`
- `apps/web/src/app/vendors/[slug]/page.tsx`
- `apps/web/src/app/vendor-operational-setup/page.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/auth-session-panel.tsx`
- `apps/web/src/components/marketplace/vendor-card.tsx`
- `apps/web/src/components/marketplace/vendor-profile.tsx`
- `apps/web/src/components/navigation.ts`
- `apps/web/src/components/navigation.test.ts`
- `apps/web/src/lib/marketplace-api.ts`
- `apps/web/src/lib/auth-session.tsx`
- `apps/web/src/lib/notification-api.ts`
- `apps/web/src/lib/rfq-api.ts`
- `apps/web/src/lib/vendor-operations-api.ts`
- `deploy/apache/foodtruckzs.conf`
- `deploy/production.env.example`
- `deploy/scripts/backup-postgres.sh`
- `deploy/scripts/deploy-on-vps.sh`
- `deploy/scripts/deploy-ssh.sh`
- `deploy/scripts/smoke-test.sh`
- `ecosystem.config.cjs`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/constants/app.ts`
- `packages/shared/src/index.ts`
- `docs/build-progress.md`
- `docs/production-runbook.md`

Generated build artifacts such as `node_modules`, `apps/web/.next`, `apps/api/dist`, and `packages/shared/dist` are ignored and should not be committed.

## Commands Run

```sh
git status --short --branch
node --version
npm --version
pnpm --version
pnpm add -w -D typescript eslint @eslint/js typescript-eslint prettier @types/node tsx
pnpm add --filter @foodtruckzs/api fastify @fastify/cors @fastify/helmet
pnpm add --filter @foodtruckzs/web next react react-dom
pnpm add --filter @foodtruckzs/web -D @types/react @types/react-dom
pnpm typecheck
pnpm lint
pnpm build
pnpm format
pnpm exec prettier --write .
pnpm format
pnpm typecheck
pnpm lint
pnpm build
pnpm add --filter @foodtruckzs/api zod drizzle-orm postgres pino && pnpm add --filter @foodtruckzs/api -D vitest drizzle-kit
pnpm add --filter @foodtruckzs/api zod drizzle-orm postgres pino; if ($LASTEXITCODE -eq 0) { pnpm add --filter @foodtruckzs/api -D vitest drizzle-kit }
Get-ChildItem -Path "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src"
New-Item -ItemType Directory -Force -Path "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\db\schema", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\routes", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\shared\errors", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\shared\middleware", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\shared\validation", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\tests\integration", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\tests\unit"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
git status --short
pnpm format
pnpm exec prettier --write "apps/api/src/db/client.ts" "apps/api/src/routes/health.ts" "apps/api/src/server.ts" "apps/api/src/shared/errors/app-error.ts" "apps/api/src/shared/errors/error-handler.ts" "apps/api/src/shared/validation/zod.ts" "apps/api/src/tests/integration/health.test.ts"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm format
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api db:generate
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm exec prettier --write "apps/api/src/db/schema/index.ts" "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0000_snapshot.json" "apps/api/src/tests/integration/schema-constraints.test.ts"
pnpm format
pnpm --filter @foodtruckzs/api db:generate
if ($env:TEST_DATABASE_URL) { $env:DATABASE_URL = $env:TEST_DATABASE_URL; pnpm --filter @foodtruckzs/api db:migrate } else { Write-Output "TEST_DATABASE_URL is not set; skipping local/test migration run." }
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api build
pnpm format
pnpm typecheck
pnpm lint
pnpm build
pnpm add --filter @foodtruckzs/api @fastify/cookie argon2 jose
New-Item -ItemType Directory -Force -Path "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\modules\auth", "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\shared\auth"
New-Item -ItemType Directory -Force -Path "c:\Users\Mcros\Documents\Ross Product Management\foodtruckzs\apps\api\src\tests\fakes"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api test -- --run src/tests/integration/auth.test.ts
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/auth.test.ts
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm format
pnpm exec prettier --write "apps/api/src/modules/auth/auth.repository.ts" "apps/api/src/modules/auth/auth.routes.ts" "apps/api/src/modules/auth/auth.service.ts" "apps/api/src/modules/auth/auth.types.ts"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm format
git status --short
pnpm exec prettier --write "apps/api/src/modules/auth/token.service.ts"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api lint
pnpm format
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api db:generate
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/vendors.test.ts
pnpm typecheck
pnpm lint
pnpm --filter @foodtruckzs/api test
pnpm build
pnpm format
pnpm exec prettier --write "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0001_snapshot.json" "apps/api/src/db/schema/index.ts" "apps/api/src/modules/vendors/vendors.dto.ts" "apps/api/src/modules/vendors/vendors.repository.ts" "apps/api/src/modules/vendors/vendors.routes.ts" "apps/api/src/modules/vendors/vendors.service.ts" "apps/api/src/tests/fakes/in-memory-vendor-repository.ts" "apps/api/src/tests/integration/vendors.test.ts" "apps/web/src/app/vendor-operational-setup/page.tsx"
pnpm format
pnpm typecheck
pnpm lint
pnpm --filter @foodtruckzs/api test
pnpm build
git status --short
pnpm exec prettier --write "docs/build-progress.md"
pnpm format
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/modules/marketplace/marketplace.dto.ts" "apps/api/src/modules/marketplace/marketplace.repository.ts" "apps/api/src/modules/marketplace/marketplace.routes.ts" "apps/api/src/modules/marketplace/marketplace.service.ts" "apps/api/src/modules/vendors/vendors.routes.ts" "apps/api/src/tests/fakes/in-memory-marketplace-repository.ts" "apps/api/src/tests/fakes/in-memory-vendor-repository.ts" "apps/api/src/tests/integration/marketplace.test.ts" "apps/web/src/app/page.tsx" "apps/web/src/app/marketplace/page.tsx" "apps/web/src/app/vendors/[slug]/page.tsx" "apps/web/src/app/rfq/start/page.tsx" "apps/web/src/components/marketplace/vendor-card.tsx" "apps/web/src/components/marketplace/vendor-profile.tsx" "apps/web/src/lib/marketplace-api.ts"
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/marketplace.test.ts
pnpm typecheck
pnpm exec prettier --write "apps/api/src/tests/integration/marketplace.test.ts"
pnpm typecheck
pnpm typecheck
pnpm lint
pnpm --filter @foodtruckzs/api test
pnpm build
pnpm format
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/rfqs.test.ts
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm format
pnpm exec prettier --write "apps/api/src/modules/rfqs/rfqs.dto.ts" "apps/api/src/modules/rfqs/rfqs.repository.ts" "apps/api/src/modules/rfqs/rfqs.routes.ts" "apps/api/src/modules/rfqs/rfqs.service.ts" "apps/api/src/modules/rfqs/rfq-state-machine.ts" "apps/api/src/tests/fakes/in-memory-rfq-repository.ts" "apps/api/src/tests/integration/rfqs.test.ts" "apps/api/src/app.ts"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm format
pnpm exec prettier --write "docs/build-progress.md"
pnpm format
pnpm exec prettier --write "apps/web/src/lib/rfq-api.ts" "apps/web/src/app/rfq/start/page.tsx" "apps/web/src/app/rfq/start/rfq-wizard.tsx" "apps/web/src/app/rfq/confirmation/page.tsx" "apps/web/src/app/rfq/confirmation/rfq-confirmation.tsx" "apps/web/src/app/customer/dashboard/page.tsx" "apps/web/src/app/customer/dashboard/customer-dashboard.tsx" "apps/web/src/app/customer/rfqs/[rfqId]/page.tsx" "apps/web/src/app/customer/rfqs/[rfqId]/customer-rfq-detail.tsx"
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/web lint
pnpm exec prettier --write "apps/web/src/app/rfq/start/rfq-wizard.tsx"; pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/web build
pnpm exec prettier --write "docs/build-progress.md"; pnpm format
pnpm typecheck
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm exec prettier --write "apps/web/src/app/rfq/start/rfq-wizard.tsx"; pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/web build
pnpm --filter @foodtruckzs/api typecheck
pnpm exec prettier --write "apps/api/src/modules/rfqs/rfqs.dto.ts" "apps/api/src/modules/rfqs/rfqs.repository.ts" "apps/api/src/modules/rfqs/rfqs.routes.ts" "apps/api/src/modules/rfqs/rfqs.service.ts" "apps/api/src/tests/fakes/in-memory-rfq-repository.ts" "apps/api/src/tests/integration/rfqs.test.ts" "apps/web/src/lib/rfq-api.ts" "apps/web/src/app/customer/dashboard/customer-dashboard.tsx" "apps/web/src/app/customer/rfqs/[rfqId]/customer-rfq-detail.tsx" "apps/web/src/app/page.tsx" "apps/web/src/app/vendor/rfq-shared.ts" "apps/web/src/app/vendor/dashboard/page.tsx" "apps/web/src/app/vendor/dashboard/vendor-dashboard.tsx" "apps/web/src/app/vendor/rfqs/page.tsx" "apps/web/src/app/vendor/rfqs/vendor-rfq-inbox.tsx" "apps/web/src/app/vendor/rfqs/[rfqId]/page.tsx" "apps/web/src/app/vendor/rfqs/[rfqId]/vendor-rfq-detail.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/rfqs.test.ts
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/web build
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git status --short
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/quotes.test.ts
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api db:generate
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/db/schema/index.ts" "apps/api/src/db/migrations/0002_nifty_valkyrie.sql" "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0002_snapshot.json" "apps/api/src/modules/quotes/quote-calculation.ts" "apps/api/src/modules/quotes/quotes.dto.ts" "apps/api/src/modules/quotes/quotes.repository.ts" "apps/api/src/modules/quotes/quotes.routes.ts" "apps/api/src/modules/quotes/quotes.service.ts" "apps/api/src/tests/fakes/in-memory-rfq-repository.ts" "apps/api/src/tests/fakes/in-memory-quote-repository.ts" "apps/api/src/tests/integration/quotes.test.ts" "apps/web/src/lib/rfq-api.ts" "apps/web/src/app/vendor/rfqs/[rfqId]/vendor-rfq-detail.tsx" "apps/web/src/app/vendor/rfqs/[rfqId]/quote/page.tsx" "apps/web/src/app/vendor/rfqs/[rfqId]/quote/vendor-quote-builder.tsx" "apps/web/src/app/customer/rfqs/[rfqId]/customer-rfq-detail.tsx" "apps/web/src/app/customer/quotes/[quoteId]/page.tsx" "apps/web/src/app/customer/quotes/[quoteId]/customer-quote-review.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/web build
pnpm --filter @foodtruckzs/api build
pnpm format
git status --short
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/agreements.test.ts
pnpm --filter @foodtruckzs/web typecheck
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/modules/agreements/agreements.dto.ts" "apps/api/src/modules/agreements/agreements.repository.ts" "apps/api/src/modules/agreements/agreements.routes.ts" "apps/api/src/modules/agreements/agreements.service.ts" "apps/api/src/modules/quotes/quotes.service.ts" "apps/api/src/tests/fakes/in-memory-agreement-repository.ts" "apps/api/src/tests/integration/agreements.test.ts" "apps/web/src/lib/rfq-api.ts" "apps/web/src/app/customer/quotes/[quoteId]/customer-quote-review.tsx" "apps/web/src/app/customer/rfqs/[rfqId]/customer-rfq-detail.tsx" "apps/web/src/app/customer/agreements/[agreementId]/page.tsx" "apps/web/src/app/customer/agreements/[agreementId]/customer-agreement-review.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/agreements.test.ts
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm --filter @foodtruckzs/web build
pnpm format
pnpm exec prettier --write "docs/build-progress.md"
pnpm format
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/db/schema/index.ts" "apps/api/src/modules/agreements/agreements.service.ts" "apps/api/src/modules/billing/billing-calculation.ts" "apps/api/src/modules/billing/billing.dto.ts" "apps/api/src/modules/billing/billing.repository.ts" "apps/api/src/modules/billing/billing.routes.ts" "apps/api/src/modules/billing/billing.service.ts" "apps/api/src/modules/vendors/vendors.repository.ts" "apps/api/src/modules/vendors/vendors.routes.ts" "apps/api/src/modules/vendors/vendors.service.ts" "apps/api/src/tests/fakes/in-memory-billing-repository.ts" "apps/api/src/tests/fakes/in-memory-vendor-repository.ts" "apps/api/src/tests/integration/agreements.test.ts" "apps/api/src/tests/integration/vendors.test.ts" "apps/web/src/app/admin/platform-billing/page.tsx" "apps/web/src/app/vendor/platform-billing/page.tsx" "apps/web/src/app/page.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/agreements.test.ts src/tests/integration/vendors.test.ts
pnpm --filter @foodtruckzs/api db:generate
pnpm exec prettier --write "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0003_snapshot.json"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/web build
pnpm format
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm --filter @foodtruckzs/api build
pnpm add --filter @foodtruckzs/api stripe
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/payments.test.ts
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api db:generate
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm format
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0004_snapshot.json" "apps/api/src/modules/payments/payments.dto.ts" "apps/api/src/modules/payments/payments.repository.ts" "apps/api/src/modules/payments/payments.routes.ts" "apps/api/src/modules/payments/payments.service.ts" "apps/api/src/shared/stripe/stripe-client.ts" "apps/api/src/tests/fakes/in-memory-payment-repository.ts" "apps/api/src/tests/integration/payments.test.ts" "apps/web/src/lib/rfq-api.ts" "apps/web/src/app/customer/agreements/[agreementId]/customer-agreement-review.tsx" "apps/web/src/app/customer/payments/deposits/[agreementId]/page.tsx" "apps/web/src/app/customer/payments/deposits/[agreementId]/customer-deposit-payment.tsx" "apps/web/src/app/vendor/payments/page.tsx" "apps/web/src/app/page.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/web build
pnpm --filter @foodtruckzs/api build
pnpm format
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
if ($env:TEST_DATABASE_URL) { $env:DATABASE_URL = $env:TEST_DATABASE_URL; pnpm --filter @foodtruckzs/api db:migrate } else { Write-Output "TEST_DATABASE_URL is not set; skipping local/test migration run." }
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/payments.test.ts src/tests/integration/scheduling.test.ts
pnpm --filter @foodtruckzs/api db:generate
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/db/schema/index.ts" "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0005_snapshot.json" "apps/api/src/modules/payments/payments.repository.ts" "apps/api/src/modules/payments/payments.service.ts" "apps/api/src/modules/scheduling/scheduling.dto.ts" "apps/api/src/modules/scheduling/scheduling.repository.ts" "apps/api/src/modules/scheduling/scheduling.routes.ts" "apps/api/src/modules/scheduling/scheduling.service.ts" "apps/api/src/tests/fakes/in-memory-payment-repository.ts" "apps/api/src/tests/fakes/in-memory-scheduling-repository.ts" "apps/api/src/tests/integration/payments.test.ts" "apps/api/src/tests/integration/scheduling.test.ts" "apps/web/src/lib/rfq-api.ts" "apps/web/src/app/page.tsx" "apps/web/src/app/vendor/dashboard/vendor-dashboard.tsx" "apps/web/src/app/vendor/calendar/page.tsx" "apps/web/src/app/vendor/events/[eventId]/page.tsx" "apps/web/src/app/vendor/events/[eventId]/vendor-event-operations.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/payments.test.ts src/tests/integration/scheduling.test.ts
pnpm exec prettier --write "apps/api/src/modules/scheduling/scheduling.service.ts"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm --filter @foodtruckzs/web build
pnpm format
if ($env:TEST_DATABASE_URL) { $env:DATABASE_URL = $env:TEST_DATABASE_URL; pnpm --filter @foodtruckzs/api db:migrate } else { Write-Output "TEST_DATABASE_URL is not set; skipping local/test migration run." }
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/notifications.test.ts
pnpm --filter @foodtruckzs/api db:generate
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/notifications.test.ts
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/db/schema/index.ts" "apps/api/src/db/migrations/meta/_journal.json" "apps/api/src/db/migrations/meta/0006_snapshot.json" "apps/api/src/modules/notifications/email-provider.ts" "apps/api/src/modules/notifications/notifications.dto.ts" "apps/api/src/modules/notifications/notifications.repository.ts" "apps/api/src/modules/notifications/notifications.routes.ts" "apps/api/src/modules/notifications/notifications.service.ts" "apps/api/src/tests/fakes/in-memory-notification-repository.ts" "apps/api/src/tests/integration/notifications.test.ts" "apps/api/src/workers/worker.ts" "apps/api/package.json" "apps/web/src/lib/notification-api.ts" "apps/web/src/app/notifications/page.tsx" "apps/web/src/app/notifications/notification-center.tsx" "apps/web/src/app/page.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm --filter @foodtruckzs/web build
pnpm format
if ($env:TEST_DATABASE_URL) { $env:DATABASE_URL = $env:TEST_DATABASE_URL; pnpm --filter @foodtruckzs/api db:migrate } else { Write-Output "TEST_DATABASE_URL is not set; skipping local/test migration run." }
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/admin.test.ts
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm format
pnpm exec prettier --write "apps/api/src/modules/admin/admin.repository.ts" "apps/api/src/modules/admin/admin.service.ts" "apps/api/src/tests/fakes/in-memory-admin-repository.ts" "apps/api/src/tests/integration/admin.test.ts" "apps/web/src/app/admin/page.tsx"
pnpm --filter @foodtruckzs/api typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/web typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/web lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/admin.test.ts
pnpm --filter @foodtruckzs/api test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/web build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm add --filter @foodtruckzs/api @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm format
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm exec prettier --write "apps/api/src/app.ts" "apps/api/src/modules/storage/storage.repository.ts" "apps/api/src/modules/storage/storage.routes.ts" "apps/api/src/modules/storage/storage.service.ts" "apps/api/src/shared/storage/local-storage.adapter.ts" "apps/api/src/shared/storage/s3-compatible.adapter.ts" "apps/api/src/shared/storage/storage-adapter.ts" "apps/api/src/tests/fakes/in-memory-storage-repository.ts" "apps/api/src/tests/integration/storage.test.ts" "apps/web/src/app/vendor/documents/vendor-document-center.tsx"
pnpm --filter @foodtruckzs/api typecheck
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/storage.test.ts
pnpm --filter @foodtruckzs/api lint
pnpm --filter @foodtruckzs/web lint
pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build
pnpm --filter @foodtruckzs/web build
pnpm format
pnpm exec prettier --write "docs/build-progress.md" && pnpm format
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/web lint
pnpm exec tsx --test "apps/web/src/components/navigation.test.ts"
pnpm --filter @foodtruckzs/web build
pnpm exec prettier --write "docs/build-progress.md"
pnpm format
pnpm exec prettier --write "apps/web/src/app/customer/dashboard/customer-dashboard.tsx" "apps/web/src/app/customer/payments/deposits/[agreementId]/customer-deposit-payment.tsx" "apps/web/src/app/customer/quotes/[quoteId]/customer-quote-review.tsx" "apps/web/src/app/marketplace/page.tsx" "apps/web/src/app/vendor/availability/page.tsx" "apps/web/src/app/vendor/dashboard/vendor-dashboard.tsx" "apps/web/src/app/vendor/menus/page.tsx" "apps/web/src/app/vendor/onboarding/page.tsx" "apps/web/src/app/vendor/rfqs/[rfqId]/vendor-rfq-detail.tsx"
pnpm --filter @foodtruckzs/web typecheck
pnpm --filter @foodtruckzs/web lint
pnpm exec tsx --test "apps/web/src/components/navigation.test.ts"
pnpm --filter @foodtruckzs/web build
pnpm format
pnpm exec prettier --write ".env.example" "apps/api/src/app.ts" "apps/api/src/config/env.ts" "apps/api/src/modules/auth/auth.routes.ts" "apps/api/src/modules/payments/payments.routes.ts" "apps/api/src/modules/quotes/quote-calculation.ts" "apps/api/src/modules/quotes/quotes.service.ts" "apps/api/src/modules/rfqs/rfqs.routes.ts" "apps/api/src/modules/scheduling/scheduling.service.ts" "apps/api/src/shared/errors/app-error.ts" "apps/api/src/shared/middleware/rate-limit.ts" "apps/api/src/tests/integration/api-hardening.test.ts" "apps/api/src/tests/integration/agreements.test.ts" "apps/api/src/tests/integration/payments.test.ts" "apps/api/src/tests/integration/quotes.test.ts" "apps/api/src/tests/integration/rfqs.test.ts" "apps/api/src/tests/test-env.ts" "apps/api/src/tests/unit/domain-rules.test.ts"
pnpm --filter @foodtruckzs/api typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api exec vitest run src/tests/unit/domain-rules.test.ts src/tests/integration/api-hardening.test.ts src/tests/integration/rfqs.test.ts src/tests/integration/quotes.test.ts src/tests/integration/agreements.test.ts src/tests/integration/payments.test.ts
pnpm --filter @foodtruckzs/api lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api test
pnpm --filter @foodtruckzs/api build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm exec prettier --write "docs/build-progress.md"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm --filter @foodtruckzs/api typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm --filter @foodtruckzs/api build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
ls
git status --short
New-Item -ItemType Directory -Force -Path deploy, deploy/apache, deploy/scripts, .github, .github/workflows | Out-Null
pnpm typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; pnpm format
pnpm format
pnpm format
```

## Check Results

- Initial PowerShell dependency command using `&&`: failed because this PowerShell version did not accept `&&` as a statement separator.
- Dependency install with PowerShell-compatible sequencing: passed.
- Initial `pnpm --filter @foodtruckzs/api typecheck`: failed on Fastify/error handler typing and request decorator typing; fixed.
- Initial `pnpm --filter @foodtruckzs/api lint`: failed on type-only import rules; fixed.
- Initial `pnpm --filter @foodtruckzs/api test`: passed.
- `pnpm --filter @foodtruckzs/api typecheck`: passed after fixes.
- `pnpm --filter @foodtruckzs/api lint`: passed after fixes.
- `pnpm --filter @foodtruckzs/api test`: passed, 3 test files and 7 tests.
- `pnpm --filter @foodtruckzs/api build`: passed.
- Initial `pnpm format`: failed on new API formatting; fixed with Prettier.
- Final `pnpm format`: passed.
- IDE lints on edited app/package paths: no linter errors found.
- `pnpm --filter @foodtruckzs/api db:generate`: passed and generated `0000_nasty_leopardon.sql` with 43 tables.
- Repeat `pnpm --filter @foodtruckzs/api db:generate`: passed with "No schema changes, nothing to migrate".
- Initial lint after schema work failed on one unused Drizzle import; fixed.
- `pnpm --filter @foodtruckzs/api lint`: passed after the import fix and formatting.
- `pnpm --filter @foodtruckzs/api test`: passed, 3 test files and 7 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- `pnpm --filter @foodtruckzs/api typecheck`: passed.
- `pnpm --filter @foodtruckzs/api build`: passed.
- Initial `pnpm format` after migration generation failed on the new schema and Drizzle migration metadata; fixed with Prettier.
- Final `pnpm format`: passed.
- Local/test migration execution: skipped because `TEST_DATABASE_URL` was not set in the shell environment.
- IDE lints on the edited schema and schema constraint test files: no linter errors found.
- Workspace `pnpm typecheck`: passed.
- Workspace `pnpm lint`: passed.
- Workspace `pnpm build`: passed.
- Auth dependency install passed and added `@fastify/cookie`, `argon2`, and `jose`.
- Initial `pnpm --filter @foodtruckzs/api typecheck` after auth implementation failed on strict Drizzle `.returning()` handling and a test header helper type; fixed.
- Focused auth test command using `pnpm --filter @foodtruckzs/api test -- --run ...` failed because pnpm treated `--run` as an unknown script option; reran with `pnpm --filter @foodtruckzs/api exec vitest run src/tests/integration/auth.test.ts`.
- Focused auth tests passed, 1 test file and 6 tests.
- `pnpm --filter @foodtruckzs/api lint`: passed.
- `pnpm --filter @foodtruckzs/api test`: passed, 4 test files and 13 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- `pnpm --filter @foodtruckzs/api build`: passed.
- Initial `pnpm format` after auth work failed on four auth files; fixed with Prettier.
- Final `pnpm --filter @foodtruckzs/api typecheck`: passed.
- Final `pnpm --filter @foodtruckzs/api lint`: passed.
- Final `pnpm --filter @foodtruckzs/api test`: passed, 4 test files and 13 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final `pnpm --filter @foodtruckzs/api build`: passed.
- Final `pnpm format`: passed.
- Final repeat after the docs update: `pnpm format`, `pnpm --filter @foodtruckzs/api test`, and `pnpm --filter @foodtruckzs/api build` passed.
- IDE lints on edited auth, config, app, test, and env files: no linter errors found.
- `git status --short`: failed because the folder is not initialized as a git repository.
- Initial API typecheck after vendor module work failed on strict Drizzle insert/upsert typing and a nullable menu reload; fixed.
- `pnpm --filter @foodtruckzs/api db:generate`: passed and generated `0001_tricky_toxin.sql`.
- Focused vendor tests passed, 1 test file and 2 tests.
- Full `pnpm --filter @foodtruckzs/api test`: passed, 5 test files and 15 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Initial workspace lint after vendor work failed on unused/type-only imports; fixed.
- Initial `pnpm format`: failed on new vendor/schema/migration/web files; fixed with Prettier.
- Final `pnpm format`: passed.
- Final `pnpm typecheck`: passed.
- Final `pnpm lint`: passed.
- Final `pnpm --filter @foodtruckzs/api test`: passed, 5 test files and 15 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final `pnpm build`: passed for API, web, and shared packages.
- IDE lints on edited vendor API, schema, test, and web files: no linter errors found.
- `docs/build-progress.md` was formatted with Prettier after the documentation update.
- Final post-docs `pnpm format`: passed.
- Marketplace formatting command passed on new/edited API, test, and web files.
- Focused marketplace tests passed, 1 test file and 2 tests.
- Initial workspace `pnpm typecheck` after marketplace work failed because direct in-memory test seed data omitted fields normally defaulted by Zod parsing; fixed by adding explicit `dietaryTags`, `isAvailable`, `includedItemIds`, and `sortOrder` test values.
- Second workspace `pnpm typecheck` failed because the direct test menu seed omitted top-level `dietaryTags`; fixed.
- Final workspace `pnpm typecheck`: passed.
- Final workspace `pnpm lint`: passed.
- Final `pnpm --filter @foodtruckzs/api test`: passed, 6 test files and 17 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final workspace `pnpm build`: passed for API, web, and shared packages.
- Final workspace `pnpm format`: passed.
- IDE lints on edited marketplace API, app wiring, marketplace tests/fakes, and web marketplace files: no linter errors found.
- Initial RFQ API typecheck passed.
- Focused RFQ integration tests passed, 1 test file and 3 tests.
- Initial RFQ API lint failed on unused/no-useless assignments in RFQ lifecycle transition code; fixed by removing unused reassignment.
- RFQ API lint passed after the fix.
- Full API test suite passed, 7 test files and 20 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Initial workspace format check failed on new RFQ files; fixed with Prettier.
- Final RFQ API typecheck passed.
- Final RFQ API lint passed.
- Final full API test suite passed, 7 test files and 20 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final RFQ API build passed.
- Final workspace format check passed.
- IDE lints on edited RFQ module, app wiring, RFQ in-memory repository, and RFQ tests: no linter errors found.
- `docs/build-progress.md` was formatted with Prettier after the RFQ documentation update.
- Final post-docs workspace format check passed.
- Customer RFQ web formatting command passed on the new/edited RFQ API helper, RFQ wizard, confirmation, dashboard, and detail files.
- Initial customer RFQ web typecheck failed on strict dynamic checkbox field typing in the RFQ wizard; fixed by replacing inline tuple arrays with typed field metadata.
- Final `pnpm --filter @foodtruckzs/web typecheck`: passed.
- Final `pnpm --filter @foodtruckzs/web lint`: passed.
- Final `pnpm --filter @foodtruckzs/web build`: passed. Next.js built `/rfq/start`, `/rfq/confirmation`, `/customer/dashboard`, and `/customer/rfqs/[rfqId]` successfully.
- IDE lints on edited customer RFQ web files: no linter errors found.
- Documentation formatting plus workspace format check passed after updating `docs/build-progress.md`.
- Workspace `pnpm lint`: passed for shared, web, and API packages.
- Workspace `pnpm build`: passed for shared, web, and API packages.
- Initial workspace `pnpm typecheck` failed because the web package saw missing stale `.next/types` files while the workspace build was running in parallel; rerunning after build regenerated Next.js type files passed.
- Final workspace `pnpm typecheck`: passed for shared, web, and API packages.
- Workspace `pnpm test`: passed through the API Vitest suite, 7 test files and 20 tests passed; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final post-edge-case web checks after hardening RFQ date/time preview behavior: `pnpm --filter @foodtruckzs/web typecheck`, `pnpm --filter @foodtruckzs/web lint`, and `pnpm --filter @foodtruckzs/web build` passed.
- Initial API typecheck after adding RFQ messaging/read-state support passed.
- RFQ triage/messaging formatting command passed on edited API, test, web, and new vendor RFQ files.
- Focused RFQ integration tests passed, 1 test file and 4 tests. The new test covers thread visibility, customer clarification replies, unread/read behavior, cross-vendor thread denial, and customer/vendor authorization boundaries.
- Final `pnpm --filter @foodtruckzs/api typecheck`: passed.
- Final `pnpm --filter @foodtruckzs/web typecheck`: passed.
- Final `pnpm --filter @foodtruckzs/api lint`: passed.
- Final `pnpm --filter @foodtruckzs/web lint`: passed.
- Final `pnpm --filter @foodtruckzs/web build`: passed. Next.js built `/vendor/dashboard`, `/vendor/rfqs`, and `/vendor/rfqs/[rfqId]` successfully.
- Final workspace `pnpm format`: passed.
- Final workspace `pnpm typecheck`: passed for shared, web, and API packages.
- Final workspace `pnpm lint`: passed for shared, web, and API packages.
- Final workspace `pnpm test`: passed through the API Vitest suite, 7 test files and 21 tests passed; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final workspace `pnpm build`: passed for API, web, and shared packages.
- IDE lints on edited RFQ API, RFQ tests/fakes, RFQ web helper, customer RFQ pages, root page, and new vendor RFQ pages: no linter errors found.
- `git status --short`: failed because the folder is not initialized as a git repository.
- Documentation formatting plus workspace format check passed after updating `docs/build-progress.md`.
- Initial quote API typecheck failed on a nullable quote detail list return and an optional RFQ target assertion in the new tests; fixed.
- Quote API typecheck passed after fixes.
- Focused quote integration tests passed, 1 test file and 4 tests.
- Web quote page typecheck passed.
- `pnpm --filter @foodtruckzs/api db:generate` passed and generated `0002_nifty_valkyrie.sql`.
- Formatting command passed for TypeScript and JSON files, but direct Prettier formatting of the generated SQL migration failed because no SQL parser was configured; the generated SQL was left as emitted by Drizzle. The later workspace `pnpm format` check passed.
- Final `pnpm --filter @foodtruckzs/api typecheck`: passed.
- Final `pnpm --filter @foodtruckzs/web typecheck`: passed.
- Final `pnpm --filter @foodtruckzs/api lint`: passed.
- Final `pnpm --filter @foodtruckzs/web lint`: passed.
- Final `pnpm --filter @foodtruckzs/api test`: passed, 8 test files and 25 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final `pnpm --filter @foodtruckzs/web build`: passed. Next.js built `/vendor/rfqs/[rfqId]/quote` and `/customer/quotes/[quoteId]` successfully.
- Final `pnpm --filter @foodtruckzs/api build`: passed.
- Final workspace `pnpm format`: passed.
- IDE lints on edited quote API, quote tests/fakes, RFQ fake repository, web quote pages, RFQ detail pages, and RFQ API helper: no linter errors found.
- `git status --short`: failed because the folder is not initialized as a git repository.
- Initial agreement API typecheck passed.
- Focused agreement integration tests passed, 1 test file and 3 tests, covering version mismatch, customer-only signature authorization, signed agreement immutability, RFQ status transition, next payment action, and platform fee creation.
- Initial agreement web typecheck failed on strict checkbox metadata typing in `customer-agreement-review.tsx`; fixed by replacing inline tuple metadata with typed acknowledgement options.
- Final `pnpm --filter @foodtruckzs/web typecheck`: passed.
- Agreement formatting command passed on edited API, test, web, and docs files.
- Final agreement API typecheck passed.
- Final focused agreement tests passed, 1 test file and 3 tests.
- Final `pnpm --filter @foodtruckzs/api lint`: passed.
- Final `pnpm --filter @foodtruckzs/web lint`: passed.
- Final `pnpm --filter @foodtruckzs/api test`: passed, 9 test files and 28 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final `pnpm --filter @foodtruckzs/api build`: passed.
- Final `pnpm --filter @foodtruckzs/web build`: passed. Next.js built `/customer/agreements/[agreementId]` successfully.
- Final workspace `pnpm format`: passed.
- Documentation formatting command passed after updating `docs/build-progress.md`.
- Final post-docs workspace `pnpm format`: passed.
- IDE lints on edited agreement API, quote service, agreement tests/fakes, web agreement pages, RFQ/quote web links, and build-progress docs: no linter errors found.
- Platform billing formatting command passed on edited API, test, migration metadata, web, and docs files.
- Initial focused platform billing checks passed: `pnpm --filter @foodtruckzs/api typecheck`, `pnpm --filter @foodtruckzs/web typecheck`, and focused `agreements.test.ts`/`vendors.test.ts` with 2 files and 8 tests.
- `pnpm --filter @foodtruckzs/api db:generate`: passed and generated `0003_clumsy_skreet.sql` to add the `adjusted` vendor invoice status.
- Final platform billing API typecheck passed.
- Final platform billing API lint passed.
- Final full API test suite passed, 9 test files and 31 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final platform billing web lint passed.
- Final platform billing web build passed. Next.js built `/admin/platform-billing` and `/vendor/platform-billing` successfully.
- Final workspace `pnpm format`: passed.
- IDE lints on edited billing API, agreement/vendor API files, billing tests/fakes, web billing pages, root page, and docs: no linter errors found.
- Documentation formatting plus final workspace format check passed after updating `docs/build-progress.md`.
- Final platform billing API build passed.
- Stripe dependency install passed and added `stripe` to the API package.
- Initial payment API typecheck passed.
- Focused payment integration tests passed, 1 test file and 4 tests covering onboarding/readiness, checkout creation idempotency, successful webhook idempotency, failed payment handling, and duplicate webhook events.
- Initial payment web typecheck passed.
- `pnpm --filter @foodtruckzs/api db:generate`: passed and generated `0004_mean_riptide.sql` for vendor Stripe readiness fields.
- Initial payment API lint failed on one unused import and one unused fake Stripe test argument; fixed.
- Payment formatting command passed on edited API, test, migration metadata, web, and docs files.
- Final payment API typecheck passed.
- Final payment web typecheck passed.
- Final payment API lint passed.
- Final payment web lint passed.
- Final full API test suite passed, 10 test files and 35 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final payment web build passed. Next.js built `/customer/payments/deposits/[agreementId]` and `/vendor/payments` successfully.
- Final payment API build passed.
- Final workspace `pnpm format`: passed.
- IDE lints on edited payment API, Stripe wrapper, schema, tests/fakes, and payment web pages: no linter errors found.
- Documentation formatting plus final workspace format check passed after updating `docs/build-progress.md`.
- Local/test migration execution after the payment migration was skipped because `TEST_DATABASE_URL` was not set in the shell environment.
- Initial scheduling API typecheck failed on strict test seed typing for an optional deposit item and an extra vendor membership context field; fixed.
- Scheduling API typecheck passed after the test fixture fixes.
- Initial scheduling web typecheck passed.
- Focused payment and scheduling tests passed, 2 test files and 7 tests.
- `pnpm --filter @foodtruckzs/api db:generate`: passed and generated `0005_overconfident_gravity.sql` for unique confirmed scheduling handoff indexes.
- Scheduling formatting command passed on edited API, web, test, and migration metadata files.
- IDE lints on edited scheduling API, payment API, scheduling/payment tests, web calendar/run-sheet pages, and RFQ API helper: no linter errors found.
- Final scheduling API typecheck passed.
- Final scheduling web typecheck passed.
- Initial scheduling API lint failed on one unused type import in `scheduling.service.ts`; fixed.
- Final scheduling API lint passed.
- Final scheduling web lint passed.
- Final focused payment and scheduling tests passed, 2 test files and 7 tests.
- Final full API test suite passed, 11 test files and 38 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final scheduling API build passed.
- Final scheduling web build passed. Next.js built `/vendor/calendar` and `/vendor/events/[eventId]` successfully.
- Final workspace format check passed.
- Local/test migration execution after the scheduling migration was skipped because `TEST_DATABASE_URL` was not set in the shell environment.
- Documentation formatting plus final workspace format check passed after updating `docs/build-progress.md`.
- Initial notification API typecheck failed on channel typing for `sms` enum values and a required `unreadOnly` DTO field in one service call; fixed by widening repository delivery channel lookup and passing the default unread filter.
- Notification API typecheck passed after the fixes.
- Focused notification tests passed, 1 test file and 5 tests covering outbox claiming, retry, dead-letter, idempotency, and preferences.
- `pnpm --filter @foodtruckzs/api db:generate`: passed and generated `0006_chemical_big_bertha.sql` for notification outbox idempotency and delivery-channel uniqueness.
- Notification web typecheck passed.
- Notification formatting command passed on edited API, worker, test, migration metadata, and web files.
- Final notification API typecheck passed.
- Final notification web typecheck passed.
- Final notification API lint passed.
- Final notification web lint passed.
- Final full API test suite passed, 12 test files and 43 tests; 1 database-backed schema test file and 4 tests skipped because `TEST_DATABASE_URL` was not set.
- Final notification API build passed.
- Final notification web build passed. Next.js built `/notifications` successfully.
- Final workspace format check passed.
- IDE lints on edited notification API, notification tests/fakes, worker, web notification center, and schema files: no linter errors found.
- Local/test migration execution after the notification migration was skipped because `TEST_DATABASE_URL` was not set in the shell environment.
- Documentation formatting plus final workspace format check passed after updating `docs/build-progress.md`.
- Initial admin API typecheck passed.
- Focused admin integration tests passed, 1 test file and 2 tests covering admin authorization, vendor decisions, audit logs, RFQ dispute review, payment monitoring, webhook failure visibility, and dashboard counts.
- Initial admin web typecheck passed.
- Initial admin API lint failed on one unused service parameter; fixed by marking the parameter unused.
- Final admin API lint passed.
- Final admin web lint passed.
- Initial workspace format check failed on new admin files; fixed with Prettier.
- Final focused admin validation command passed: API typecheck, web typecheck, API lint, web lint, and focused admin integration tests.
- Final full API test suite passed, 13 test files passed and 1 skipped; 45 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.
- Final admin API build passed.
- Final admin web build passed. Next.js built `/admin` and `/admin/platform-billing` successfully.
- Final workspace format check passed.
- IDE lints on edited admin API, admin tests/fakes, app wiring, admin web page, root page, and docs: no linter errors found.
- Documentation formatting plus final workspace format check passed after updating `docs/build-progress.md`.
- S3-compatible dependency install passed and added `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to the API package.
- Initial storage workspace format check failed on new/edited storage API, shared adapter, test, app wiring, and web document center files; fixed with Prettier.
- Initial storage API typecheck passed.
- Initial storage web typecheck passed.
- Storage formatting command passed on edited storage API, shared storage adapter, fake/test, app wiring, and web document center files.
- Final storage API typecheck passed.
- Final storage web typecheck passed.
- Focused storage integration tests passed, 1 test file and 2 tests covering RFQ attachment visibility, signed URL authorization, vendor document listing, and agreement access audit logging.
- Final storage API lint passed.
- Final storage web lint passed.
- Final full API test suite passed, 14 test files passed and 1 skipped; 47 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.
- Final storage API build passed.
- Final storage web build passed. Next.js built `/vendor/documents` successfully.
- Final workspace format check passed.
- IDE lints on edited storage API, shared adapter, agreement service, env, storage tests/fakes, web document center, and root page files: no linter errors found.
- Initial documentation formatting command using `&&`: failed because this PowerShell version did not accept `&&` as a statement separator.
- Final documentation formatting plus workspace format check passed with PowerShell-compatible sequencing.
- IDE lints on edited UI alignment files: no linter errors found.
- UI navigation test passed through `pnpm exec tsx --test "apps/web/src/components/navigation.test.ts"` with 1 test file and 2 tests.
- Final UI alignment web typecheck passed.
- Final UI alignment web lint passed.
- Final UI alignment web build passed. Next.js built the updated public, RFQ, customer, vendor, admin, and new vendor onboarding/menu/availability routes successfully.
- Initial post-docs `pnpm format` failed on nine edited UI files; fixed with Prettier.
- Final post-format rerun passed: `pnpm --filter @foodtruckzs/web typecheck`, `pnpm --filter @foodtruckzs/web lint`, `pnpm exec tsx --test "apps/web/src/components/navigation.test.ts"`, `pnpm --filter @foodtruckzs/web build`, and `pnpm format`.
- Direct Prettier formatting of `.env.example` failed because no parser was inferred for the env file; TypeScript formatting continued, and the later workspace `pnpm format` check passed.
- Focused production hardening checks passed: `pnpm --filter @foodtruckzs/api typecheck` and focused Vitest run for `domain-rules`, `api-hardening`, `rfqs`, `quotes`, `agreements`, and `payments` passed with 6 test files and 30 tests.
- IDE lints on edited API hardening files reported no linter errors.
- Final full API lint passed.
- Final full API test suite passed, 16 test files passed and 1 skipped; 59 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.
- Final API build passed.
- Final workspace format check passed.
- Documentation formatting plus final workspace format check passed after updating `docs/build-progress.md`.
- Resumed-session final rerun passed: API typecheck, API lint, full API test suite, API build, and workspace format check. The full API test suite passed with 16 test files passed and 1 skipped; 59 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.
- Deployment prep full workspace verification passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format`.
- Deployment prep API test suite passed with 16 test files passed and 1 skipped; 59 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.
- Deployment prep web build passed and generated the existing public, customer, vendor, admin, notification, RFQ, quote, agreement, payment, and vendor profile routes.
- IDE lints on edited deployment config, scripts, workflow, package, Prettier ignore, and docs reported no linter errors.
- Final deployment prep format check passed after updating `docs/build-progress.md`.
- Final deployment prep format check passed after wiring the GitHub Actions SSH key path into `deploy/scripts/deploy-ssh.sh`.
- Production VPS deployment, Apache config test, PM2 reload, live migration, live smoke test, backup upload, and restore rehearsal were not run because no VPS credentials or production database were configured in this workspace.
- Baseline final-MVP verification API suite passed before adding route-level E2E coverage: 16 test files passed, 1 skipped; 59 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.
- Initial focused MVP E2E test exposed two test-shape mismatches in the new verification assertions (`threads` response naming and `pending_invoice` fee status); no product workflow blocker was found.
- Focused MVP E2E verification passed with 1 test file and 1 test covering vendor onboarding, marketplace search, RFQ/clarification, quote acceptance, agreement signature, platform billing, Stripe deposit payment, calendar confirmation, run sheet access, and admin review.
- Initial final-check command using `&&` failed because this PowerShell version does not accept `&&` as a statement separator.
- Final MVP API verification passed: `pnpm --filter @foodtruckzs/api typecheck`, `pnpm --filter @foodtruckzs/api lint`, full `pnpm --filter @foodtruckzs/api test`, and `pnpm format`. The full API test suite passed with 17 test files passed and 1 skipped; 60 tests passed and 4 database-backed tests skipped because `TEST_DATABASE_URL` was not set.

## Authenticated Web UX Update

- Added a shared browser auth session layer for the web app that supports login, registration, logout, `/auth/me` refresh, saved local account persistence, and active vendor selection from vendor memberships.
- Added a reusable account panel with API base URL configuration, saved-user search, saved-user selection, login/register forms, current-role display, active-vendor dropdown, and role expectation warnings.
- Replaced pasted bearer-token fields across customer RFQ/dashboard/quote/agreement/payment pages, vendor dashboard/RFQ/calendar/payments/documents/run-sheet/billing/setup pages, notification center, and admin pages.
- Added searchable vendor selection to admin operations and admin platform billing by using the existing admin vendor list search endpoint and turning the latest results into selectable vendors.
- Updated the RFQ wizard submission flow to use the shared customer account session instead of a pasted customer token.
- Verified the web changes with `pnpm --filter @foodtruckzs/web lint` and `pnpm --filter @foodtruckzs/web typecheck`.

## Final MVP Status

Status: MVP workflow is route-level verified and ready for staging deployment validation.

The recommended MVP scope is functionally represented across API modules and reachable web routes:

- Vendor onboarding supports account/profile setup, cuisines, service areas, operating settings, availability, public menus, Stripe Connect onboarding, vendor payment visibility, platform billing visibility, calendar, documents, and event run sheets.
- Customer marketplace/RFQ supports public vendor discovery, vendor profiles, guided RFQ submission, customer RFQ tracking, clarification replies, quote review, agreement signing, and deposit checkout.
- Vendor RFQ operations support inbox/detail triage, clarification requests, customer messages, RFQ acceptance/rejection, quote creation, quote revisions, payments, confirmed calendar events, and operations detail.
- Agreement, billing, payment, and scheduling handoff is complete for the MVP happy path: accepted quote generates an agreement, customer signature creates a platform agreement fee, admin can invoice the caterer, deposit payment is collected through Stripe Checkout, and successful webhook processing confirms the booking and creates the calendar/run-sheet records.
- Admin can review vendors, approve marketplace visibility, review RFQs/messages/quotes/agreements/payments, monitor payments/webhooks, configure vendor billing settings, review pending platform fees, and generate caterer invoices.

No MVP-blocking defects are currently known in the route-level product workflow. Remaining risks are operational, data-store, production-integration, and UI-polish risks listed below.

## Known Non-Blocking MVP Gaps

- Authenticated customer, vendor, notification, and admin pages now use a shared login/register and saved-account selector instead of pasted bearer-token fields. Remaining account UX work is deeper role-aware navigation, password reset/email verification, and fully polished guided onboarding forms.
- The MVP verification is route-level with in-memory repositories and a mocked Stripe client. Live PostgreSQL migrations, real Stripe Connect/Checkout, production object storage, worker deployment, Apache/PM2, and VPS smoke tests still need staging or production validation.
- Browser E2E, mobile visual testing, and accessibility audits are not yet present. Current UI validation is typecheck/lint/build plus lightweight route/navigation coverage.
- Agreement PDFs, platform invoices, uploads, notifications, and admin consoles are operationally functional but visually minimal. PDF rendering, invoice email delivery/payment tracking, direct uploads, malware scanning, production email provider setup, and richer admin screens are deferred.
- Marketplace search covers the supported MVP filters, but advanced dietary/dessert/onsite cooking/buffet/alcohol/equipment filters, distance sorting, and true availability matching require richer data and UI.
- Scheduling and run sheets are read-only MVP projections. Editable checklist completion, staffing assignments, prep-note persistence, calendar drag/edit workflows, route optimization, and maps-based travel timing are deferred.
- Payment scope covers required deposits. Milestone/final balance collection UI, refunds, payout reconciliation, Stripe replay tools, and platform invoice payment collection remain post-MVP work.

## Open Issues and Known Risks

- The folder is not currently initialized as a git repository, so there is no commit history or `git status` tracking yet.
- Deployment artifacts are prepared but have not been exercised against a real GoDaddy VPS, live Apache2 site, live PM2 daemon, production PostgreSQL instance, or SSL certificate.
- The deploy scripts assume the VPS can fetch the configured Git repository and that the deploy user has permission for `/var/www/foodtruckzs`, PM2, PostgreSQL backups, and the production environment file.
- The backup script creates local `pg_dump` files and supports GPG/offsite hooks, but off-VPS storage credentials and a tested restore target are still operational setup tasks.
- The Apache example uses placeholder domains and certificate paths; the production site must replace `foodtruckzs.com` and run Certbot before HTTPS traffic will work.
- `/readyz` now checks PostgreSQL through the database client shell, but no local PostgreSQL instance was started during this chat and no live database readiness smoke test was run.
- The schema migrations exist, but they were not applied to a live local/test PostgreSQL database because `TEST_DATABASE_URL` was not configured in the shell.
- Database-backed constraint tests are present but skipped unless `TEST_DATABASE_URL` is set.
- The vendor operations Drizzle repository is typechecked but not exercised against a live PostgreSQL database in tests yet because `TEST_DATABASE_URL` was not set.
- The marketplace, RFQ, quote, agreement, billing, payment, scheduling, and notification Drizzle repositories are typechecked and covered through in-memory route/service tests, but they have not been exercised against a live PostgreSQL database because `TEST_DATABASE_URL` was not set.
- The storage Drizzle repository is typechecked and covered through in-memory route/service tests, but it has not been exercised against a live PostgreSQL database or real object storage because `TEST_DATABASE_URL` and production object-storage credentials were not configured in the shell.
- MVP uploads are server-proxied JSON/base64 uploads. Direct-to-object-storage browser uploads, multipart upload UX, resumable uploads, and malware scanning remain future hardening work.
- Some tables from the broader technical design remain deferred because they were outside prior phase scopes: password reset tokens, email verification tokens, idempotency keys, calendar conflicts, and a separate `vendor_stripe_accounts` table. Stripe account identity is currently represented on `vendors.stripe_connect_account_id`; notification dead letters currently use `outbox_events.status = "dead_letter"` instead of a separate dead-letter table.
- Auth flows, vendor setup routes, minimal vendor setup UI, marketplace discovery, RFQ backend lifecycle, quote creation/revision/customer review, agreement generation/versioning/signature, platform fee record creation, platform invoice generation, deposit Stripe payment collection, scheduling confirmation/calendar operations, notification outbox processing, and durable file storage plumbing now exist. Polished onboarding UI, automated platform invoice delivery/payment collection, refunds, payout reconciliation, advanced route optimization, and full staffing scheduling remain deferred.
- Environment validation covers backend foundation, auth, Stripe variables, and file storage variables. Production email provider selection, production object-storage credentials, and future integration secrets still need deployment-specific configuration.
- The shared package is intentionally small and not yet used by the apps.
- A manual GitHub Actions production deployment workflow now exists, but it has not run in GitHub and still requires production environment approval plus SSH/secrets configuration.
- Auth route tests currently use an in-memory repository so they run without local PostgreSQL; the Drizzle auth repository is typechecked but not exercised against a live database because `TEST_DATABASE_URL` was not set.
- Auth rate limiting now exists for register/login/refresh, but CSRF token support for refresh/logout, audit logging for auth anomalies, password reset, email verification, MFA, and admin-driven session revocation endpoints remain future hardening work.
- Current API rate limits are in-memory per API process. They are acceptable for earliest single-process MVP hardening, but production PM2 cluster mode or multiple API servers should move rate limiting to Redis or another shared store.
- The `/vendor-operational-setup` web page is a minimal development surface, not a production-ready guided onboarding experience.
- Marketplace pages read the live API through `NEXT_PUBLIC_API_BASE_URL` or `http://localhost:4000`; they show API-unavailable states when the API is not running, but no local seeded marketplace/RFQ data or web e2e tests exist yet.
- Marketplace budget filtering currently uses catering minimums and validates budget ranges; richer price-fit matching should wait for RFQ/quote estimate models.
- RFQ attachments now support durable file upload records and signed download URLs with authorization, but RFQ detail pages still primarily display submitted attachment metadata and do not yet provide a polished post-submit attachment upload UI. Direct-to-object-storage browser uploads and virus scanning remain deferred.
- RFQ messaging now supports RFQ-scoped threads, persisted messages, customer clarification replies, and basic read cursors/unread counts; standalone message inboxes, templates, attachments, delivery notifications, quote revision request message threading, and richer read-receipt UI remain deferred.
- Quote creation, revisions, customer review, server-side totals, expiration, assumptions/exclusions, payment schedule setup, agreement signing, signed metadata, document file-record hooks, platform fee records, vendor invoice records, deposit payment records, Stripe checkout/webhook handling, and calendar booking confirmation now exist. Automated invoice delivery, platform invoice payment tracking, refunds/payout reconciliation, advanced route optimization, full staffing scheduling, and production upload/PDF flows remain deferred.
- The customer RFQ form persists drafts only in browser `localStorage`; backend draft create/update/resume APIs remain deferred.
- The customer RFQ frontend now uses the shared customer login/account selector for submission instead of a pasted customer bearer token.
- The vendor RFQ dashboard, inbox, and detail pages now use the shared vendor login/account selector and active vendor dropdown instead of pasted vendor tokens.
- The customer dashboard/RFQ detail pages use the available RFQ list/detail/message/quote/agreement APIs. Customer cancellation and additional uploads remain stubs or deferred; deposit payment now has a dedicated page.
- Quote payment schedules are linked to agreements during draft generation, and required deposits can create payment records and Stripe Checkout sessions. Milestone/final balance payment collection, refunds, and payout logic remain deferred.
- Agreement draft and signed document records use real storage when the storage service is configured, and private file download URLs are authorized and audited. The signed agreement PDF is still a minimal generated placeholder, not a polished legal PDF rendering system; virus scanning remains deferred.
- No browser E2E tests or live API smoke test with seeded customer/vendor data were run for the RFQ, quote, agreement, payment, billing, or vendor frontend flows in this chat.
- Platform invoice generation currently creates issued internal invoice records and line items, but it does not email invoices, render PDF invoices, collect platform invoice payment, or mark invoices paid.
- Zero-dollar platform fee records can be visible as pending billing records but are excluded from invoice line generation because invoice line items enforce non-zero amounts.
- Scheduling conflict detection is advisory in this MVP. Overlapping confirmed catering, blocked time, and blocking manual events are returned as hard conflict warnings, but deposit webhooks are not failed after the external payment has succeeded.
- Travel/setup buffer warnings use configured default buffer minutes only; no maps API, route optimization, or actual drive-time calculation exists yet.
- Event operations run sheets are currently read-only projections from RFQ, agreement, quote, payment, and calendar data. Persisted checklist completion, editable prep/staffing notes, and full staffing assignment workflows remain deferred.
- Manual calendar events can be created but not edited or dragged in the UI yet.
- Notification delivery uses a development/mock email provider only; no production email provider, template management, bounce handling, unsubscribe footer, or provider webhook ingestion exists yet.
- Notification worker processing is polling-based and now has a PM2 process config and deployment smoke-check process presence check, but no live worker deployment check has been run on a VPS yet.
- Notification dead-lettered jobs are stored on `outbox_events`, but no admin diagnostics page or manual retry API was built in this phase.
- Notification center UI now uses the shared account selector; realtime/WebSocket updates, browser push, and SMS are deferred.
- Admin operations now support the MVP workflow for vendor approval, marketplace visibility moderation, RFQ/dispute review, payment monitoring, Stripe webhook diagnostics, and platform billing access, with shared admin login and searchable vendor selection. Separate polished admin pages remain deferred.
- RFQ dispute status and admin notes are intentionally represented as audit log records for this MVP; a dedicated dispute case table, assignments, SLAs, attachments, and automated dispute resolution remain deferred.
- Admin payment monitoring exposes payment attempts and Stripe webhook failures, but refund workflows, payout reconciliation, manual Stripe replay/reconciliation jobs, and platform invoice payment tracking remain future work.
- Admin dashboard counts are operational MVP counts, not advanced analytics. RFQ volume trends, quote conversion, GMV, vendor growth, and funnel analytics remain deferred.
- Platform billing admin already supports fee settings, pending fee review, and invoice generation. Adjustment line item workflows, CSV exports, invoice delivery, PDF invoices, and invoice payment collection remain deferred.
- UI navigation is now standardized, and authenticated pages share login/register plus saved-account selection. Role-based nav hiding, automatic redirects, and production-grade account management remain future UI work.
- `/vendor/onboarding`, `/vendor/menus`, and `/vendor/availability` are now reachable MVP route pages with operator-first guidance, but they do not yet replace the all-in-one `/vendor-operational-setup` API surface with polished form-based CRUD.
- Marketplace advanced filters from the functional requirements are partly represented through helper copy and current supported API filters. Dietary/dessert/onsite cooking/buffet/alcohol/equipment/distance sorting and true availability matching still need richer marketplace UI/API support.
- Customer RFQ cancellation, post-submit attachment upload polish, milestone/final balance collection UI, refund/dispute customer flows, and customer-facing event reminder pages remain open UI gaps.
- Vendor messaging is RFQ-detail based with clarification templates, but there is still no standalone vendor/customer message inbox, attachment-in-message UI, reusable template manager, or richer read receipt display.
- Admin vendor approval, RFQ/dispute review, payment monitoring, marketplace moderation, and Stripe diagnostics are still consolidated in one minimal admin operations console rather than separate polished admin pages.
- Browser E2E/mobile visual tests were not added. The UI coverage added in this phase is route-level MVP verification, a lightweight route/navigation test, plus web typecheck/lint/build.

## Recommended Post-MVP Roadmap

1. Staging and production readiness:
   - Stand up a staging PostgreSQL database, run all Drizzle migrations, run database-backed tests with `TEST_DATABASE_URL`, and execute a seeded staging smoke test against the built API/web apps.
   - Validate real Stripe Connect onboarding, account readiness webhooks, Checkout, payment success/failure webhooks, and duplicate webhook handling with Stripe test mode.
   - Deploy to the target VPS or staging VPS with Apache2, PM2, PostgreSQL backups, worker process, SSL, and the existing smoke-test scripts.

2. Account and role UX polish:
   - Extend the shared login/register and saved-account selector with password reset, email verification, session expiry handling, role-aware navigation, and automatic route redirects.
   - Add guided vendor onboarding forms for profile, menus, availability, Stripe, and billing terms to replace the all-in-one development surface.

3. Browser workflow confidence:
   - Add Playwright or equivalent browser E2E coverage for the primary customer/vendor/admin happy path, including mobile RFQ submission and vendor day-of run-sheet views.
   - Add accessibility checks for RFQ, agreement signature, payment, and run-sheet pages.

4. Operational depth:
   - Add editable run-sheet checklist completion, staffing/prep note persistence, manual calendar event editing, and clearer conflict workflows.
   - Expand messaging into standalone customer/vendor inboxes with attachments, reusable templates, and richer read states.

5. Money, documents, and admin operations:
   - Add final/milestone balance collection, refund/dispute workflows, payout reconciliation, platform invoice delivery/payment tracking, CSV exports, and admin retry/reconciliation tools.
   - Upgrade agreement and platform invoice PDFs from placeholders to polished generated documents, and add production object storage direct uploads plus malware scanning.

6. Marketplace growth:
   - Add advanced marketplace filters, true availability matching, distance sorting, richer vendor media/profile moderation, analytics, and customer event reminders.

## Next Recommended Prompt

Read `docs/build-progress.md`, `docs/production-runbook.md`, `deploy/production.env.example`, `ecosystem.config.cjs`, `.github/workflows/deploy.yml`, and the deployment sections of the architecture/TDD. Move the verified MVP into staging: configure a staging PostgreSQL database and environment file, run migrations and database-backed tests, configure Stripe test-mode Connect/Checkout/webhooks, run API/web/worker smoke tests, and validate the deployment scripts against a staging or VPS host. Keep new product features out of scope; update `docs/build-progress.md` with command results, staging-specific fixes, remaining operational gaps, and the next prompt.
