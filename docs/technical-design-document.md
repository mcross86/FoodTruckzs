# foodtruckzs Technical Design Document

Document ID: TDD-001

Status: Proposed

Sources:

- `docs/product-requirements-document.md`
- `docs/architecture-design-document.md`

## 1. Technical Overview

This Technical Design Document defines how foodtruckzs should be implemented at the engineering level. The Architecture Design Document establishes the platform direction: a domain-modular monolith with Next.js, TypeScript, Fastify, PostgreSQL, Drizzle ORM, JWT authentication, Stripe Connect, Apache2, Ubuntu, and PM2. This TDD turns that architecture into implementation guidance for routes, services, repositories, database operations, transactions, async jobs, state machines, validation, error handling, and production operations.

The backend should be implemented as one deployable API with strong internal domain boundaries. The domain modules are:

- Authentication and authorization.
- Marketplace and vendor discovery.
- RFQ engine.
- Vendor quote management.
- Messaging.
- Agreement generation.
- Catering calendar and scheduling.
- Vendor availability.
- Payments and Stripe Connect.
- Platform billing and caterer invoicing.
- Notifications.
- Admin operations.

The implementation principle is simple: HTTP routes should translate transport concerns, services should orchestrate use cases, repositories should handle persistence, and the database should enforce core integrity constraints. Business behavior should be tested at the service level and protected at the database level where possible.

The first production version should not use microservices, Kubernetes, Kafka, or a separate search cluster. Those tools add operational complexity before the product has enough load or team capacity to justify them. Instead, the system should be built as a clean modular monolith that can later add Redis, queues, separate workers, managed PostgreSQL, CDN-backed storage, and selective service extraction.

## 2. System Execution Flow

### Standard Request Flow

The standard synchronous request path is:

```text
Next.js client
  -> Apache2 reverse proxy
  -> Fastify route
  -> request middleware
  -> controller
  -> DTO validation
  -> authorization policy
  -> application service
  -> domain service
  -> repository
  -> Drizzle
  -> PostgreSQL
  -> response mapper
  -> JSON response
```

Each layer has a narrow responsibility:

- Frontend collects input and renders server-owned state.
- Routes register URL paths, middleware, schemas, and controller handlers.
- Controllers map HTTP request shape into service commands.
- DTO validators reject invalid transport input before it reaches business logic.
- Authorization policies decide whether the authenticated actor can perform the action.
- Application services coordinate the use case and transaction boundaries.
- Domain services implement reusable rules, such as RFQ transition checks or conflict detection.
- Repositories execute database operations.
- Response mappers expose stable API DTOs instead of raw database rows.

### Middleware Flow

Fastify should register middleware and hooks in this order:

```text
request id
  -> security headers
  -> CORS
  -> body limits
  -> request logging
  -> rate limiting
  -> authentication
  -> active vendor context
  -> route validation
  -> controller
  -> centralized error handler
```

Authentication should be skipped only for explicitly public routes, such as public marketplace search, vendor profile pages, health checks, registration, login, and Stripe webhook signature validation. Vendor-scoped routes must require both an authenticated user and a verified vendor membership.

### Transaction Boundaries

Transactions belong in services, not controllers or repositories. A service starts a transaction when one business operation must change multiple records atomically.

Use transactions for:

- Creating an RFQ with vendor targets, requirement rows, status history, message threads, audit log, and outbox event.
- Accepting or rejecting an RFQ target.
- Creating a quote revision and updating quote/RFQ status.
- Accepting a quote and generating an agreement draft.
- Signing an agreement and writing signature history.
- Handling Stripe webhook events that update payments, agreements, RFQs, calendar events, and notifications.
- Calculating foodtruckzs signed-agreement fees and creating caterer invoice records.
- Creating manual calendar events with conflict checks.
- Admin approval or suspension actions.

Do not keep a database transaction open while making external network calls to Stripe, email providers, SMS providers, or object storage. Persist the intent first, call the external service, then persist the external service result. Final payment truth should come from Stripe webhooks.

### Async Event Flow

The platform should use a transactional outbox table before adopting Redis or a queue service.

```text
Business service transaction
  -> writes domain records
  -> writes outbox_events row
  -> commits

Worker process
  -> polls outbox_events where status = pending and available_at <= now()
  -> claims batch with row locks
  -> dispatches handler
  -> creates notifications/jobs/delivery attempts
  -> marks event processed or retryable
```

This design prevents the common failure where the database transaction succeeds but the notification or webhook side effect is lost.

### Request Context

Every request should carry a typed context:

```ts
type RequestContext = {
  requestId: string;
  userId?: string;
  sessionId?: string;
  globalRoles: GlobalRole[];
  activeVendorId?: string;
  vendorMemberships: VendorMembershipContext[];
  ipAddress?: string;
  userAgent?: string;
};
```

Services should receive `RequestContext` or a smaller actor object, never the raw Fastify request.

## 3. Backend Folder Structure

The backend should use domain-first organization with shared infrastructure isolated under `shared`.

```text
apps/
  api/
    src/
      app.ts
      server.ts
      config/
        env.ts
        logger.ts
        cors.ts
        rate-limit.ts
      db/
        client.ts
        migrate.ts
        transaction.ts
        schema/
          auth.schema.ts
          vendors.schema.ts
          marketplace.schema.ts
          rfqs.schema.ts
          quotes.schema.ts
          messages.schema.ts
          agreements.schema.ts
          scheduling.schema.ts
          payments.schema.ts
          notifications.schema.ts
          admin.schema.ts
          audit.schema.ts
          files.schema.ts
          outbox.schema.ts
        migrations/
      modules/
        auth/
          auth.routes.ts
          auth.controller.ts
          auth.service.ts
          auth.repository.ts
          auth.dto.ts
          auth.policy.ts
          auth.errors.ts
          auth.mapper.ts
          auth.types.ts
          auth.test.ts
        vendors/
        marketplace/
        rfqs/
        quotes/
        messages/
        agreements/
        scheduling/
        availability/
        payments/
        billing/
        notifications/
        admin/
      shared/
        errors/
          app-error.ts
          error-codes.ts
          error-handler.ts
        middleware/
          authenticate.ts
          require-role.ts
          require-vendor.ts
          request-context.ts
          validate.ts
        policies/
          policy-result.ts
        events/
          outbox.repository.ts
          event-bus.ts
          event-types.ts
        jobs/
          job-runner.ts
          retry.ts
          dead-letter.repository.ts
        storage/
          storage.service.ts
          local-storage.adapter.ts
          s3-compatible.adapter.ts
        stripe/
          stripe.client.ts
          stripe-webhook.ts
          stripe-idempotency.ts
        validation/
          zod.ts
          pagination.dto.ts
          id.dto.ts
        observability/
          metrics.ts
          audit-log.service.ts
        utils/
          money.ts
          time.ts
          slug.ts
      workers/
        worker.ts
        handlers/
          notification.handler.ts
          email.handler.ts
          agreement-pdf.handler.ts
          payment-reconciliation.handler.ts
      tests/
        factories/
        integration/
        contract/
        unit/
  web/
    app/
    components/
    features/
    lib/
    styles/
packages/
  shared/
    src/
      dto/
      constants/
      validators/
docs/
```

This structure keeps business modules close to their routes, DTOs, services, repositories, policies, and tests. It avoids the common anti-pattern of large top-level `controllers`, `services`, and `repositories` folders where domain behavior becomes scattered. Shared code is limited to infrastructure and cross-cutting primitives.

Each module should expose a small public interface from `index.ts` only when another module needs to call it. Other modules should not import private repositories directly.

## 4. Domain Module Design

### Authentication and Authorization

Responsibilities:

- Register and authenticate users.
- Issue short-lived access tokens.
- Rotate refresh tokens.
- Store sessions.
- Enforce global roles and vendor memberships.
- Invalidate sessions on logout, password reset, suspicious activity, and admin action.

Services:

- `AuthService`
- `SessionService`
- `PasswordService`
- `TokenService`
- `AuthorizationService`

Repositories:

- `UserRepository`
- `SessionRepository`
- `VendorMembershipRepository`

Entities:

- `users`
- `user_sessions`
- `refresh_tokens`
- `vendor_memberships`
- `password_reset_tokens`
- `email_verification_tokens`

Business rules:

- Email addresses are unique case-insensitively.
- Passwords are never stored raw.
- Refresh tokens are stored hashed.
- Refresh token reuse after rotation revokes the token family.
- Suspended users cannot create sessions.
- Vendor membership must be active before accessing vendor-scoped data.

Async operations:

- Email verification.
- Password reset email.
- Suspicious login notification.

### RFQ Engine

Responsibilities:

- Create customer RFQs.
- Target specific vendors or a group of matched vendors.
- Manage RFQ status lifecycle.
- Store event, food, equipment, budget, and timing requirements.
- Create vendor targets and initial message threads.
- Emit events for vendor notifications.

Services:

- `RfqService`
- `RfqStateMachine`
- `RfqMatchingService`
- `RfqRequirementService`

Repositories:

- `RfqRepository`
- `RfqVendorTargetRepository`
- `RfqStatusHistoryRepository`
- `RfqRequirementRepository`

Entities:

- `rfqs`
- `rfq_vendor_targets`
- `rfq_food_requirements`
- `rfq_equipment_requests`
- `rfq_status_history`
- `addresses`

Business rules:

- Event date must satisfy the minimum booking lead time.
- Start time must be before end time.
- Estimated headcount must be positive.
- Budget minimum cannot exceed budget maximum.
- Submitted RFQs must target at least one eligible vendor.
- Cancelled or completed RFQs cannot be modified.

Transactions:

- RFQ creation writes RFQ, requirements, vendor targets, status history, message threads, audit log, and outbox events in one transaction.
- RFQ cancellation writes status history, cancels open targets, emits notifications, and audits the action in one transaction.

Async operations:

- Notify targeted vendors.
- Notify customer when vendor responds.
- Future matching expansion.

### Vendor Quote Management

Responsibilities:

- Allow vendors to accept, reject, clarify, and quote RFQs.
- Build line-item quotes.
- Create immutable quote revisions.
- Track negotiation state.
- Support customer quote approval.

Services:

- `QuoteService`
- `QuoteCalculationService`
- `QuoteRevisionService`
- `QuoteApprovalService`

Repositories:

- `QuoteRepository`
- `QuoteRevisionRepository`
- `QuoteLineItemRepository`
- `QuoteStatusHistoryRepository`

Entities:

- `quotes`
- `quote_revisions`
- `quote_line_items`
- `quote_status_history`
- `payment_schedule_items`

Business rules:

- Only targeted vendors can quote an RFQ.
- Vendor must have an active membership with quote permissions.
- A quote revision must contain at least one line item.
- Totals are calculated server-side, not trusted from the client.
- Customer can accept only the current sent revision.
- Accepting a quote locks competing quote approvals for the same RFQ unless multi-vendor booking is explicitly introduced later.

Transactions:

- Creating a quote revision inserts revision rows, line items, updates current revision pointer, updates statuses, writes audit history, and emits `quote.sent`.
- Accepting a quote locks the RFQ and quote rows, validates current revision, updates statuses, creates agreement draft, creates payment schedule, and emits `quote.accepted`.

### Messaging System

Responsibilities:

- Provide threaded customer-vendor communication tied to RFQs.
- Persist messages and attachments.
- Track read receipts.
- Trigger notifications.

Services:

- `MessageService`
- `MessageThreadService`
- `ReadReceiptService`

Repositories:

- `MessageThreadRepository`
- `MessageRepository`
- `MessageReadRepository`

Entities:

- `message_threads`
- `messages`
- `message_reads`
- `files`

Business rules:

- Only the RFQ customer, targeted vendor members, and admins can access a thread.
- Messages cannot be edited after a short correction window unless a full edit history is added.
- Soft-delete hides messages from users but preserves audit records.
- Attachments must pass file validation and authorization.

Transactions:

- Sending a message inserts message, updates thread last-message metadata, writes read state for sender, emits notification event.

### Catering Calendar

Responsibilities:

- Display vendor calendar events.
- Create manual events.
- Create confirmed catering events from agreements and deposits.
- Detect booking conflicts.
- Support agenda, day, week, month, and timeline views.

Services:

- `CalendarService`
- `CateringEventService`
- `ConflictDetectionService`
- `TravelBufferService`

Repositories:

- `CalendarEventRepository`
- `CateringEventRepository`
- `ConflictRepository`

Entities:

- `calendar_events`
- `catering_events`
- `calendar_conflicts`
- `addresses`

Business rules:

- Events must have valid start/end times.
- Vendor members can create manual events only for their vendor.
- Confirmed catering events are generated by payment/agreement flows, not arbitrary frontend calls.
- Conflict detection should include overlapping confirmed events and blocked time for MVP.
- Travel buffer warnings are advisory for MVP unless the vendor configures hard enforcement.

Transactions:

- Confirming a catering event locks vendor calendar rows for the time window, checks conflicts, inserts `catering_events`, inserts `calendar_events`, records warnings, and emits notifications.

### Agreement Generation

Responsibilities:

- Generate agreement drafts from accepted quote revisions.
- Store agreement versions.
- Support digital signature acceptance.
- Preserve signed document history.

Services:

- `AgreementService`
- `AgreementTemplateService`
- `AgreementPdfService`
- `SignatureService`

Repositories:

- `AgreementRepository`
- `AgreementVersionRepository`
- `AgreementSignatureRepository`

Entities:

- `agreements`
- `agreement_versions`
- `agreement_signatures`
- `files`

Business rules:

- Agreement must reference one accepted quote revision.
- Agreement terms are snapshotted and not rebuilt from mutable quote rows after generation.
- Customer signature requires authenticated customer ownership.
- Vendor signature can be required later; MVP may use vendor approval implied by quote submission.
- Signed agreements are immutable. Corrections require a new version.

Transactions:

- Signing agreement locks agreement, verifies status, inserts signature, updates status, stores signed file reference when available, updates RFQ status, and emits `agreement.signed`.

Async operations:

- Generate PDF.
- Upload signed document.
- Send agreement-ready and signed notifications.

### Payment Processing

Responsibilities:

- Onboard vendors to Stripe Connect.
- Create deposit checkout sessions.
- Support future full-event invoice payments with payment terms.
- Support future onsite payment collection for event balances.
- Process Stripe webhooks.
- Track payment schedule items, attempts, refunds, and payouts.
- Reconcile payment state.

Services:

- `StripeConnectService`
- `PaymentService`
- `PaymentScheduleService`
- `StripeWebhookService`
- `RefundService`
- `PayoutService`
- `PaymentReconciliationService`

Repositories:

- `PaymentRepository`
- `PaymentAttemptRepository`
- `PaymentScheduleRepository`
- `RefundRepository`
- `PayoutRepository`
- `StripeWebhookEventRepository`

Entities:

- `vendor_stripe_accounts`
- `payment_schedule_items`
- `payments`
- `payment_attempts`
- `refunds`
- `payouts`
- `stripe_webhook_events`

Business rules:

- A vendor must have an active Stripe Connect account before collecting payment.
- Deposit amount comes from the accepted quote revision, not the client request.
- Customer payment amounts come from signed agreement payment schedule items, not client request values.
- Customer must own the agreement being paid.
- Payment session creation must be idempotent.
- Webhook event IDs must be unique.
- Internal state changes must be replay-safe.
- Customer-to-vendor payments are separate from foodtruckzs platform agreement fee invoices.

Transactions:

- Webhook processing inserts or claims webhook event, locks payment attempt, updates payment state, updates agreement/RFQ if needed, creates calendar event after deposit success, emits notifications, and marks webhook processed.

External calls:

- Stripe API calls occur outside database transactions when initiated by platform actions.
- Stripe webhooks are verified before any persistence.

### Platform Billing and Caterer Invoicing

Responsibilities:

- Store platform fee settings per food truck caterer/vendor account.
- Calculate the foodtruckzs fee when a catering agreement is signed.
- Create agreement fee records with no amount cap.
- Group agreement fees into invoices sent to catering companies.
- Track invoice status, adjustments, payment status, and audit history.
- Keep platform billing independent from customer down payments and vendor payout status.

Services:

- `PlatformBillingService`
- `AgreementFeeService`
- `VendorInvoiceService`
- `BillingSettingsService`

Repositories:

- `VendorBillingSettingsRepository`
- `PlatformAgreementFeeRepository`
- `VendorInvoiceRepository`
- `VendorInvoiceLineItemRepository`

Entities:

- `vendor_billing_settings`
- `platform_agreement_fees`
- `vendor_invoices`
- `vendor_invoice_line_items`

Business rules:

- Fee percentage is configurable per vendor account.
- Fee percentage is stored as basis points.
- Fee amount is calculated from the signed agreement total.
- Fee becomes billable when the agreement is signed.
- Fee has no cap.
- Issued invoice line items are immutable; corrections require adjustment line items.
- Platform billing records must not change customer deposit amounts.

Transactions:

- Agreement signing creates signature records, updates agreement/RFQ status, calculates platform agreement fee, inserts billing record, writes audit log, and emits billing/notification events in one transaction.

### Notification Infrastructure

Responsibilities:

- Accept domain events.
- Create in-app notifications.
- Send email notifications.
- Support SMS later.
- Apply user preferences.
- Retry transient failures.

Services:

- `NotificationService`
- `NotificationPreferenceService`
- `NotificationRenderer`
- `EmailDeliveryService`
- `SmsDeliveryService`

Repositories:

- `OutboxRepository`
- `NotificationRepository`
- `NotificationDeliveryRepository`
- `NotificationPreferenceRepository`
- `DeadLetterRepository`

Entities:

- `outbox_events`
- `notifications`
- `notification_preferences`
- `notification_deliveries`
- `dead_letter_jobs`

Business rules:

- Transactional notifications such as payment confirmation cannot be fully disabled.
- Marketing notifications must respect opt-out.
- Failed delivery should not roll back the originating business transaction.

### Vendor Availability Management

Responsibilities:

- Define recurring operating windows.
- Define blackout dates.
- Define travel radius and booking minimums.
- Feed marketplace availability and scheduling conflict checks.

Services:

- `AvailabilityService`
- `AvailabilityRuleService`
- `AvailabilityExceptionService`
- `TravelRadiusService`

Repositories:

- `AvailabilityRuleRepository`
- `AvailabilityExceptionRepository`
- `VendorServiceAreaRepository`

Entities:

- `availability_rules`
- `availability_exceptions`
- `vendor_service_areas`
- `vendor_operating_settings`

Business rules:

- Availability uses vendor-local timezone.
- Recurring rules cannot overlap for the same vendor and day unless explicitly allowed.
- Blackout dates override recurring availability.
- Booking lead time must be enforced during RFQ submission and quote acceptance.

### Admin Operations

Responsibilities:

- Approve and suspend vendors.
- Moderate marketplace profiles.
- Manage disputes.
- Monitor payouts and refunds.
- View operational analytics.
- Audit sensitive actions.

Services:

- `AdminVendorService`
- `AdminDisputeService`
- `AdminPayoutService`
- `AdminAnalyticsService`
- `ModerationService`

Repositories:

- `AdminRepository`
- `AuditLogRepository`
- Domain repositories through service interfaces only.

Business rules:

- Admin actions require platform roles.
- Sensitive admin reads and writes are audited.
- Admins should not bypass payment state machines.
- Vendor suspension hides marketplace profile and blocks new RFQ responses but should not destroy existing financial records.

## 5. API Endpoint Specifications

All endpoints are versioned under `/api/v1`. All protected routes require a valid access token. Vendor routes require an active vendor membership. Admin routes require platform admin or support admin roles.

### Response Envelope

Success responses should use stable DTOs:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

Paginated responses:

```json
{
  "data": [],
  "page": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTI1In0",
    "limit": 25,
    "hasMore": true
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

Error responses:

```json
{
  "error": {
    "code": "RFQ_INVALID_STATUS_TRANSITION",
    "message": "RFQ cannot move from Cancelled to Quote Sent.",
    "requestId": "req_123",
    "details": {
      "from": "cancelled",
      "to": "quote_sent"
    }
  }
}
```

### Authentication Endpoints

`POST /api/v1/auth/register`

- Auth: public.
- Request DTO: email, password, firstName, lastName, phone optional.
- Validation: valid email, password length and complexity, normalized email uniqueness.
- Response DTO: user summary and access token; refresh token set as secure cookie.
- Status codes: `201`, `400`, `409`, `429`.
- Idempotency: not required, but duplicate email returns `409`.

`POST /api/v1/auth/login`

- Auth: public.
- Request DTO: email, password.
- Validation: valid email format; body size limit.
- Response DTO: user summary, access token, available vendor memberships.
- Status codes: `200`, `400`, `401`, `403`, `429`.
- Security: generic invalid credentials message; rate limited by IP and email.

`POST /api/v1/auth/refresh`

- Auth: refresh token cookie.
- Request DTO: none or CSRF token depending cookie strategy.
- Response DTO: new access token.
- Status codes: `200`, `401`, `403`.
- Idempotency: refresh token rotation makes each token single-use.

`POST /api/v1/auth/logout`

- Auth: authenticated session.
- Request DTO: none.
- Response DTO: success.
- Status codes: `204`, `401`.
- Behavior: revokes current refresh token and clears cookie.

`GET /api/v1/auth/me`

- Auth: user.
- Response DTO: user profile, global roles, vendor memberships, active vendor context.
- Status codes: `200`, `401`.

### Marketplace Endpoints

`GET /api/v1/marketplace/vendors`

- Auth: public.
- Query DTO: cuisine, metro, state, serviceStyle, minGuests, budgetMin, budgetMax, dietary tags, cursor, limit, sort.
- Validation: whitelist sort values; limit max `50`; numeric filters positive.
- Response DTO: vendor cards with profile summary, cuisines, service areas, image URL, pricing summary.
- Status codes: `200`, `400`, `429`.
- Pagination: cursor by rank and vendor ID.

`GET /api/v1/marketplace/vendors/:vendorSlug`

- Auth: public.
- Response DTO: public vendor profile, sample menus, cuisines, service areas, images, catering minimums.
- Status codes: `200`, `404`.
- Behavior: unpublished or suspended vendors return `404`.

`GET /api/v1/marketplace/cuisines`

- Auth: public.
- Response DTO: active cuisine categories.
- Status codes: `200`.
- Cache: safe to cache for several minutes.

### Vendor Operations Endpoints

`GET /api/v1/vendors/:vendorId/dashboard`

- Auth: vendor member.
- Response DTO: active RFQ count, pending quote count, upcoming events, deposits due, unread messages, conflict count.
- Status codes: `200`, `401`, `403`, `404`.
- Query design: purpose-built aggregated query; do not make frontend call many endpoints.

`PATCH /api/v1/vendors/:vendorId/profile`

- Auth: vendor owner or manager.
- Request DTO: headline, publicDescription, serviceStyles, dietaryAccommodations, cateringMinimumCents, operationalHours.
- Validation: published profiles require required marketplace fields.
- Response DTO: updated profile.
- Status codes: `200`, `400`, `403`, `404`, `409`.

`POST /api/v1/vendors/:vendorId/menus`

- Auth: vendor owner or manager.
- Request DTO: name, description, package definitions, menu items, dietary tags.
- Validation: at least one item or package; prices non-negative.
- Response DTO: created menu.
- Status codes: `201`, `400`, `403`.

### RFQ Endpoints

`POST /api/v1/rfqs`

- Auth: customer.
- Request DTO: event information, food requirements, equipment requests, budget, quote response deadline, target vendor IDs optional.
- Validation: required event fields, minimum 7-day lead time, valid budget range, at least one target or matching criteria.
- Response DTO: RFQ detail with vendor targets.
- Status codes: `201`, `400`, `401`, `403`, `409`, `422`.
- Idempotency: recommended with `Idempotency-Key` because users may double-submit.

`GET /api/v1/rfqs/:rfqId`

- Auth: customer owner, targeted vendor member, or admin.
- Response DTO: RFQ detail, requirements, current status, targets visible to actor.
- Status codes: `200`, `401`, `403`, `404`.

`GET /api/v1/customers/me/rfqs`

- Auth: customer.
- Query DTO: status, cursor, limit.
- Response DTO: paginated customer RFQs.
- Status codes: `200`, `400`, `401`.

`GET /api/v1/vendors/:vendorId/rfqs`

- Auth: vendor member.
- Query DTO: targetStatus, eventDateFrom, eventDateTo, cursor, limit.
- Response DTO: RFQ inbox items.
- Status codes: `200`, `400`, `403`.

`POST /api/v1/rfqs/:rfqId/vendor-targets/:targetId/accept`

- Auth: vendor member.
- Request DTO: optional note.
- Validation: target belongs to active vendor; target status allows accepting.
- Response DTO: updated target and RFQ summary.
- Status codes: `200`, `403`, `404`, `409`, `422`.
- Idempotency: safe to retry if already accepted by same actor.

`POST /api/v1/rfqs/:rfqId/vendor-targets/:targetId/reject`

- Auth: vendor member.
- Request DTO: reason code and optional note.
- Validation: reason code from enum.
- Response DTO: updated target.
- Status codes: `200`, `400`, `403`, `404`, `409`.

`POST /api/v1/rfqs/:rfqId/request-clarification`

- Auth: targeted vendor member.
- Request DTO: message body.
- Validation: non-empty body, RFQ open, actor can access thread.
- Response DTO: message and updated RFQ status.
- Status codes: `201`, `400`, `403`, `404`, `409`.

`POST /api/v1/rfqs/:rfqId/cancel`

- Auth: customer owner or admin.
- Request DTO: reason.
- Validation: RFQ not completed; cancellation rules satisfied.
- Response DTO: cancelled RFQ.
- Status codes: `200`, `400`, `403`, `404`, `409`.
- Idempotency: required.

### Quote Endpoints

`POST /api/v1/rfqs/:rfqId/quotes`

- Auth: vendor owner or manager.
- Request DTO: line items, service fees, staffing fees, travel fees, gratuity, rental charges, overtime pricing, deposit requirement, payment schedule, notes, expiration.
- Validation: RFQ target accepted or reviewable; totals calculated server-side; payment schedule sums correctly.
- Response DTO: quote with current revision.
- Status codes: `201`, `400`, `403`, `404`, `409`, `422`.
- Idempotency: required for create/send action.

`POST /api/v1/quotes/:quoteId/revisions`

- Auth: quote vendor owner or manager.
- Request DTO: revised line items, fees, payment schedule, notes.
- Validation: quote not accepted/cancelled; revision changes at least one material term.
- Response DTO: quote with new current revision.
- Status codes: `201`, `400`, `403`, `404`, `409`.

`POST /api/v1/quotes/:quoteId/accept`

- Auth: RFQ customer.
- Request DTO: acceptedRevisionId.
- Validation: revision is current sent revision; RFQ is open; quote not expired.
- Response DTO: accepted quote and generated agreement draft.
- Status codes: `200`, `400`, `403`, `404`, `409`, `422`.
- Idempotency: required.

`POST /api/v1/quotes/:quoteId/decline`

- Auth: RFQ customer.
- Request DTO: reason optional.
- Response DTO: updated quote.
- Status codes: `200`, `403`, `404`, `409`.

### Messaging Endpoints

`GET /api/v1/message-threads/:threadId/messages`

- Auth: thread participant or admin.
- Query DTO: cursor, limit.
- Response DTO: paginated messages.
- Status codes: `200`, `400`, `403`, `404`.

`POST /api/v1/message-threads/:threadId/messages`

- Auth: thread participant.
- Request DTO: body, attachmentFileId optional.
- Validation: body non-empty unless attachment present; attachment visible to actor.
- Response DTO: created message.
- Status codes: `201`, `400`, `403`, `404`, `422`.
- Async: emits message notification.

`POST /api/v1/message-threads/:threadId/read`

- Auth: thread participant.
- Request DTO: lastReadMessageId.
- Response DTO: read receipt state.
- Status codes: `200`, `400`, `403`, `404`.

### Agreement Endpoints

`GET /api/v1/agreements/:agreementId`

- Auth: agreement customer, vendor member, or admin.
- Response DTO: agreement metadata, current version, signature status, payment schedule.
- Status codes: `200`, `403`, `404`.

`POST /api/v1/agreements/:agreementId/generate`

- Auth: vendor owner, manager, or system service after quote acceptance.
- Request DTO: optional template overrides.
- Validation: quote accepted; no active signed agreement already exists.
- Response DTO: generated agreement.
- Status codes: `201`, `403`, `404`, `409`.
- Async: PDF generation can be queued if slow.

`POST /api/v1/agreements/:agreementId/sign`

- Auth: customer owner.
- Request DTO: acceptedTermsVersion, typedName, signatureMetadata.
- Validation: agreement pending signature; version matches current version.
- Response DTO: signed agreement and next payment action.
- Status codes: `200`, `400`, `403`, `404`, `409`.
- Idempotency: required.

`GET /api/v1/agreements/:agreementId/download-url`

- Auth: agreement participant or admin.
- Response DTO: signed temporary URL.
- Status codes: `200`, `403`, `404`.

### Calendar and Availability Endpoints

`GET /api/v1/vendors/:vendorId/calendar-events`

- Auth: vendor member.
- Query DTO: startsFrom, startsTo, view, types.
- Validation: date range max 180 days for MVP.
- Response DTO: calendar events plus conflict warnings.
- Status codes: `200`, `400`, `403`.

`POST /api/v1/vendors/:vendorId/calendar-events`

- Auth: vendor owner, manager, or staff.
- Request DTO: type, title, startsAt, endsAt, location, notes.
- Validation: manual type only; valid time range; conflict policy.
- Response DTO: created calendar event and conflict warnings.
- Status codes: `201`, `400`, `403`, `409`, `422`.

`PATCH /api/v1/vendors/:vendorId/calendar-events/:eventId`

- Auth: vendor owner, manager, or staff.
- Request DTO: mutable manual event fields.
- Validation: cannot directly mutate system-generated confirmed catering event.
- Response DTO: updated event.
- Status codes: `200`, `400`, `403`, `404`, `409`.

`GET /api/v1/vendors/:vendorId/availability`

- Auth: vendor member.
- Response DTO: recurring rules, exceptions, operating settings.
- Status codes: `200`, `403`.

`PUT /api/v1/vendors/:vendorId/availability`

- Auth: vendor owner or manager.
- Request DTO: recurring rules, exceptions, timezone, booking lead time, travel radius.
- Validation: timezone valid; rules non-overlapping; lead time at least platform minimum.
- Response DTO: updated availability.
- Status codes: `200`, `400`, `403`, `409`.

### Payment Endpoints

`POST /api/v1/vendors/:vendorId/stripe-connect/onboarding-link`

- Auth: vendor owner.
- Request DTO: returnUrl, refreshUrl.
- Validation: valid URLs matching allowed app domains.
- Response DTO: Stripe onboarding URL.
- Status codes: `201`, `400`, `403`, `409`.

`POST /api/v1/payments/deposits/checkout-session`

- Auth: agreement customer.
- Request DTO: agreementId, paymentScheduleItemId.
- Validation: agreement signed; schedule item is a required down payment/deposit; vendor connected; amount from server.
- Response DTO: checkout URL and payment ID.
- Status codes: `201`, `400`, `403`, `404`, `409`, `422`.
- Idempotency: required.

`POST /api/v1/payments/invoices/checkout-session`

- Auth: agreement customer.
- Request DTO: agreementId, paymentScheduleItemId.
- Validation: agreement signed; schedule item due under invoice/payment terms; vendor connected; amount from server.
- Response DTO: checkout URL and payment ID.
- Status codes: `201`, `400`, `403`, `404`, `409`, `422`.
- Idempotency: required.
- Phase: future full-event or balance payment support.

`POST /api/v1/payments/onsite`

- Auth: vendor owner or manager.
- Request DTO: agreementId, paymentScheduleItemId, amountCents, paymentMethodMode.
- Validation: agreement belongs to vendor; schedule item due; amount matches server-calculated balance unless admin override.
- Response DTO: payment intent/client secret or payment record.
- Status codes: `201`, `400`, `403`, `404`, `409`, `422`.
- Phase: future onsite payment collection.

`GET /api/v1/payments/:paymentId`

- Auth: customer owner, vendor member, or admin.
- Response DTO: payment status, amount, schedule item, attempt summary.
- Status codes: `200`, `403`, `404`.

`POST /api/v1/payments/:paymentId/refund`

- Auth: admin initially; vendor-initiated refunds can come later with approval rules.
- Request DTO: amountCents, reason.
- Validation: payment succeeded; amount not greater than refundable balance.
- Response DTO: refund record.
- Status codes: `202`, `400`, `403`, `404`, `409`.
- Idempotency: required.

`POST /api/v1/webhooks/stripe`

- Auth: Stripe signature verification, not JWT.
- Request DTO: raw Stripe payload.
- Validation: signature required.
- Response DTO: `{ "received": true }`.
- Status codes: `200`, `400`, `500`.
- Idempotency: Stripe event ID unique.

### Platform Billing Endpoints

`GET /api/v1/vendors/:vendorId/platform-billing`

- Auth: vendor owner or manager.
- Response DTO: fee percentage, pending agreement fees, issued invoices, invoice payment status.
- Status codes: `200`, `403`, `404`.

`GET /api/v1/admin/vendors/:vendorId/billing-settings`

- Auth: platform admin.
- Response DTO: vendor billing settings including agreement fee basis points.
- Status codes: `200`, `403`, `404`.

`PATCH /api/v1/admin/vendors/:vendorId/billing-settings`

- Auth: platform admin.
- Request DTO: agreementFeeBasisPoints, billingEmail, invoiceTermsDays.
- Validation: fee basis points must be non-negative; no amount cap is stored; billing email valid.
- Response DTO: updated billing settings.
- Status codes: `200`, `400`, `403`, `404`.
- Audit: required.

`POST /api/v1/admin/vendor-invoices`

- Auth: platform admin.
- Request DTO: vendorId, billingPeriodStart, billingPeriodEnd.
- Validation: invoice includes uninvoiced signed-agreement fee records for the vendor and period.
- Response DTO: generated vendor invoice.
- Status codes: `201`, `400`, `403`, `404`, `409`.
- Idempotency: required by vendor and billing period.

### Notification Endpoints

`GET /api/v1/notifications`

- Auth: user.
- Query DTO: unreadOnly, cursor, limit.
- Response DTO: paginated notifications.
- Status codes: `200`, `400`, `401`.

`POST /api/v1/notifications/:notificationId/read`

- Auth: notification owner.
- Response DTO: updated notification.
- Status codes: `200`, `403`, `404`.

`PUT /api/v1/notification-preferences`

- Auth: user.
- Request DTO: preference map by type and channel.
- Validation: transactional required notifications cannot be fully disabled.
- Response DTO: updated preferences.
- Status codes: `200`, `400`, `401`.

### Admin Endpoints

`GET /api/v1/admin/vendors`

- Auth: platform admin or support admin.
- Query DTO: approvalStatus, search, cursor, limit.
- Response DTO: vendor admin list.
- Status codes: `200`, `400`, `403`.

`POST /api/v1/admin/vendors/:vendorId/approve`

- Auth: platform admin.
- Request DTO: note optional.
- Response DTO: approved vendor.
- Status codes: `200`, `403`, `404`, `409`.
- Audit: required.

`POST /api/v1/admin/vendors/:vendorId/suspend`

- Auth: platform admin.
- Request DTO: reason.
- Response DTO: suspended vendor.
- Status codes: `200`, `400`, `403`, `404`, `409`.
- Audit: required.

`GET /api/v1/admin/payments`

- Auth: platform admin.
- Query DTO: status, vendorId, date range, cursor, limit.
- Response DTO: payment monitoring list.
- Status codes: `200`, `400`, `403`.

## 6. RFQ Lifecycle Technical Design

### RFQ State Machine

RFQ statuses:

- `draft`
- `submitted`
- `vendor_reviewing`
- `clarification_requested`
- `quote_in_progress`
- `quote_sent`
- `negotiation`
- `accepted`
- `agreement_pending`
- `agreement_signed`
- `deposit_paid`
- `confirmed`
- `completed`
- `cancelled`

Allowed transitions:

```text
draft -> submitted
submitted -> vendor_reviewing
submitted -> cancelled
vendor_reviewing -> clarification_requested
vendor_reviewing -> quote_in_progress
vendor_reviewing -> cancelled
clarification_requested -> vendor_reviewing
clarification_requested -> cancelled
quote_in_progress -> quote_sent
quote_sent -> negotiation
quote_sent -> accepted
quote_sent -> cancelled
negotiation -> quote_sent
negotiation -> accepted
accepted -> agreement_pending
agreement_pending -> agreement_signed
agreement_pending -> cancelled
agreement_signed -> deposit_paid
deposit_paid -> confirmed
confirmed -> completed
confirmed -> cancelled
```

Invalid transitions should throw `RfqInvalidStatusTransitionError` with status `409`.

### RFQ Creation Flow

Service method:

```ts
submitRfq(actor: CustomerActor, command: SubmitRfqCommand): Promise<RfqDetailDto>
```

Flow:

1. Validate DTO shape with Zod.
2. Validate business rules: lead time, budget, event time, venue, headcount.
3. Resolve targeted vendors. If specific vendor IDs are provided, verify each is active and published. If generalized, call `RfqMatchingService`.
4. Start transaction.
5. Insert `addresses` row for venue.
6. Insert `rfqs` row with `submitted` status.
7. Insert requirement rows.
8. Insert `rfq_vendor_targets` rows.
9. Create message threads for each target.
10. Insert `rfq_status_history`.
11. Insert audit log.
12. Insert outbox events for `rfq.submitted`.
13. Commit.
14. Return RFQ detail.

Rollback behavior: if any database write fails, the RFQ is not partially created. If notification dispatch fails later, the outbox event remains retryable.

### Vendor Matching

MVP matching should be deterministic and PostgreSQL-based:

- Vendor is approved and published.
- Vendor service area covers venue metro/state.
- Vendor cuisine matches requested cuisine when provided.
- Vendor minimum headcount or catering minimum is compatible.
- Vendor has no hard blackout for event date.

The matching service should return ranked vendor IDs with reasons. Do not implement AI matching in MVP.

### Quote Revisions and Negotiation

Quotes use immutable revisions. The `quotes` row points to the current revision.

Revision creation:

1. Lock quote row if it exists.
2. Verify RFQ is in a quotable state.
3. Calculate totals server-side.
4. Insert revision with `revision_number = previous + 1`.
5. Insert line items.
6. Update `quotes.current_revision_id`.
7. Transition RFQ to `quote_sent` or `negotiation`.
8. Emit `quote.sent`.

Customers can accept only `quotes.current_revision_id`. If a customer attempts to accept an older revision, return `409 QUOTE_REVISION_NOT_CURRENT`.

### Approvals

Quote acceptance:

1. Require customer owner.
2. Require idempotency key.
3. Start transaction.
4. Lock RFQ row.
5. Lock quote row.
6. Verify RFQ not cancelled/completed.
7. Verify quote current revision matches request.
8. Mark quote `accepted`.
9. Mark competing quotes `not_selected` if single-vendor booking.
10. Transition RFQ to `accepted`.
11. Create agreement draft and agreement version.
12. Create payment schedule items.
13. Emit `quote.accepted` and `agreement.ready`.
14. Commit.

### Cancellations

Cancellation behavior depends on state:

- Before quote acceptance: customer can cancel without payment flow.
- After agreement signed: cancellation should reference agreement cancellation policy.
- After deposit paid: cancellation may require refund or admin review.
- After confirmed: cancellation creates audit log and may retain calendar event as cancelled.

Every cancellation writes:

- Status history.
- Actor and reason.
- Timestamp.
- Affected quote/agreement/payment references when applicable.

## 7. Service Layer Design

### Service Responsibilities

Services should own:

- Use case orchestration.
- Business validation.
- Status transitions.
- Transaction boundaries.
- Cross-module coordination through public service interfaces.
- Domain event emission through outbox.

Services should not:

- Parse HTTP requests.
- Return raw database rows.
- Know Fastify request/response objects.
- Build SQL directly when repository methods exist.

### Dependency Injection Pattern

Use lightweight manual dependency injection. Avoid a heavy IoC framework for MVP.

```ts
export type RfqServiceDeps = {
  db: Database;
  rfqRepo: RfqRepository;
  targetRepo: RfqVendorTargetRepository;
  messageThreadService: MessageThreadService;
  outbox: OutboxRepository;
  auditLog: AuditLogService;
};

export function createRfqService(deps: RfqServiceDeps): RfqService {
  return new RfqService(deps);
}
```

### Thin Controller Example

```ts
export async function submitRfqController(request: FastifyRequest, reply: FastifyReply) {
  const ctx = request.requestContext;
  const dto = submitRfqSchema.parse(request.body);
  const result = await services.rfq.submitRfq(ctx.requireCustomer(), dto);

  return reply.code(201).send({
    data: result,
    meta: { requestId: ctx.requestId },
  });
}
```

The controller does not calculate lead time, select vendors, insert rows, or emit events.

### Service Orchestration Example

```ts
async submitRfq(actor: CustomerActor, command: SubmitRfqCommand) {
  this.rules.validateSubmitCommand(command);
  const matchedVendors = await this.matching.findEligibleVendors(command);

  if (matchedVendors.length === 0) {
    throw new BusinessRuleError("RFQ_NO_ELIGIBLE_VENDORS");
  }

  return this.db.transaction(async (tx) => {
    const rfq = await this.rfqRepo.insert(tx, actor.userId, command);
    await this.requirementRepo.insertForRfq(tx, rfq.id, command.requirements);
    await this.targetRepo.insertMany(tx, rfq.id, matchedVendors);
    await this.statusRepo.insert(tx, rfq.id, "submitted", actor.userId);
    await this.threadService.createThreadsForTargets(tx, rfq.id, matchedVendors);
    await this.outbox.insert(tx, "rfq.submitted", { rfqId: rfq.id });
    await this.audit.record(tx, actor, "rfq.submitted", rfq.id);
    return this.rfqReadModel.getDetail(tx, rfq.id, actor);
  });
}
```

## 8. Repository/Data Access Layer

### Repository Pattern

Repositories should be small and query-focused. They should accept either the root database client or a transaction client.

```ts
type DbClient = Database | Transaction;

export interface RfqRepository {
  insert(db: DbClient, customerUserId: string, input: InsertRfqInput): Promise<RfqRecord>;
  findById(db: DbClient, rfqId: string): Promise<RfqRecord | null>;
  findVisibleToActor(db: DbClient, rfqId: string, actor: Actor): Promise<RfqRecord | null>;
  updateStatus(db: DbClient, rfqId: string, status: RfqStatus): Promise<void>;
  lockById(db: DbClient, rfqId: string): Promise<RfqRecord>;
}
```

### Query Design Philosophy

- Keep write repositories simple and transaction-friendly.
- Use dedicated read repository methods for dashboard and detail projections.
- Avoid generic repository abstractions that hide important SQL.
- Keep tenant scoping in repository queries where possible and in policies always.
- Return `null` for not found; services decide whether that becomes `404` or `403`.

### Locking Strategy

Use pessimistic row locks for state transitions where concurrent updates are dangerous:

- Accepting quotes.
- Signing agreements.
- Creating confirmed calendar events.
- Updating payment state from webhooks.
- Processing outbox batches.

Use optimistic locking for lower-risk editable resources:

- Vendor profile edits.
- Menu edits.
- Availability settings.

Optimistic locking can use an integer `version` column or `updated_at` comparison.

### Batching Strategy

Batch insert:

- RFQ target vendors.
- Quote line items.
- Menu items.
- Notification deliveries.
- Outbox event claims.

Avoid N+1 queries in:

- Vendor discovery cards.
- Vendor dashboard.
- RFQ inbox.
- Message threads.
- Calendar views.

### Pagination Strategy

Use cursor pagination for user-facing lists. Cursor should encode stable ordered fields.

Examples:

- Vendor search: rank, vendor ID.
- RFQ inbox: created_at, RFQ ID.
- Messages: created_at, message ID.
- Calendar: starts_at, event ID.

Offset pagination is acceptable only for small admin reports.

## 9. Database Technical Design

### Core Conventions

- Primary keys: UUID.
- Public IDs: UUID is acceptable for MVP; add slug where human-readable URLs matter.
- Timestamps: `created_at`, `updated_at`, `deleted_at`.
- Money: integer cents plus currency.
- Time: store instants in UTC; store vendor timezone separately.
- Enums: use PostgreSQL enums for stable statuses or text with check constraints if migration flexibility is preferred.
- Soft deletes: use `deleted_at`.
- Audit: append-only.

### Representative Table Structures

Users:

```sql
users (
  id uuid primary key,
  email citext not null unique,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  status user_status not null default 'active',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Vendors:

```sql
vendors (
  id uuid primary key,
  business_name text not null,
  slug text not null unique,
  description text,
  status vendor_status not null default 'active',
  approval_status vendor_approval_status not null default 'pending',
  is_published boolean not null default false,
  primary_contact_user_id uuid references users(id),
  catering_minimum_cents integer,
  stripe_connect_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
)
```

RFQs:

```sql
rfqs (
  id uuid primary key,
  customer_user_id uuid not null references users(id),
  venue_address_id uuid references addresses(id),
  event_name text not null,
  event_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  indoor_outdoor text not null,
  estimated_headcount integer not null,
  budget_min_cents integer,
  budget_max_cents integer,
  quote_response_deadline timestamptz,
  status rfq_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint rfq_valid_time check (starts_at < ends_at),
  constraint rfq_positive_headcount check (estimated_headcount > 0)
)
```

Quotes:

```sql
quotes (
  id uuid primary key,
  rfq_id uuid not null references rfqs(id),
  vendor_id uuid not null references vendors(id),
  status quote_status not null,
  current_revision_id uuid,
  subtotal_cents integer not null default 0,
  fees_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  deposit_required_cents integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, vendor_id)
)
```

Payments:

```sql
payments (
  id uuid primary key,
  agreement_id uuid not null references agreements(id),
  rfq_id uuid not null references rfqs(id),
  quote_id uuid not null references quotes(id),
  vendor_id uuid not null references vendors(id),
  customer_user_id uuid not null references users(id),
  type payment_type not null,
  status payment_status not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  processing_fee_cents integer not null default 0,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_amount_positive check (amount_cents > 0)
)
```

Platform billing:

```sql
vendor_billing_settings (
  vendor_id uuid primary key references vendors(id),
  agreement_fee_basis_points integer not null default 0,
  billing_email text,
  invoice_terms_days integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agreement_fee_non_negative check (agreement_fee_basis_points >= 0)
)

platform_agreement_fees (
  id uuid primary key,
  agreement_id uuid not null unique references agreements(id),
  vendor_id uuid not null references vendors(id),
  signed_agreement_total_cents integer not null,
  fee_percentage_basis_points integer not null,
  fee_amount_cents integer not null,
  currency text not null default 'usd',
  status platform_fee_status not null default 'pending_invoice',
  vendor_invoice_id uuid,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint signed_total_non_negative check (signed_agreement_total_cents >= 0),
  constraint fee_amount_non_negative check (fee_amount_cents >= 0)
)

vendor_invoices (
  id uuid primary key,
  vendor_id uuid not null references vendors(id),
  invoice_number text not null unique,
  status vendor_invoice_status not null default 'draft',
  subtotal_cents integer not null,
  total_cents integer not null,
  currency text not null default 'usd',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
)
```

Outbox events:

```sql
outbox_events (
  id uuid primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  status outbox_status not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
)
```

### Foreign Keys and Constraints

Use foreign keys for every domain relationship. Use constraints for invariants that must never be violated:

- `starts_at < ends_at`.
- Amounts are non-negative or positive as appropriate.
- Unique Stripe event ID.
- Unique quote per RFQ and vendor.
- Unique active membership per user and vendor.
- Unique revision number per quote.
- Unique platform agreement fee per signed agreement.
- Non-negative platform agreement fee basis points with no amount cap.

### Indexes

Required early indexes:

```sql
create index idx_rfq_customer_created on rfqs(customer_user_id, created_at desc);
create index idx_rfq_status_created on rfqs(status, created_at desc);
create index idx_rfq_targets_vendor_status on rfq_vendor_targets(vendor_id, status, created_at desc);
create index idx_quotes_rfq_vendor on quotes(rfq_id, vendor_id);
create index idx_messages_thread_created on messages(thread_id, created_at desc);
create index idx_calendar_vendor_range on calendar_events(vendor_id, starts_at, ends_at);
create index idx_payments_vendor_status on payments(vendor_id, status, created_at desc);
create index idx_platform_fees_vendor_status on platform_agreement_fees(vendor_id, status, created_at desc);
create index idx_vendor_invoices_vendor_status on vendor_invoices(vendor_id, status, created_at desc);
create index idx_notifications_user_read on notifications(user_id, read_at, created_at desc);
create index idx_outbox_claim on outbox_events(status, available_at, created_at);
```

### Migration Strategy

Use Drizzle migrations. Deployment order:

1. Backup production database.
2. Run migrations.
3. Start new API.
4. Start worker.
5. Run smoke checks.

For breaking changes, use expand-and-contract:

1. Add new nullable column/table.
2. Deploy code writing both old and new.
3. Backfill data.
4. Deploy code reading new.
5. Drop old after verification.

## 10. Authentication Technical Design

### Token Model

Access token:

- JWT.
- Lifetime: 10 to 15 minutes.
- Contains subject user ID, session ID, global roles, active vendor ID optional.
- Sent as `Authorization: Bearer`.

Refresh token:

- Random opaque token, not JWT.
- Stored as secure, HttpOnly, SameSite cookie.
- Stored hashed in `refresh_tokens`.
- Rotated on every refresh.
- Reuse detection revokes the token family.

### Session Invalidation

Invalidate sessions when:

- User logs out.
- Password changes.
- Password reset succeeds.
- Admin suspends user.
- Refresh token reuse is detected.
- High-risk account change occurs.

### Middleware Architecture

`authenticate` middleware:

1. Reads bearer token.
2. Verifies signature and expiry.
3. Loads session by ID.
4. Loads user status.
5. Loads vendor memberships.
6. Attaches `RequestContext`.

`requireVendor` middleware:

1. Reads vendor ID from route.
2. Verifies active membership.
3. Verifies required vendor role.
4. Sets active vendor context.

`requireAdmin` middleware:

1. Verifies platform admin role.
2. Adds audit context.

### Security Edge Cases

- Expired access token returns `401 TOKEN_EXPIRED`.
- Valid token for revoked session returns `401 SESSION_REVOKED`.
- Active user without vendor membership returns `403 VENDOR_ACCESS_DENIED`.
- Suspended user returns `403 USER_SUSPENDED`.
- Refresh token reuse returns `401 REFRESH_TOKEN_REUSED` and revokes family.

## 11. Payment Technical Design

### Stripe Connect Onboarding

Vendor onboarding flow:

1. Vendor owner requests onboarding link.
2. Service creates or retrieves Stripe connected account.
3. Service stores `stripe_connect_account_id`.
4. Service creates account onboarding link.
5. Vendor completes Stripe-hosted onboarding.
6. Webhook updates account capabilities and payout readiness.

Do not allow deposit collection until required Stripe capabilities are active.

### Deposit Collection

Checkout creation flow:

1. Customer requests checkout for signed agreement.
2. Service verifies agreement ownership and signed state.
3. Service loads due deposit schedule item.
4. Service verifies vendor Stripe account readiness.
5. Service creates `payments` and `payment_attempts` records with `checkout_pending`.
6. Service calls Stripe Checkout for the vendor-connected payment flow without relying on the platform agreement fee as a Stripe application fee.
7. Service stores checkout session ID.
8. Response returns checkout URL.
9. Webhook marks final success or failure.

### Event Invoice and Onsite Payment Collection

Future customer payment flows should reuse the same `payment_schedule_items`, `payments`, `payment_attempts`, and webhook processing model.

Full-event invoice payments:

1. Vendor defines invoice payment terms in the accepted quote or agreement.
2. System creates schedule items for deposit, milestones, and final balance.
3. Customer receives invoice/payment link when a schedule item becomes due.
4. Customer pays online through the connected vendor payment flow.
5. Webhook marks the schedule item paid.

Onsite payment collection:

1. Vendor opens the event payment collection flow from the event operations page.
2. System calculates the outstanding balance from agreement schedule items.
3. Vendor collects payment using a supported Stripe flow.
4. System records payment attempt and updates event/payment state from webhook confirmation.

These customer payments are operational payment support for the caterer. They are separate from foodtruckzs agreement-fee invoices to the catering company.

### Platform Agreement Fee Billing

Agreement fee calculation flow:

1. Customer signs catering agreement.
2. Agreement signing transaction locks the agreement and accepted quote revision.
3. Service loads vendor billing settings.
4. Service calculates `fee_amount_cents = signed_agreement_total_cents * agreement_fee_basis_points / 10000`.
5. Service inserts `platform_agreement_fees` with `pending_invoice` status.
6. Service emits `platform_fee.created`.
7. Admin or scheduled billing job groups pending fees into a `vendor_invoice`.
8. foodtruckzs invoices the catering company under configured invoice terms.

Rules:

- The percentage is configurable per food truck caterer/vendor account.
- There is no amount cap.
- The signed agreement total is the calculation basis.
- Platform fee billing is not blocked by whether the customer deposit has been paid.
- Voids and adjustments should use adjustment records, not destructive edits to issued invoice lines.

### Webhook Processing

Webhook handler:

1. Read raw body.
2. Verify Stripe signature.
3. Parse event.
4. Insert event ID into `stripe_webhook_events`.
5. If unique violation, return `200`.
6. Dispatch event type to handler.
7. Handler runs database transaction.
8. Mark webhook event processed or failed.

Important events:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `account.updated`
- `payout.paid`
- `payout.failed`

### Transactional Consistency

Webhook success for deposit should:

1. Lock payment by Stripe payment intent ID.
2. If already succeeded, return safely.
3. Update payment and attempt status.
4. Mark schedule item paid.
5. Transition agreement/RFQ to `deposit_paid`.
6. Call scheduling service inside the same transaction to create confirmed event.
7. Insert outbox events.
8. Commit.

### Refund Flow

Refund request:

1. Validate refundable balance.
2. Create refund record with `requested`.
3. Call Stripe refund outside transaction or through intent pattern.
4. Update refund with Stripe ID and `pending`.
5. Webhook confirms final state.

Refunds should not delete or rewrite original payment records.

### Reconciliation

Run scheduled reconciliation job:

- Find payments stuck in `processing` or `checkout_created`.
- Query Stripe by payment intent/session ID.
- Apply missing state transitions idempotently.
- Alert if local and Stripe states conflict.

## 12. Messaging System Technical Design

### Thread Model

One RFQ target should have one thread between customer and vendor. Admins can view for support but should not be normal participants unless a dispute flow is added.

Thread fields:

- RFQ ID.
- Vendor ID.
- Customer user ID.
- Status.
- Last message ID.
- Last message at.

### Message Persistence

Messages are append-only for normal use. A soft delete marks a message hidden but does not erase the row.

Sending flow:

1. Verify actor can access thread.
2. Validate message body and attachment.
3. Insert message.
4. Update thread last-message metadata.
5. Insert sender read receipt.
6. Emit `message.sent`.

### Read Receipts

Use `message_reads` or per-thread read cursors:

- MVP can store `thread_read_states(user_id, thread_id, last_read_message_id, read_at)`.
- This is more efficient than one row per message per user.

Unread counts should be derived from last read cursor and last message timestamp.

### Notification Triggering

`message.sent` event should create:

- In-app notification for recipient.
- Email notification if preferences allow.
- SMS later for urgent messages.

Do not send email directly in the message transaction.

## 13. Notification Technical Design

### Event Pipeline

Event creation:

```text
service transaction
  -> outbox_events
  -> worker claims event
  -> notification handler
  -> notifications table
  -> notification_deliveries rows
  -> email/SMS provider calls
```

### Queue Processing

Initial implementation uses PostgreSQL polling:

- Claim up to `N` pending events using `FOR UPDATE SKIP LOCKED`.
- Set status to `processing`.
- Process each event.
- Mark `processed`.
- On transient failure, increment attempts and set `available_at`.
- On permanent failure or max attempts, move to dead letter.

### Retry Logic

Use exponential backoff:

- Attempt 1: immediate.
- Attempt 2: 1 minute.
- Attempt 3: 5 minutes.
- Attempt 4: 30 minutes.
- Attempt 5: 2 hours.
- Then dead letter.

### Dead Letter Handling

Dead-lettered jobs should include:

- Event ID.
- Event type.
- Payload.
- Last error.
- Attempts.
- Failed at.

Admin diagnostics should allow reviewing failed notification jobs and manually retrying after fixes.

## 14. Scheduling & Calendar Technical Design

### Event Generation

Confirmed catering events are generated only after:

- Agreement is signed.
- Required deposit is paid.
- Vendor remains active.
- Event time is still valid.

Manual events are created by vendor users and can represent festivals, operating locations, private bookings, or blocked time.

### Conflict Detection

MVP hard conflicts:

- Overlapping confirmed catering event for same vendor.
- Overlapping blocked time for same vendor.
- Manual event marked as blocking.

Overlap query:

```sql
where vendor_id = $1
  and status in ('confirmed', 'blocking')
  and starts_at < $newEndsAt
  and ends_at > $newStartsAt
```

Warnings:

- Tight travel window.
- Overlapping non-blocking festival or food truck location.
- Event outside normal availability.

### Recurring Schedules

MVP should store recurring availability rules, not recurring calendar events. Generate availability windows on read. If recurring manual events are needed later, store recurrence rules and materialize upcoming instances in a background job.

### Travel Buffer Logic

Initial travel buffer implementation:

- Vendor configures default buffer minutes before and after events.
- Conflict detection expands the requested event window by buffer minutes for warnings.
- Hard enforcement can be vendor setting.

Future implementation can calculate actual drive time using a maps API.

### Availability Blocking

Blackout dates and blocked calendar events override recurring availability. RFQ submission should warn customers if the selected vendor is unavailable; quote acceptance and deposit confirmation should enforce hard conflicts.

## 15. Error Handling Strategy

### Error Classes

Use typed application errors:

```ts
class AppError extends Error {
  code: string;
  httpStatus: number;
  details?: Record<string, unknown>;
  isOperational = true;
}
```

Common subclasses:

- `ValidationError`
- `AuthenticationError`
- `AuthorizationError`
- `NotFoundError`
- `ConflictError`
- `BusinessRuleError`
- `ExternalServiceError`
- `RateLimitError`

### Centralized Handler

The Fastify error handler should:

- Preserve request ID.
- Convert Zod errors into `400`.
- Convert domain errors into their configured status.
- Hide internal stack traces in production.
- Log unexpected errors at error level.
- Return consistent error response shape.

### Retryable vs Non-Retryable Errors

Retryable:

- Email provider timeout.
- Stripe API timeout before final confirmation.
- Temporary database connection failure.
- Object storage transient failure.

Non-retryable:

- Invalid RFQ transition.
- Unauthorized access.
- Invalid DTO.
- Payment amount mismatch.
- Expired quote.

## 16. Validation Strategy

### DTO Validation

Use Zod schemas for request DTOs. Share safe schemas with frontend through `packages/shared` only when it does not leak backend-only rules.

Validation layers:

- Transport validation: types, required fields, string lengths.
- Sanitization: trim strings, normalize email, remove unsafe HTML.
- Business validation: lead time, state transitions, ownership, payment state.
- Database validation: foreign keys, unique constraints, check constraints.

### Business Validation

Business validation belongs in services and domain helpers. Examples:

- `RfqRules.assertCanSubmit`.
- `QuoteRules.assertCanCreateRevision`.
- `AgreementRules.assertCanSign`.
- `PaymentRules.assertCanCreateDepositSession`.
- `CalendarRules.assertNoHardConflict`.

### Database Validation

Database constraints should protect invariants even if application bugs slip through:

- Positive amounts.
- Valid time ranges.
- Unique Stripe event IDs.
- Unique current target relationships.
- Non-null foreign keys.

## 17. Async Processing & Jobs

### Job Types

Initial jobs:

- Outbox event dispatcher.
- Email delivery.
- Agreement PDF generation.
- Payment reconciliation.
- Stale RFQ reminder.
- Event reminder.
- Backup verification notifier.

### Worker Process

Run `foodtruckzs-worker` as a separate PM2 process. It should not serve HTTP traffic. It should share code with the API but have separate startup, logging, and graceful shutdown.

### Delayed Jobs

Delayed jobs can be represented with `available_at`. Examples:

- Send event reminder 7 days before event.
- Send event reminder 24 hours before event.
- Retry failed email.
- Follow up on unpaid deposit.

### Eventual Consistency

The user-facing API can return success before email is sent or PDF generation completes. The database should expose intermediate statuses:

- Agreement `generating_document`.
- Notification delivery `pending`.
- Payment `processing`.

The frontend should render these states explicitly.

## 18. File Storage Technical Design

### File Types

Supported storage:

- Vendor images.
- Menu uploads.
- RFQ attachments.
- Agreement PDFs.
- Signed agreement PDFs.
- Dispute/payment attachments.

### Upload Flow

Recommended flow:

1. Client requests upload URL.
2. API validates intent and file metadata.
3. API creates pending `files` row.
4. API returns signed upload URL.
5. Client uploads directly to object storage.
6. Client confirms upload.
7. API verifies object metadata and marks file ready.

For MVP, server-proxied upload is acceptable for lower complexity, but the API must enforce size and type limits.

### Signed URLs

Private files should never be public. Download flow:

1. User requests file access.
2. API verifies authorization.
3. API creates short-lived signed URL.
4. API audits access for agreements and payment documents.

### Local vs Cloud Storage

Local VPS storage is acceptable for temporary processing only. Agreement documents and public marketplace images should use S3-compatible object storage early.

## 19. Logging & Observability

### Structured Logging

Use pino logs with:

- `requestId`
- `userId`
- `vendorId`
- `route`
- `method`
- `statusCode`
- `durationMs`
- `errorCode`
- `stripeEventId`
- `jobId`

### Correlation IDs

Every request gets a request ID. Outbox events and jobs should carry the originating request ID when available. This makes it possible to trace a customer action through API logs, database audit logs, worker logs, and notification delivery attempts.

### Audit Logging

Audit logs are business records, not just application logs. Audit:

- Auth anomalies.
- Vendor approval changes.
- RFQ lifecycle changes.
- Quote acceptance.
- Agreement signing.
- Payment state changes.
- Refunds.
- Admin sensitive reads/writes.

### Metrics

Track:

- Request count and latency by route.
- 4xx and 5xx rates.
- Database query latency for critical queries.
- Outbox pending count.
- Job failure count.
- Stripe webhook processing latency.
- RFQ to quote conversion.
- Quote to agreement conversion.
- Deposit success rate.

## 20. Security Technical Design

### Rate Limiting

Use strict limits on:

- Login.
- Register.
- Password reset.
- RFQ submission.
- Message sending.
- File upload.
- Payment session creation.
- Stripe webhook endpoint by signature validation rather than normal IP rate limits.

Start with Fastify rate limiting. Move to Redis-backed limits when using multiple API processes or servers.

### Brute-Force Protection

- Track login failures by email and IP.
- Add incremental delays or temporary lockouts.
- Notify users on suspicious login patterns.
- Keep error messages generic.

### SQL Injection Prevention

- Use Drizzle parameterized queries.
- Whitelist filters and sort columns.
- Never pass raw client strings into SQL fragments.
- Review any raw SQL query before merge.

### XSS Prevention

- Treat messages and profile text as plain text unless rich text is explicitly implemented.
- Sanitize any allowed rich text.
- Use Content Security Policy.
- Escape output in frontend.

### CSRF Considerations

If refresh tokens are cookies:

- Use `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict`.
- Use CSRF token for refresh/logout if needed.
- Keep mutation API calls authenticated with bearer access tokens.

### Secret Management

- `.env` files never committed.
- Separate development, staging, and production secrets.
- Rotate Stripe and JWT secrets after exposure.
- Restrict server file permissions.

### API Hardening

- HTTPS only.
- Strict CORS.
- Body size limits.
- File type validation.
- Secure headers through Apache and app.
- No stack traces in production responses.
- Admin routes behind stronger monitoring and future MFA.

## 21. Deployment Technical Design

### VPS Process Layout

Run three PM2 apps:

- `foodtruckzs-web`: Next.js frontend.
- `foodtruckzs-api`: Fastify API.
- `foodtruckzs-worker`: background worker.

PostgreSQL may initially run on the same VPS, but should have dedicated backups and monitoring. Move it off-box once the business has meaningful production usage.

### Apache2 Reverse Proxy

Apache routes:

- `/api/*` -> API process.
- `/_next/*` and frontend pages -> Next.js process.
- HTTP -> HTTPS redirect.

Headers:

- Preserve `X-Forwarded-For`.
- Preserve `X-Forwarded-Proto`.
- Add secure headers.
- Enforce upload limits.

### Environment Management

Production environment variables:

- `NODE_ENV`
- `APP_BASE_URL`
- `API_BASE_URL`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` or key pair paths
- `REFRESH_TOKEN_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `EMAIL_PROVIDER_API_KEY`
- `OBJECT_STORAGE_*`
- `CORS_ORIGINS`
- `LOG_LEVEL`

### Deployment Automation

Recommended GitHub Actions flow:

1. Install dependencies.
2. Typecheck.
3. Lint.
4. Run unit tests.
5. Run integration tests with PostgreSQL service.
6. Build API and web.
7. Copy artifact or pull repo on VPS.
8. Install production dependencies.
9. Run migrations.
10. Restart PM2 processes.
11. Run smoke test endpoints.

### Backups

Minimum:

- Daily `pg_dump`.
- Encrypted off-VPS storage.
- 14 to 30 day retention.
- Monthly restore test.
- Object storage versioning for agreements.

## 22. Testing Strategy

### Unit Tests

Unit test pure logic:

- RFQ state machine.
- Quote calculations.
- Payment schedule calculations.
- Agreement rules.
- Conflict detection.
- Authorization policy decisions.

### Integration Tests

Use a real PostgreSQL test database for:

- Repositories.
- Transactions.
- Migrations.
- RFQ creation flow.
- Quote acceptance flow.
- Agreement signing flow.
- Stripe webhook idempotency.

### API Tests

Test Fastify routes with injected requests:

- Auth middleware behavior.
- DTO validation.
- Error responses.
- Permission boundaries.
- Pagination behavior.

### Contract Tests

Stabilize contracts for frontend:

- RFQ detail DTO.
- Vendor search DTO.
- Quote detail DTO.
- Agreement DTO.
- Calendar event DTO.
- Payment status DTO.

### Database Tests

Test constraints:

- Duplicate Stripe events rejected.
- Invalid time ranges rejected.
- Unique quote per RFQ/vendor.
- Soft delete query filters.
- Cascade behavior is intentional.

## 23. Failure Recovery Design

### Rollback Strategies

Application rollback:

- Keep previous build available.
- Restart PM2 with previous release.
- Avoid destructive migrations in same deploy as code changes.

Database rollback:

- Prefer forward fixes.
- Restore from backup only for catastrophic corruption.
- Use expand-and-contract to avoid emergency rollback pressure.

### Transaction Recovery

If a transaction fails, no partial records should remain. If a transaction commits but async processing fails, the outbox event remains retryable.

### Webhook Replay Handling

Stripe webhooks are replay-safe because:

- Event IDs are unique.
- Handlers are idempotent.
- State transitions check current state.
- Payment records are locked during updates.

Manual replay should be supported by admin script or internal tool that reprocesses stored webhook payloads.

### Queue Recovery

Worker startup should:

- Reclaim stale `processing` jobs older than a timeout.
- Increment attempt count.
- Return them to pending if retryable.

### Deployment Recovery

If deploy fails after migrations:

- Fix forward if schema is compatible.
- Roll back code only if migration was backward compatible.
- Keep migrations backward compatible by default.

## 24. Scalability Considerations

### Redis Add Point

Add Redis when:

- PM2 cluster mode makes in-memory rate limiting inaccurate.
- Outbox polling creates too much database load.
- Job volume grows.
- Calendar conflict locks need distributed coordination.
- Realtime notifications or WebSockets are introduced.

Recommended Redis uses:

- BullMQ queues.
- Distributed rate limiting.
- Short-lived cache.
- Idempotency response cache optional.
- WebSocket fanout.

### Database Bottlenecks

Likely bottlenecks:

- Vendor search.
- Dashboard aggregation.
- Message unread counts.
- Calendar range queries.
- Admin payment reports.

Mitigations:

- Index based on access patterns.
- Use read models for dashboards.
- Cache public lookup data.
- Add read replica later for reporting.
- Move analytics to separate pipeline later.

### API Bottlenecks

Likely bottlenecks:

- File uploads if proxied through API.
- PDF generation in request path.
- Large dashboard fan-out queries.
- Stripe webhook bursts.

Mitigations:

- Direct-to-object-storage upload.
- Background PDF generation.
- Purpose-built dashboard queries.
- Queue webhook side effects after verified persistence when needed.

### Horizontal Scaling Path

Before horizontal scaling:

- API is stateless.
- Sessions stored in database.
- Files in object storage.
- Rate limits in Redis.
- Jobs in Redis or claim-safe database queue.
- Logs centralized.

Then run multiple API instances behind a load balancer.

## 25. Engineering Tradeoffs

### Chosen Patterns

The modular monolith is the right first implementation because it preserves service boundaries without forcing distributed systems complexity onto a small team. PostgreSQL is the right system of record because the product is workflow-heavy and relational. Drizzle is preferred because explicit SQL-shaped code is easier to reason about for payments, lifecycle state, and reporting.

Fastify is preferred for a new backend because it has strong TypeScript support, high performance, and clean plugin boundaries. Express is acceptable only if team familiarity materially improves delivery speed.

The transactional outbox is chosen because notifications, emails, webhooks, and background jobs need reliable delivery without adopting Kafka or Redis on day one.

### Complexity Intentionally Avoided

Do not build these for MVP:

- Microservices.
- Kubernetes.
- Kafka.
- Elasticsearch.
- Multi-region deployment.
- Event sourcing for every domain object.
- A custom payment ledger beyond required payment records.
- AI matching infrastructure.
- Complex staff route optimization.

These can be added later when actual product usage proves the need.

### What Must Not Be Compromised

Do not compromise on:

- Server-side authorization.
- Payment idempotency.
- Stripe webhook verification.
- RFQ and quote status history.
- Agreement immutability after signing.
- Database backups.
- DTO validation.
- Centralized error handling.
- Audit logs for sensitive actions.

### Final Implementation Recommendation

Build foodtruckzs as a disciplined TypeScript modular monolith with production-grade service boundaries. Start with PostgreSQL, Drizzle, Fastify, Stripe Connect, object storage, PM2, Apache2, and a database-backed outbox worker. Keep the codebase simple enough for a small team to operate, but strict enough that RFQ workflows, quote revisions, agreements, payments, scheduling, and notifications remain correct as the product grows.
