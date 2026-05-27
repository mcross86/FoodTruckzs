# foodtruckzs Architecture Design Document

Document ID: ADD-001

Status: Proposed

Source: `docs/product-requirements-document.md`

## 1. Executive Summary

foodtruckzs should be built as a production-grade modular monolith first, not as a distributed microservices platform. The product has multiple clear business domains, but a solo founder or small team will move faster and operate more reliably with one well-structured backend deployable, one PostgreSQL database, and explicit internal service boundaries.

The recommended architecture is:

- Next.js, TypeScript, and TailwindCSS for the customer marketplace, vendor operations portal, and admin interfaces.
- Node.js and TypeScript backend using Fastify as the primary HTTP framework.
- PostgreSQL as the system of record.
- Drizzle ORM for typed SQL-first data access and migrations.
- JWT access tokens with refresh token rotation.
- Stripe Connect for customer down payments, future event invoice payments, refunds, and vendor payouts.
- Platform billing records for foodtruckzs agreement fees invoiced to catering companies.
- Apache2 as the public reverse proxy on Ubuntu.
- PM2 or systemd for process supervision.
- A transactional outbox table for event-ready behavior before introducing external queues.
- Optional Redis later for job queues, rate limiting, caching, and distributed locks once traffic or operational complexity justifies it.

The central architectural decision is to separate the system by domain modules inside a single backend. Marketplace, RFQ, vendor operations, agreements, scheduling, payments, notifications, and admin should each have their own routes, DTOs, services, repositories, authorization policies, and tests. This gives the product clean ownership boundaries now and a practical path to horizontal scaling or service extraction later.

This architecture optimizes for production readiness, maintainability, secure money movement, clear data ownership, and operational simplicity on a VPS.

## 2. Architectural Goals

### Primary Goals

- Build a real SaaS platform foundation, not a prototype.
- Keep business logic isolated from HTTP route handlers.
- Preserve clean domain boundaries while avoiding premature microservices.
- Use PostgreSQL relational modeling for quote, agreement, payment, calendar, and messaging workflows.
- Make RFQ lifecycle transitions explicit, validated, and auditable.
- Support vendor-specific operational workflows without leaking one vendor's data to another.
- Use Stripe Connect in a way that lets caterers collect customer payments while keeping foodtruckzs monetization as a separate agreement-fee invoicing workflow.
- Design for async notifications, webhook processing, and eventual background workers from the beginning.
- Support deployment to a single Ubuntu VPS while keeping a future migration path to managed cloud infrastructure.

### Architectural Style

The backend should use a layered modular monolith:

```text
HTTP transport
  -> routes/controllers
  -> DTO validation
  -> authorization policies
  -> application services
  -> domain services
  -> repositories
  -> PostgreSQL
```

Controllers should be thin. Services should own use cases and business rules. Repositories should own database access. Shared infrastructure should provide cross-cutting capabilities such as auth, logging, transactions, error handling, file storage, events, and Stripe integration.

### Non-Goals

- Do not split into microservices for MVP.
- Do not introduce Kubernetes for the initial VPS deployment.
- Do not use NoSQL as the primary database for core transactional workflows.
- Do not put payment state only in Stripe; Stripe is the payment processor, but PostgreSQL remains the platform ledger and audit record.
- Do not rely on route handlers for business logic.

## 3. Non-Functional Requirements

### Scalability

The initial system should scale vertically on a VPS and be designed to scale horizontally later.

- Stateless API processes should be able to run as multiple PM2 instances.
- PostgreSQL should remain the primary bottleneck to tune first through indexes, query plans, connection pooling, and read optimization.
- Background jobs should initially use a database-backed outbox and worker process.
- Redis can be added when queue throughput, distributed rate limits, or caching requirements become real.
- File assets should move to object storage before marketplace image volume becomes operationally painful on the VPS.

### Availability

The MVP target should be a reliable single-region deployment with strong backup and recovery practices.

- Apache2 terminates TLS and routes requests to application processes.
- PM2 or systemd restarts crashed Node.js processes.
- PostgreSQL backups run daily with point-in-time recovery considered as the platform matures.
- Stripe webhooks are idempotent and retry-safe.
- Background jobs are retryable and observable.

### Performance

Expected early bottlenecks are search, vendor discovery, calendar queries, and dashboard aggregation.

- Use targeted PostgreSQL indexes for marketplace filtering, RFQ status views, unread messages, date-range event queries, and payment lookups.
- Use cursor pagination for large collections.
- Keep dashboard endpoints purpose-built rather than asking the frontend to assemble many expensive queries.
- Add caching after measuring real query latency.

### Maintainability

The codebase should be organized by domain, not by technical layer alone.

- Each domain module owns its routes, DTOs, services, repositories, schema fragments, policies, tests, and events.
- Shared utilities should be limited to infrastructure concerns.
- Business rules belong in services or domain helpers, not route handlers.
- Database migrations must be versioned and reviewed.
- Tests should focus on lifecycle rules, authorization, payments, and scheduling conflict detection.

### Security

The system must protect customer data, vendor operational data, signed agreements, and payment workflows.

- Enforce RBAC and vendor-scoped authorization on every protected route.
- Store password hashes using Argon2id or bcrypt with strong parameters.
- Use short-lived JWT access tokens and rotating refresh tokens.
- Never store raw card data.
- Validate all inbound DTOs.
- Use parameterized queries through Drizzle.
- Keep secrets in environment variables outside source control.
- Add audit logs for sensitive actions.

### Observability

Production behavior should be debuggable from day one.

- Structured JSON logs with request IDs.
- Error tracking for backend and frontend.
- Health checks for API, database, and worker process.
- Metrics for request latency, error rate, background jobs, webhook failures, and payment state transitions.
- Uptime monitoring from an external provider.

## 4. Recommended Tech Stack

### Frontend: Next.js + TypeScript + TailwindCSS

Next.js is recommended because the product needs SEO-friendly vendor marketplace pages, authenticated application screens, route-level layouts, server-rendered pages where useful, and a mature deployment path. TypeScript gives shared type discipline across frontend and backend. TailwindCSS supports fast UI development with consistent styling for customer, vendor, and admin interfaces.

Tradeoff: Next.js adds framework conventions and deployment considerations, but the marketplace SEO and app routing benefits justify it.

### Backend Runtime: Node.js + TypeScript

Node.js is a strong fit for a marketplace operations platform with API orchestration, Stripe webhooks, messaging, notifications, and dashboard endpoints. TypeScript is required for maintainability as domain complexity grows.

Tradeoff: CPU-heavy workloads should not live in the request path. If future AI, document rendering, or optimization workloads become heavy, move them to workers or specialized services.

### HTTP Framework: Fastify

Fastify is recommended over Express for new development because it has strong performance, a plugin architecture, schema-friendly request validation, good lifecycle hooks, and clean TypeScript support.

Express remains acceptable if team familiarity is materially higher, but Fastify is the better long-term default for a greenfield production API.

### Database: PostgreSQL

PostgreSQL should be the primary database because the product is relational and transactional: RFQs, quotes, quote revisions, agreements, payments, messages, calendar events, vendors, users, and audit logs all need referential integrity.

Tradeoff: PostgreSQL can support substantial scale, but it must be modeled carefully. Avoid unbounded JSON blobs for core domain state.

### ORM: Drizzle

Drizzle is recommended because it is SQL-forward, type-safe, migration-friendly, and less magical than heavier ORMs. The product will need explicit queries for dashboards, lifecycle views, and reporting, so staying close to SQL is an advantage.

Tradeoff: Drizzle may require more explicit repository code than a high-level ORM. That is acceptable because explicit data access is easier to optimize and audit.

### Authentication: JWT + Refresh Tokens

Use short-lived JWT access tokens for API requests and rotating refresh tokens stored server-side as hashed records. This gives stateless authorization for normal requests while preserving logout, revocation, and session tracking.

Tradeoff: JWTs require careful token lifetime and revocation strategy. Do not use long-lived JWTs.

### Payments: Stripe Connect

Stripe Connect is the correct payment foundation for a marketplace that allows food truck caterers to collect customer down payments and, later, full event invoice payments or onsite payments. It handles connected accounts, compliance-heavy payment flows, refunds, and payouts better than custom payment infrastructure.

Tradeoff: Stripe state is eventually consistent through webhooks, so the platform must implement idempotent webhook handling and internal payment state reconciliation.

### Platform Billing: Signed Agreement Fees

foodtruckzs monetization should be modeled separately from customer payments. The platform charges food truck caterers a standard percentage of each signed catering agreement. The percentage is configurable per vendor account and has no amount cap. When an agreement is signed, the system creates a platform billing record and later invoices the catering company.

Tradeoff: invoicing the caterer separately is operationally simpler for MVP and avoids coupling platform revenue collection to every customer deposit flow. The platform must still maintain clear receivables, invoice status, and audit history.

### Reverse Proxy: Apache2

Apache2 fits the stated GoDaddy VPS environment and can terminate SSL, redirect HTTP to HTTPS, serve static files if needed, and proxy API/web traffic to Node.js processes.

Tradeoff: Nginx is more common for Node reverse proxy deployments, but Apache2 is acceptable and production-capable when configured carefully.

### Process Manager: PM2

PM2 is recommended for the initial Node.js deployment because it provides process supervision, clustered Node processes, logs, restart policies, and simple operational commands.

Tradeoff: systemd is more native to Linux and may be preferred later for stricter ops. PM2 is practical for a small team.

### Redis: Optional, Phase 2

Do not require Redis for the first deploy unless background jobs, rate limiting, or caching need it immediately. Start with PostgreSQL-backed outbox and job tables. Add Redis when the app needs BullMQ, distributed locks, shared rate limiting, ephemeral caching, or WebSocket fanout support.

## 5. High-Level System Architecture

### System Components

```text
Users
  -> Browser / Mobile Web
  -> Next.js Frontend
  -> Apache2 Reverse Proxy
  -> Node.js API
  -> PostgreSQL

Node.js API
  -> Stripe Connect
  -> Email Provider
  -> SMS Provider (optional)
  -> Object Storage
  -> Background Worker
```

### Frontend

The frontend should be a single Next.js application with role-aware areas:

- Public marketplace: vendor discovery, vendor profiles, cuisine/category search, service area search, RFQ entry.
- Customer portal: RFQs, messages, quote review, agreement signing, deposits, event status.
- Vendor portal: dashboard, RFQ inbox, quote builder, menus, availability, calendar, agreements, payments.
- Admin portal: vendor approval, marketplace moderation, disputes, payouts, analytics, featured vendors.

The frontend should not directly contain business rules for RFQ transitions, payments, or authorization. It should call backend APIs and render state returned by the server.

### Backend APIs

The backend exposes versioned REST APIs under `/api/v1`. API modules should align with product domains. Each module should validate input DTOs, enforce authorization policies, call application services, and return consistent responses.

### Database

PostgreSQL is the system of record. It stores:

- Users, roles, sessions, and vendor memberships.
- Vendor profiles, menus, cuisines, service areas, and media references.
- RFQs, status history, quote revisions, messages, and approvals.
- Agreements, signatures, document versions, and event confirmations.
- Calendar events, availability windows, blackout dates, and conflict records.
- Customer payments, Stripe objects, refunds, payouts, platform agreement fees, caterer invoices, and transaction history.
- Notifications, preferences, delivery attempts, and event outbox records.
- Audit logs.

### Infrastructure

Initial infrastructure runs on a GoDaddy VPS:

- Ubuntu Linux.
- Apache2 for SSL termination and reverse proxy.
- Node.js app managed by PM2.
- PostgreSQL on the same VPS for earliest stage, with a recommendation to move PostgreSQL to a separate managed host when revenue or traffic justifies it.
- Local filesystem only for temporary uploads. Durable documents and images should use object storage as early as possible.

### External Integrations

- Stripe Connect for customer-to-caterer payment processing and vendor payouts.
- Email provider such as Postmark, SendGrid, Resend, or AWS SES.
- SMS provider such as Twilio when SMS reminders become necessary.
- Object storage such as AWS S3, Cloudflare R2, Backblaze B2, or DigitalOcean Spaces.
- Optional error tracking such as Sentry.
- Optional uptime monitoring such as Better Stack, UptimeRobot, or Pingdom.

## 6. Backend Architecture

### Recommended Folder Structure

```text
apps/
  api/
    src/
      app.ts
      server.ts
      config/
        env.ts
        logger.ts
      db/
        client.ts
        schema/
        migrations/
        transaction.ts
      modules/
        auth/
          auth.routes.ts
          auth.controller.ts
          auth.service.ts
          auth.repository.ts
          auth.dto.ts
          auth.policy.ts
          auth.types.ts
        users/
        marketplace/
        vendors/
        rfqs/
        quotes/
        messages/
        agreements/
        scheduling/
        payments/
        notifications/
        admin/
      shared/
        errors/
        http/
        middleware/
        policies/
        events/
        storage/
        stripe/
        validation/
        utils/
      workers/
        worker.ts
        jobs/
      tests/
        integration/
        unit/
  web/
    app/
    components/
    lib/
    features/
packages/
  shared/
    src/
      types/
      constants/
      validators/
docs/
```

For a small team, a monorepo is recommended. It allows shared TypeScript types and validation schemas without creating separate repositories or deployment complexity.

### Domain Modularization

Each domain module should own its local business capabilities:

- `marketplace`: vendor discovery, search, public profiles, cuisine/category filtering.
- `vendors`: vendor accounts, profiles, service areas, onboarding, approval state.
- `rfqs`: RFQ creation, lifecycle transitions, clarification requests, status history.
- `quotes`: quote builder, line items, revisions, customer approval.
- `messages`: threaded customer/vendor communication.
- `agreements`: agreement generation, document versions, signatures, storage references.
- `scheduling`: availability, blackout dates, manual events, catering bookings, conflict detection.
- `payments`: Stripe Connect accounts, customer down payments, future invoice payments, refunds, payouts, webhooks.
- `billing`: signed-agreement fee calculation, vendor-specific fee percentages, foodtruckzs invoices to catering companies.
- `notifications`: notification preferences, outbox events, email/SMS/in-app delivery.
- `admin`: vendor approval, disputes, moderation, analytics, payout review.

Modules may call other modules through public service interfaces, not by directly importing repositories from another domain. This keeps boundaries enforceable.

### Route and Controller Structure

Routes define HTTP endpoints and middleware. Controllers translate HTTP requests into service calls. Controllers should not contain business rules.

Controller responsibilities:

- Parse authenticated user context.
- Validate request DTOs.
- Call application service methods.
- Map service results to HTTP responses.
- Let centralized error handling manage exceptions.

Controller anti-patterns:

- Direct database queries.
- Payment calculations.
- RFQ state transition decisions.
- Vendor authorization logic.
- Stripe webhook side effects without idempotency.

### Services

Application services implement use cases.

Examples:

- `RfqService.submitRfq(customerId, dto)`
- `RfqService.requestClarification(vendorUserId, rfqId, dto)`
- `QuoteService.createRevision(vendorUserId, rfqId, dto)`
- `AgreementService.generateFromAcceptedQuote(quoteId)`
- `SchedulingService.createBookingFromConfirmedDeposit(paymentId)`
- `PaymentService.createDepositCheckoutSession(rfqId, quoteId)`
- `NotificationService.enqueueForEvent(event)`

Services should:

- Enforce lifecycle rules.
- Enforce transaction boundaries.
- Call repositories.
- Emit domain events through the outbox.
- Avoid HTTP-specific types.

### Repositories

Repositories encapsulate database access and return typed domain records or persistence models.

Repository responsibilities:

- Query composition.
- Insert/update/delete operations.
- Locking records for transactional workflows.
- Mapping database rows into service-level objects where useful.

Repositories should not:

- Decide whether a customer can approve a quote.
- Decide payment state transitions.
- Send notifications.
- Call Stripe.

### DTO Validation

Use runtime validation for every inbound request. Recommended options:

- Zod for DTO validation shared between frontend and backend.
- Fastify JSON Schema if the team prefers framework-native validation.

DTOs should exist for:

- Auth requests.
- Vendor profile updates.
- RFQ creation and updates.
- Quote line items and revisions.
- Agreement signing.
- Availability windows.
- Calendar event creation.
- Payment checkout creation.
- Admin actions.

Validation should reject unknown or unsafe fields. Do not pass raw request bodies into repositories.

### Middleware

Core middleware:

- Request ID injection.
- Structured request logging.
- Secure headers.
- CORS configuration.
- Authentication.
- RBAC and vendor context loading.
- Rate limiting.
- Body size limits.
- Error handling.

Middleware should be infrastructure-focused. Business authorization belongs in policies and services.

### Auth Architecture

Authentication should produce a request context:

```text
RequestContext
  userId
  roles
  activeVendorId
  vendorMemberships
  sessionId
  requestId
```

Routes requiring vendor access should load and verify vendor membership before service calls. Admin routes should require platform admin roles.

### Transaction Handling

Use explicit transaction wrappers for workflows that update multiple tables.

Examples requiring transactions:

- Submit RFQ and create initial status history.
- Create quote revision and update RFQ status.
- Accept quote and create agreement draft.
- Sign agreement and update agreement history.
- Mark deposit paid from Stripe webhook and create confirmed catering event.
- Create refund record and update payment state.

Use row-level locks for high-risk concurrent transitions:

- Quote acceptance.
- Agreement signing.
- Calendar booking confirmation.
- Payment state changes.

## 7. API Design Standards

### REST Conventions

Use resource-oriented REST endpoints with clear nouns.

Examples:

```text
GET    /api/v1/vendors
GET    /api/v1/vendors/:vendorId
POST   /api/v1/rfqs
GET    /api/v1/rfqs/:rfqId
POST   /api/v1/rfqs/:rfqId/messages
POST   /api/v1/rfqs/:rfqId/quotes
POST   /api/v1/quotes/:quoteId/accept
POST   /api/v1/agreements/:agreementId/sign
GET    /api/v1/vendors/:vendorId/calendar-events
POST   /api/v1/payments/deposits/checkout-session
POST   /api/v1/webhooks/stripe
```

Use action endpoints only for domain commands that do not map cleanly to CRUD, such as `accept`, `sign`, `cancel`, `request-clarification`, or `submit`.

### Versioning

Prefix all APIs with `/api/v1`. Breaking changes should create `/api/v2` rather than silently changing contracts.

### Pagination

Use cursor pagination for large collections:

```text
GET /api/v1/vendors?cursor=abc&limit=25
```

Offset pagination is acceptable only for small admin views where deterministic ordering is not critical.

### Filtering

Marketplace filters should be explicit query parameters:

```text
GET /api/v1/vendors?cuisine=mexican&metro=atlanta&minGuests=50&serviceStyle=onsite
```

For complex internal dashboards, prefer purpose-built endpoints over generic query builders.

### Sorting

Allow documented sort fields only:

```text
sort=rating
sort=createdAt
sort=eventDate
```

Never pass arbitrary sort column names into SQL.

### Error Responses

Use a consistent error shape:

```json
{
  "error": {
    "code": "RFQ_INVALID_STATUS_TRANSITION",
    "message": "RFQ cannot move from Cancelled to Quote Sent.",
    "requestId": "req_123",
    "details": {}
  }
}
```

Error categories:

- `400` validation errors.
- `401` unauthenticated.
- `403` unauthorized.
- `404` not found or not visible.
- `409` lifecycle conflict or idempotency conflict.
- `422` semantically invalid business request.
- `429` rate limited.
- `500` unexpected server error.

### Idempotency

Require idempotency keys for high-risk commands:

- Payment checkout creation.
- Quote acceptance.
- Agreement signing.
- Refund requests.
- Webhook processing.

Store idempotency keys with user, route, request hash, response hash, and expiration. Return the original response for safe retries.

### API Security

- Require HTTPS in production.
- Use secure cookies for refresh tokens if using browser sessions.
- Require Authorization headers for API access tokens.
- Scope all vendor resources by authenticated vendor membership.
- Enforce request body size limits.
- Rate limit auth, RFQ submission, messaging, and payment endpoints.
- Validate all IDs as UUIDs or documented ID formats.

## 8. Database Architecture

### PostgreSQL Schema Strategy

Use one physical PostgreSQL database with logical domain grouping. Drizzle schema files can be split by module while migrating into one database.

Recommended schemas:

- `public` for application tables initially.
- Optional future PostgreSQL schemas such as `billing`, `audit`, or `analytics` only when separation adds clarity.

### Multi-Tenant Considerations

foodtruckzs is marketplace multi-tenant, not enterprise single-tenant. The key tenant boundary is the vendor organization.

Recommended model:

- `users` represent people.
- `vendors` represent food truck businesses.
- `vendor_memberships` connect users to vendors with roles.
- Customer records can be linked to users and RFQs.
- Platform admins are global roles.

Every vendor-owned table should include `vendor_id` where appropriate:

- Menus.
- Availability.
- Calendar events.
- Quotes.
- Agreements.
- Payments.
- Vendor messages.

Customer-created RFQs may target one vendor or multiple vendors through an RFQ-vendor join table.

PostgreSQL Row Level Security can be considered later, but the initial implementation should enforce tenant isolation in service policies and repository query constraints with strong integration tests.

### Relational Modeling Principles

- Use UUID primary keys for public-facing resources.
- Use foreign keys for all domain relationships.
- Use enums carefully for stable lifecycle states.
- Use status history tables for workflows where auditability matters.
- Use JSONB only for flexible metadata, not primary business fields.
- Prefer join tables for many-to-many relationships.
- Add `created_at`, `updated_at`, and `deleted_at` where appropriate.
- Add `created_by_user_id` and `updated_by_user_id` for sensitive resources where useful.

### Indexing Strategy

Create indexes based on access patterns.

Marketplace:

- `vendors(status, is_published)`
- `vendor_service_areas(metro_area, state)`
- `vendor_cuisines(cuisine_id, vendor_id)`
- Full-text or trigram indexes for vendor name and description when search matures.

RFQs:

- `rfqs(customer_user_id, created_at)`
- `rfq_vendor_targets(vendor_id, status, created_at)`
- `rfq_status_history(rfq_id, created_at)`

Quotes:

- `quotes(rfq_id, vendor_id, status)`
- `quote_revisions(quote_id, revision_number)`

Messages:

- `message_threads(rfq_id)`
- `messages(thread_id, created_at)`
- `message_reads(user_id, message_id)`

Scheduling:

- `calendar_events(vendor_id, starts_at, ends_at)`
- Exclusion constraints or overlap indexes can be considered for confirmed catering events.

Payments:

- `payments(stripe_payment_intent_id)`
- `payments(rfq_id, quote_id)`
- `stripe_webhook_events(stripe_event_id)` unique.

Notifications:

- `notifications(user_id, read_at, created_at)`
- `outbox_events(status, available_at, created_at)`

### Soft Deletes

Use soft deletes for user-facing and audit-sensitive records:

- Vendors.
- Menus.
- Vendor profiles.
- RFQs.
- Quotes.
- Agreements.
- Calendar events.

Do not hard-delete payment, refund, payout, webhook, or audit records. For privacy deletion requests, anonymize personal fields while preserving required financial records.

### Audit History

Add audit tables for:

- RFQ status transitions.
- Quote revisions.
- Agreement versions and signatures.
- Payment state changes.
- Admin actions.
- Vendor approval changes.

Audit records should include:

- Actor user ID.
- Actor role.
- Entity type.
- Entity ID.
- Action.
- Previous state.
- New state.
- Request ID.
- IP address where appropriate.
- Timestamp.

### Migration Strategy

Use Drizzle migrations committed to source control.

Rules:

- No manual production schema edits.
- Every migration must be reversible or have a documented rollback plan.
- Avoid destructive migrations without backfills and deployment sequencing.
- Use expand-and-contract for breaking schema changes.
- Run migrations as part of deployment before starting the new application version.

## 9. Core Domain Models

### Users

`users` represent authenticated people.

Key fields:

- `id`
- `email`
- `password_hash`
- `first_name`
- `last_name`
- `phone`
- `status`
- `email_verified_at`
- `created_at`
- `updated_at`

Relationships:

- One user can be a customer.
- One user can belong to many vendors.
- One user can be a platform admin.
- One user can send many messages.
- One user can sign agreements.

Reasoning: Keep user identity separate from customer, vendor, and admin roles because a person may operate in multiple contexts.

### Vendors

`vendors` represent food truck catering businesses.

Key fields:

- `id`
- `business_name`
- `slug`
- `description`
- `status`
- `is_published`
- `approval_status`
- `primary_contact_user_id`
- `stripe_connect_account_id`
- `catering_minimum_cents`
- `pricing_summary`
- `created_at`
- `updated_at`
- `deleted_at`

Relationships:

- Vendor has many memberships.
- Vendor has many cuisines.
- Vendor has many service areas.
- Vendor has many menus.
- Vendor has many RFQ targets.
- Vendor has many quotes.
- Vendor has many calendar events.
- Vendor has one Stripe Connect account.

Reasoning: Vendor is the primary tenant boundary for operational data.

### Vendor Memberships

`vendor_memberships` connect users to vendors.

Key fields:

- `id`
- `vendor_id`
- `user_id`
- `role`
- `status`
- `created_at`

Roles:

- `owner`
- `manager`
- `staff`
- `viewer`

Reasoning: Vendor permissions need to be more granular than global app roles.

### Marketplace Profiles

Vendor profile data can live in `vendor_profiles` or on `vendors` depending on implementation preference. A separate profile table is cleaner as marketplace data grows.

Key fields:

- `vendor_id`
- `headline`
- `public_description`
- `service_styles`
- `dietary_accommodations`
- `operational_hours`
- `cover_image_file_id`
- `gallery_file_ids`

Reasoning: Operational vendor state and public marketplace presentation change at different rates.

### Menus

`menus` represent reusable vendor catering menus.

Key fields:

- `id`
- `vendor_id`
- `name`
- `description`
- `status`
- `seasonal_start`
- `seasonal_end`
- `created_at`
- `updated_at`

Related tables:

- `menu_items`
- `menu_packages`
- `menu_package_items`
- `menu_dietary_tags`

Reasoning: Menus are reused across quotes but quote revisions must snapshot selected menu details to preserve history.

### RFQs

`rfqs` represent customer catering requests.

Key fields:

- `id`
- `customer_user_id`
- `event_name`
- `event_type`
- `event_date`
- `starts_at`
- `ends_at`
- `venue_address_id`
- `is_indoor`
- `estimated_headcount`
- `budget_min_cents`
- `budget_max_cents`
- `quote_response_deadline`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Related tables:

- `rfq_vendor_targets`
- `rfq_food_requirements`
- `rfq_equipment_requests`
- `rfq_status_history`
- `message_threads`
- `quotes`

Reasoning: RFQ is the anchor workflow object. It should own event requirements and lifecycle state, while vendor-specific responses live in target and quote tables.

### RFQ Vendor Targets

`rfq_vendor_targets` records which vendors are invited or targeted.

Key fields:

- `id`
- `rfq_id`
- `vendor_id`
- `status`
- `responded_at`
- `rejected_reason`

Reasoning: A generalized RFQ may go to multiple vendors. Vendor-specific status should not be forced into the parent RFQ only.

### Quotes

`quotes` represent a vendor's commercial response to an RFQ.

Key fields:

- `id`
- `rfq_id`
- `vendor_id`
- `status`
- `current_revision_id`
- `subtotal_cents`
- `fees_cents`
- `tax_cents`
- `total_cents`
- `deposit_required_cents`
- `expires_at`
- `created_at`
- `updated_at`

Related tables:

- `quote_revisions`
- `quote_line_items`
- `quote_status_history`

Reasoning: Quotes are mutable during negotiation, but every change must create a revision. The accepted revision becomes the basis for agreement and payment.

### Quote Revisions

`quote_revisions` snapshot quote terms at a point in time.

Key fields:

- `id`
- `quote_id`
- `revision_number`
- `notes`
- `subtotal_cents`
- `fees_cents`
- `total_cents`
- `deposit_required_cents`
- `payment_schedule`
- `created_by_user_id`
- `created_at`

Reasoning: Negotiation history is core product value and legal context.

### Agreements

`agreements` represent the formal purchase agreement generated from an accepted quote revision.

Key fields:

- `id`
- `rfq_id`
- `quote_id`
- `quote_revision_id`
- `vendor_id`
- `customer_user_id`
- `status`
- `document_file_id`
- `signed_document_file_id`
- `generated_at`
- `signed_at`
- `created_at`

Related tables:

- `agreement_versions`
- `agreement_signatures`

Reasoning: Agreement documents must reference the exact quote revision they were generated from.

### Events

`events` or `catering_events` represent confirmed catering engagements.

Key fields:

- `id`
- `vendor_id`
- `rfq_id`
- `agreement_id`
- `customer_user_id`
- `title`
- `starts_at`
- `ends_at`
- `venue_address_id`
- `status`
- `source`
- `created_at`

Reasoning: Confirmed business events should be separate from RFQs so scheduling can operate cleanly across confirmed catering, manual vendor events, festivals, and blocked time.

### Calendar Events

`calendar_events` represent anything visible on a vendor calendar.

Key fields:

- `id`
- `vendor_id`
- `catering_event_id`
- `type`
- `title`
- `starts_at`
- `ends_at`
- `location`
- `status`
- `source`
- `created_by_user_id`

Types:

- `confirmed_catering`
- `manual_booking`
- `food_truck_location`
- `festival`
- `blocked_time`

Reasoning: Calendar needs a generalized event model, while confirmed catering retains deeper business fields.

### Availability

`availability_rules` and `availability_exceptions` define when vendors can accept catering.

Key fields:

- `vendor_id`
- `day_of_week`
- `starts_at_local`
- `ends_at_local`
- `timezone`
- `effective_start_date`
- `effective_end_date`

Exceptions:

- Blackout dates.
- Special hours.
- Capacity limitations.

Reasoning: Availability rules are not the same as booked events. Keep recurring availability separate from actual calendar entries.

### Payments

`payments` represent money owed and paid for a quote or agreement.

Key fields:

- `id`
- `rfq_id`
- `quote_id`
- `agreement_id`
- `vendor_id`
- `customer_user_id`
- `type`
- `status`
- `amount_cents`
- `currency`
- `processing_fee_cents`
- `processing_fee_cents`
- `stripe_payment_intent_id`
- `stripe_checkout_session_id`
- `created_at`
- `updated_at`

Related tables:

- `payment_attempts`
- `refunds`
- `payouts`
- `stripe_webhook_events`

Reasoning: Stripe is not the product ledger. The app needs its own payment records for support, dashboards, agreement history, and reconciliation.

### Platform Billing

`platform_agreement_fees` represent foodtruckzs revenue earned from signed catering agreements.

Key fields:

- `id`
- `agreement_id`
- `vendor_id`
- `signed_agreement_total_cents`
- `fee_percentage_basis_points`
- `fee_amount_cents`
- `currency`
- `status`
- `vendor_invoice_id`
- `calculated_at`
- `created_at`

Related tables:

- `vendor_billing_settings`
- `vendor_invoices`
- `vendor_invoice_line_items`

Reasoning: foodtruckzs should not rely on Stripe application fees for the initial monetization model. The platform fee is a receivable from the catering company, generated by signed agreement value and invoiced separately.

### Notifications

`notifications` represent in-app notifications. Delivery attempts are separate.

Key fields:

- `id`
- `user_id`
- `type`
- `title`
- `body`
- `entity_type`
- `entity_id`
- `read_at`
- `created_at`

Related tables:

- `notification_preferences`
- `notification_deliveries`
- `outbox_events`

Reasoning: In-app notifications are durable product state. Email and SMS are delivery channels.

### Messages

`message_threads` and `messages` support customer-vendor communication.

Thread fields:

- `id`
- `rfq_id`
- `vendor_id`
- `customer_user_id`
- `status`

Message fields:

- `id`
- `thread_id`
- `sender_user_id`
- `body`
- `attachment_file_id`
- `created_at`
- `deleted_at`

Reasoning: RFQ-specific messages need auditability and should remain attached to quote history.

## 10. Authentication & Authorization

### JWT Strategy

Use short-lived access tokens:

- Lifetime: 10 to 15 minutes.
- Contains user ID, session ID, global roles, and active vendor ID if selected.
- Signed with a strong secret or asymmetric key pair.

Use refresh tokens:

- Lifetime: 14 to 30 days.
- Stored as secure, HttpOnly, SameSite cookies for browser clients.
- Hashed in database.
- Rotated on use.
- Revoked on logout, password reset, suspicious activity, or admin action.

### RBAC

Global roles:

- `customer`
- `vendor_user`
- `platform_admin`
- `support_admin`

Vendor roles:

- `owner`
- `manager`
- `staff`
- `viewer`

### Permission Examples

Customers can:

- Create RFQs.
- View their own RFQs.
- Send messages in their own RFQ threads.
- Accept quotes sent to them.
- Sign their own agreements.
- Pay deposits for their own agreements.

Vendors can:

- View RFQs targeted to their vendor.
- Respond to RFQs.
- Create and revise quotes.
- Manage menus and availability.
- Manage calendar events for their vendor.
- View vendor payment records.

Platform admins can:

- Approve vendors.
- Moderate marketplace profiles.
- View disputes.
- Monitor payouts.
- Access aggregate analytics.

### Authorization Rules

Every protected service method should enforce visibility:

- User owns the customer-side resource.
- User belongs to the vendor that owns the resource.
- User has a platform admin role.

Do not rely on frontend hiding controls for authorization.

## 11. File & Document Storage

### Storage Categories

The platform needs to store:

- Vendor food photography.
- Menu PDFs or uploads.
- RFQ attachments.
- Generated agreement PDFs.
- Signed agreement PDFs.
- Payment or dispute attachments.

### Recommended Approach

Use object storage for durable files as early as possible. Recommended providers:

- AWS S3.
- Cloudflare R2.
- Backblaze B2.
- DigitalOcean Spaces.

Store only metadata in PostgreSQL:

- `files.id`
- `storage_provider`
- `bucket`
- `object_key`
- `content_type`
- `size_bytes`
- `checksum`
- `visibility`
- `owner_user_id`
- `vendor_id`
- `created_at`

### Local VPS Considerations

Local VPS disk storage is acceptable only for:

- Temporary upload staging.
- Generated files before upload.
- Development environments.

It should not be the long-term source of truth for signed agreements or marketplace images. VPS disk backups are not a substitute for object storage durability.

### Access Control

- Public vendor images can use public CDN URLs.
- Agreements, attachments, and payment-related documents should use signed URLs with short expiration.
- File downloads must verify authorization before creating signed URLs.

## 12. Payment Architecture

### Stripe Connect Model

Each vendor should onboard to Stripe Connect as a connected account if they want to collect customer down payments or future event payments in app. The platform creates payment intents or checkout sessions for customer payments owed to the caterer. The initial foodtruckzs monetization model should not depend on deducting an application fee from these customer payments; platform fees are calculated separately and invoiced to the catering company.

Recommended flow:

1. Vendor completes Stripe Connect onboarding.
2. Vendor defines deposit requirement and payment schedule in quote.
3. Customer accepts quote.
4. Agreement is generated and signed.
5. System calculates the foodtruckzs agreement fee using the vendor-specific percentage and creates a platform billing record.
6. Customer pays required deposit through Stripe Checkout or Payment Element if the agreement requires a down payment.
7. Stripe webhook confirms payment.
8. Platform marks deposit paid.
9. System creates confirmed catering event when the agreement and required deposit conditions are satisfied.
10. Vendor payout/payment status is tracked according to Stripe Connect configuration.
11. foodtruckzs invoices the catering company for the platform agreement fee.

### Platform Agreement Fee Billing

The monetization model is a standard percentage fee on signed catering agreements.

Requirements:

- Fee percentage is configurable per vendor account.
- Fee percentage should be stored as basis points for precision.
- There is no amount cap.
- Fee amount is calculated from the signed agreement total, not from customer-entered payment amounts.
- Fee becomes billable when the agreement is signed.
- Fee records are immutable after invoice issuance; corrections use adjustment line items.
- Caterer invoices can group multiple signed-agreement fees over a billing period.
- Platform billing status should be independent of customer deposit status.

Recommended statuses:

- `pending_invoice`
- `invoiced`
- `paid`
- `void`
- `adjusted`

### Deposit and Milestone Logic

Represent every expected customer payment as a `payment_schedule_items` record:

- Deposit.
- Milestone payment.
- Final balance.
- Future event invoice payment with payment terms.
- Future onsite payment collection.

Each schedule item can create one or more payment attempts. This allows retries and failed payments without corrupting the payment plan.

### Payout Lifecycle

Track payouts separately:

- `pending`
- `in_transit`
- `paid`
- `failed`
- `cancelled`

Do not assume a successful customer payment means the vendor payout has completed. Stripe payout state arrives through webhooks and reconciliation.

### Refunds

Refunds should be first-class records:

- Refund amount.
- Refund reason.
- Requested by.
- Approved by.
- Stripe refund ID.
- Status.
- Related cancellation policy.

Refunds must be idempotent and auditable.

### Webhook Handling

Stripe webhook endpoint requirements:

- Verify Stripe signature.
- Store `stripe_event_id` with a unique constraint.
- Return success for already-processed events.
- Process side effects in a transaction.
- Emit outbox events for notifications.
- Log failures with enough context for replay.

### Transactional Integrity

Payment state changes should be handled as state machines. Examples:

- `requires_payment` -> `checkout_created` -> `processing` -> `succeeded`
- `succeeded` -> `refund_pending` -> `partially_refunded`
- `succeeded` -> `refund_pending` -> `refunded`

Use database transactions for internal state updates, but do not hold a database transaction open while making external Stripe API calls. Instead:

1. Write intent to database.
2. Call Stripe.
3. Write Stripe response.
4. Rely on webhook for final confirmation.

## 13. Notification Architecture

### Event-Driven Foundation

Use a transactional outbox table from the beginning.

When business services complete important transitions, they write domain events into `outbox_events` in the same transaction:

- `rfq.submitted`
- `rfq.clarification_requested`
- `quote.sent`
- `quote.accepted`
- `agreement.ready`
- `agreement.signed`
- `payment.deposit_paid`
- `event.confirmed`
- `schedule.conflict_detected`

A worker process polls pending outbox events and dispatches notifications.

### Delivery Channels

Initial channels:

- In-app notifications.
- Email notifications.

Future channel:

- SMS notifications for time-sensitive reminders.

### Retry Handling

Notification delivery attempts should track:

- Channel.
- Provider message ID.
- Status.
- Attempt count.
- Last error.
- Next retry time.

Use exponential backoff for transient failures. After max retries, mark as failed and expose in admin diagnostics.

### Notification Preferences

Users should have preferences by notification type and channel:

- RFQ updates.
- Quote updates.
- Agreement updates.
- Payment updates.
- Event reminders.
- Marketing messages.

Transactional notifications should not be fully suppressible if they are required for account, payment, or agreement integrity.

## 14. Deployment Architecture

### Initial VPS Topology

```text
Internet
  -> DNS
  -> Apache2 HTTPS VirtualHost
  -> Next.js process
  -> API process
  -> PostgreSQL
  -> Worker process
```

This can run on one GoDaddy VPS initially if resources are sufficient. PostgreSQL should be moved to separate managed infrastructure when data durability, load, or operational risk justifies the cost.

### Ubuntu Setup

Install and configure:

- Node.js LTS.
- pnpm or npm.
- PostgreSQL.
- Apache2.
- Certbot for Let's Encrypt SSL.
- PM2.
- Firewall using UFW.
- Fail2ban for SSH hardening.

### Apache2 Reverse Proxy

Apache should:

- Redirect HTTP to HTTPS.
- Terminate TLS.
- Proxy `/api` to the API process.
- Proxy frontend routes to Next.js.
- Set secure headers.
- Enforce upload size limits.
- Preserve `X-Forwarded-For` and `X-Forwarded-Proto`.

### PM2 Process Layout

Recommended PM2 apps:

- `foodtruckzs-web`
- `foodtruckzs-api`
- `foodtruckzs-worker`

Use separate environment variables and logs for each process.

### SSL

Use Let's Encrypt certificates through Certbot. Enable auto-renewal and monitor certificate expiration.

### Environment Variables

Use `.env.production` on the server or injected environment variables. Do not commit secrets.

Required categories:

- Database URL.
- JWT secrets or private keys.
- Stripe secret key.
- Stripe webhook secret.
- Email provider key.
- Object storage credentials.
- App URLs.
- CORS origins.
- Log level.

### CI/CD Recommendations

For a small team:

1. Push to GitHub.
2. Run CI checks: typecheck, lint, tests, migration validation.
3. Build frontend and backend.
4. Deploy to VPS over SSH using GitHub Actions.
5. Run migrations.
6. Restart PM2 processes.
7. Run smoke checks.

Avoid complex deployment platforms until operational needs demand them.

### Backups

Minimum backup posture:

- Daily PostgreSQL logical backup.
- Backup retention of at least 14 to 30 days.
- Encrypted backup storage off the VPS.
- Periodic restore test.
- Object storage lifecycle and versioning for critical documents.

### Monitoring and Logging

- PM2 process health.
- Apache access and error logs.
- Application structured logs.
- PostgreSQL disk usage and connection counts.
- External uptime checks.
- Error tracking alerts.

## 15. Scalability Roadmap

### Stage 1: Single VPS

Scale vertically:

- More CPU/RAM.
- PM2 cluster mode.
- Query optimization.
- Better indexes.
- Asset offload to object storage/CDN.

### Stage 2: Separate Database and Storage

Move stateful services out of the app server:

- Managed PostgreSQL or dedicated database VPS.
- Object storage for files.
- CDN for public images.

### Stage 3: Add Redis and Dedicated Workers

Introduce Redis when needed for:

- BullMQ background jobs.
- Distributed rate limiting.
- Short-lived cache.
- Calendar conflict locks.
- WebSocket or realtime notification fanout.

### Stage 4: Horizontal API Scaling

Run multiple API instances behind a load balancer. Requirements:

- Stateless API processes.
- Shared database.
- Shared Redis if used.
- Centralized logs.
- No local session storage.
- Object storage for files.

### Stage 5: Service Extraction If Justified

Only extract services when operational or team boundaries demand it. Likely candidates:

- Payments and Stripe webhooks.
- Notifications.
- Search.
- Analytics/reporting.

Extraction should happen after module boundaries are already clean in the monolith.

## 16. Security Architecture

### OWASP Considerations

Address the OWASP Top 10 from the start:

- Broken access control: enforce RBAC and vendor scoping server-side.
- Cryptographic failures: HTTPS, hashed passwords, encrypted backups, no raw payment data.
- Injection: Drizzle parameterized queries, validation, no string-built SQL.
- Insecure design: lifecycle state machines and explicit authorization policies.
- Security misconfiguration: hardened Apache, restricted CORS, secure headers.
- Vulnerable components: dependency scanning and updates.
- Authentication failures: MFA later for admins, refresh token rotation, brute-force protection.
- Software/data integrity failures: CI checks, locked dependencies, migration review.
- Logging failures: audit logs and alerting for sensitive actions.
- SSRF: restrict outbound fetches and validate URLs for any future integrations.

### Rate Limiting

Rate limit:

- Login attempts.
- Password reset.
- RFQ submission.
- Messaging.
- File uploads.
- Payment session creation.
- Public search endpoints if abused.

Use in-memory limits for earliest low-traffic deployment only. Move to Redis-backed limits when running multiple processes or servers.

### CSRF

If refresh tokens are stored in cookies, protect refresh/logout endpoints with SameSite cookies and CSRF tokens where appropriate. API access tokens in Authorization headers reduce CSRF exposure for normal API calls.

### XSS

- Escape rendered content.
- Sanitize user-generated rich text if rich formatting is allowed.
- Use a Content Security Policy.
- Never render raw message bodies as HTML.

### SQL Injection Prevention

- Use Drizzle query builders and parameterized SQL.
- Do not concatenate user-provided filters into SQL.
- Whitelist sort fields.

### Secret Management

- Store secrets only in environment variables or a secret manager.
- Rotate Stripe and JWT secrets if exposed.
- Keep `.env` files out of source control.
- Use separate secrets for development, staging, and production.

### API Hardening

- Strict CORS allowlist.
- Request body size limits.
- File type and size validation.
- Malware scanning later for uploaded documents if risk grows.
- Secure response headers.
- Disable stack traces in production responses.

### Audit Logging

Audit:

- Login failures and suspicious auth events.
- Vendor approval changes.
- Quote acceptance.
- Agreement signing.
- Payment state changes.
- Refunds.
- Admin access to sensitive records.

## 17. Observability & Monitoring

### Logging

Use structured JSON logs with:

- Request ID.
- User ID where available.
- Vendor ID where available.
- Route.
- Status code.
- Latency.
- Error code.
- Stripe event ID where relevant.

Use pino with Fastify for high-performance structured logging.

### Metrics

Track:

- API request rate.
- API latency.
- Error rate.
- Database query latency.
- RFQs submitted.
- Quotes sent.
- Quotes accepted.
- Agreements signed.
- Deposits paid.
- Webhook failures.
- Notification delivery failures.
- Worker queue depth.

### Uptime Monitoring

Expose health endpoints:

- `/healthz` for process health.
- `/readyz` for database connectivity and critical dependency checks.

Use an external uptime monitor to check production from outside the VPS.

### Tracing

Full distributed tracing is not required for MVP. Add OpenTelemetry later if multiple services, workers, or complex third-party flows make traces valuable.

### Alerting

Alert on:

- API down.
- High 5xx rate.
- Database unavailable.
- Disk usage over threshold.
- SSL certificate nearing expiration.
- Stripe webhook failures.
- Backup failures.
- Worker stuck or job backlog growing.

## 18. Recommended Development Standards

### Coding Standards

- TypeScript strict mode.
- ESLint and Prettier.
- No `any` without explicit justification.
- Domain-first module organization.
- Thin controllers.
- Services own use cases.
- Repositories own persistence.
- Explicit DTO validation.
- Centralized error classes.

### Testing Strategy

Use focused tests where mistakes are expensive.

Unit tests:

- RFQ lifecycle transitions.
- Quote calculations.
- Agreement generation rules.
- Scheduling conflict detection.
- Authorization policies.

Integration tests:

- API route behavior.
- Database repositories.
- Transactions.
- Stripe webhook processing with mocked Stripe events.
- Payment state transitions.

End-to-end tests:

- Customer submits RFQ.
- Vendor sends quote.
- Customer accepts quote.
- Agreement is generated and signed.
- Deposit payment webhook confirms booking.

### API Testing

Maintain API contract tests for:

- Auth.
- RFQs.
- Quotes.
- Agreements.
- Payments.
- Calendar.

Use seeded test data with isolated test databases or transactional cleanup.

### Migration Standards

- Every schema change has a migration.
- Migrations run in CI against a clean database.
- Production migrations are backed up first.
- Large backfills should be separate from schema changes.

### Branching Strategy

For a small team:

- `main` is deployable.
- Feature branches for work.
- Pull requests for review when possible.
- CI required before merge.
- Tag production releases.

### Documentation Standards

Keep these docs current:

- PRD.
- Architecture Design Document.
- API conventions.
- Database schema notes.
- Deployment runbook.
- Incident and backup restore runbook.

## 19. Suggested MVP Architecture vs Future Enterprise Evolution

### MVP Architecture

Build:

- One Next.js web app.
- One Fastify API.
- One PostgreSQL database.
- One background worker.
- Transactional outbox table.
- Stripe Connect integration.
- Object storage for durable files.
- Apache2 reverse proxy.
- PM2 process management.

Do not build:

- Kubernetes.
- Multiple backend microservices.
- Kafka.
- Elasticsearch.
- Complex data warehouse.
- AI matching infrastructure.

### Future Enterprise Evolution

When revenue, traffic, or team size justifies it:

- Move PostgreSQL to managed database infrastructure.
- Add Redis and BullMQ for jobs.
- Add CDN for marketplace images.
- Add OpenTelemetry tracing.
- Add read replicas for analytics-heavy workloads.
- Add search service if PostgreSQL search is insufficient.
- Extract payments, notifications, or analytics into separate services only after the monolith boundaries are proven.
- Add fine-grained admin permissions and vendor team management.
- Add data warehouse or analytics pipeline for GMV, funnel, and geographic demand reporting.

## 20. Risks & Technical Tradeoffs

### Modular Monolith Risk

Risk: A monolith can become tangled if boundaries are not enforced.

Mitigation: Organize by domain, expose public service interfaces, keep repositories private to modules, and test business rules.

### VPS Operational Risk

Risk: Running app and database on one VPS creates a single point of failure.

Mitigation: Backups, monitoring, PM2 restarts, firewall hardening, and a planned move to managed PostgreSQL when traction begins.

### Stripe Complexity

Risk: Payment state is asynchronous and webhook-driven.

Mitigation: Store Stripe event IDs, use idempotent handlers, model payment state machines, and reconcile regularly.

### Scheduling Complexity

Risk: Calendar conflict detection can become complicated with travel buffers, staff, recurring events, and time zones.

Mitigation: Start with clear confirmed-event overlap detection, store all timestamps in UTC, store vendor timezone, and expand rules gradually.

### Search Complexity

Risk: Marketplace filtering can become slow as vendor count and search features grow.

Mitigation: Use PostgreSQL indexes and full-text search first. Add dedicated search infrastructure only after measuring need.

### Document Storage Risk

Risk: Signed agreements stored only on VPS disk may be lost during server failure.

Mitigation: Use object storage early for agreements and uploaded media.

### Small Team Maintainability

Risk: Production-grade patterns can slow development if over-applied.

Mitigation: Be disciplined but pragmatic. Use service/repository boundaries for core domains, but avoid ceremony in low-risk internal utilities.

## Final Recommendation

foodtruckzs should begin as a clean, domain-modular SaaS monolith with PostgreSQL, Fastify, Drizzle, Stripe Connect, object storage, and a transactional outbox. This provides the right balance of production readiness and operational simplicity for a small team. The architecture supports real commercial workflows immediately while leaving a credible path toward horizontal scaling, background workers, Redis, managed infrastructure, and selective service extraction as the business grows.
