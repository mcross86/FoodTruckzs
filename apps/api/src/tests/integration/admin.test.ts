import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { InMemoryAdminRepository } from "../fakes/in-memory-admin-repository.js";
import { InMemoryAgreementRepository } from "../fakes/in-memory-agreement-repository.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryBillingRepository } from "../fakes/in-memory-billing-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryPaymentRepository } from "../fakes/in-memory-payment-repository.js";
import { InMemoryQuoteRepository } from "../fakes/in-memory-quote-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

const password = "StrongerPassword123!";

async function buildAdminTestApp() {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const marketplaceRepository = new InMemoryMarketplaceRepository(vendorRepository);
  const rfqRepository = new InMemoryRfqRepository(vendorRepository);
  const quoteRepository = new InMemoryQuoteRepository(rfqRepository);
  const agreementRepository = new InMemoryAgreementRepository(
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const billingRepository = new InMemoryBillingRepository(agreementRepository, vendorRepository);
  const paymentRepository = new InMemoryPaymentRepository(
    agreementRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const adminRepository = new InMemoryAdminRepository(
    agreementRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const app = await buildApp({
    adminRepository,
    agreementRepository,
    authRepository,
    billingRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(),
    marketplaceRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  });

  return {
    adminRepository,
    app,
    authRepository,
    paymentRepository,
    rfqRepository,
    vendorRepository,
  };
}

async function registerUser(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const response = await app.inject({
    method: "POST",
    payload: {
      email,
      firstName: "Admin",
      lastName: "Tester",
      password,
    },
    url: "/api/v1/auth/register",
  });

  expect(response.statusCode).toBe(201);
  return response.json().data.user.id as string;
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const response = await app.inject({
    method: "POST",
    payload: {
      email,
      password,
    },
    url: "/api/v1/auth/login",
  });

  expect(response.statusCode).toBe(200);
  return response.json().data.accessToken as string;
}

async function tokenWithRoles(
  app: Awaited<ReturnType<typeof buildApp>>,
  authRepository: InMemoryAuthRepository,
  email: string,
  globalRoles: string[],
) {
  const userId = await registerUser(app, email);
  const user = authRepository.users.get(userId);
  expect(user).toBeDefined();
  authRepository.users.set(userId, {
    ...user!,
    globalRoles,
  });
  return login(app, email);
}

function authHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

async function seedVendor(vendorRepository: InMemoryVendorRepository) {
  const cuisine = await vendorRepository.createCuisine({
    isActive: true,
    name: "Tacos",
    slug: `tacos-${randomUUID().slice(0, 8)}`,
  });
  const vendor = await vendorRepository.createVendor({
    businessName: "Admin Review Tacos",
    cateringMinimumCents: 125_000,
    description: "Catering tacos for marketplace review.",
    pricingSummary: "$18 per guest minimum",
    slug: `admin-review-tacos-${randomUUID().slice(0, 8)}`,
    status: "active",
  });

  await vendorRepository.upsertProfile(vendor.id, {
    businessEmail: "hello@review-tacos.test",
    headline: "Tacos ready for catering",
    ownerContactName: "Tess Owner",
    publicDescription: "Fresh tacos for office and private events.",
    serviceStyles: ["truck onsite", "buffet"],
  });
  await vendorRepository.replaceVendorCuisines(vendor.id, [cuisine.id]);
  await vendorRepository.replaceServiceAreas(vendor.id, {
    serviceAreas: [{ city: "Austin", metroArea: "Austin", state: "TX" }],
  });

  return vendor;
}

describe("admin operations routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("enforces admin roles and audits vendor approval decisions", async () => {
    const { adminRepository, app, authRepository, vendorRepository } = await buildAdminTestApp();
    apps.push(app);
    const vendor = await seedVendor(vendorRepository);
    const customerToken = await tokenWithRoles(
      app,
      authRepository,
      "customer-admin-denied@test.dev",
      ["customer"],
    );
    const supportToken = await tokenWithRoles(app, authRepository, "support@test.dev", [
      "support_admin",
    ]);
    const platformToken = await tokenWithRoles(app, authRepository, "platform@test.dev", [
      "platform_admin",
    ]);

    const customerDeniedResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "GET",
      url: "/api/v1/admin/vendors",
    });
    expect(customerDeniedResponse.statusCode).toBe(403);

    const supportListResponse = await app.inject({
      headers: authHeaders(supportToken),
      method: "GET",
      url: "/api/v1/admin/vendors?approvalStatus=pending",
    });
    expect(supportListResponse.statusCode).toBe(200);
    expect(supportListResponse.json().data).toHaveLength(1);

    const supportApproveDeniedResponse = await app.inject({
      headers: authHeaders(supportToken),
      method: "POST",
      payload: { note: "Looks good." },
      url: `/api/v1/admin/vendors/${vendor.id}/approve`,
    });
    expect(supportApproveDeniedResponse.statusCode).toBe(403);

    const requestChangesResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "POST",
      payload: { note: "Please upload current insurance metadata." },
      url: `/api/v1/admin/vendors/${vendor.id}/request-changes`,
    });
    expect(requestChangesResponse.statusCode).toBe(200);
    expect(requestChangesResponse.json().data.vendor.isPublished).toBe(false);

    const approveResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "POST",
      payload: { note: "Insurance and service area reviewed." },
      url: `/api/v1/admin/vendors/${vendor.id}/approve`,
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json().data.vendor.approvalStatus).toBe("approved");
    expect(approveResponse.json().data.vendor.isPublished).toBe(true);

    const hideResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "PATCH",
      payload: { isPublished: false, reason: "Temporarily hidden for stale profile copy." },
      url: `/api/v1/admin/vendors/${vendor.id}/marketplace-visibility`,
    });
    expect(hideResponse.statusCode).toBe(200);
    expect(hideResponse.json().data.vendor.isPublished).toBe(false);

    const actions = [...adminRepository.auditLogs.values()].map((auditLog) => auditLog.action);
    expect(actions).toContain("admin.vendor.changes_requested");
    expect(actions).toContain("admin.vendor.approved");
    expect(actions).toContain("admin.marketplace_visibility.updated");
  });

  it("exposes RFQ dispute review, payment monitoring, and webhook failures to admins", async () => {
    const {
      adminRepository,
      app,
      authRepository,
      paymentRepository,
      rfqRepository,
      vendorRepository,
    } = await buildAdminTestApp();
    apps.push(app);
    const platformToken = await tokenWithRoles(app, authRepository, "ops-admin@test.dev", [
      "platform_admin",
    ]);
    const vendor = await seedVendor(vendorRepository);
    const address = await rfqRepository.createAddress({
      city: "Austin",
      line1: "100 Congress Ave",
      state: "TX",
    });
    const rfq = await rfqRepository.createRfq({
      customerUserId: randomUUID(),
      endsAt: new Date("2026-07-10T20:00:00.000Z"),
      estimatedHeadcount: 120,
      eventName: "Admin Review Lunch",
      eventType: "corporate lunch",
      indoorOutdoor: "outdoor",
      startsAt: new Date("2026-07-10T17:00:00.000Z"),
      status: "submitted",
      timezone: "America/Chicago",
      venueAddressId: address.id,
    });
    await rfqRepository.createVendorTargets([
      {
        rfqId: rfq.id,
        status: "invited",
        vendorId: vendor.id,
      },
    ]);
    const payment = await paymentRepository.createPayment({
      agreementId: randomUUID(),
      amountCents: 25_000,
      customerUserId: rfq.customerUserId,
      quoteId: randomUUID(),
      rfqId: rfq.id,
      status: "failed",
      type: "deposit",
      vendorId: vendor.id,
    });
    await paymentRepository.createAttempt({
      amountCents: 25_000,
      failureCode: "card_declined",
      failureMessage: "Card declined in test.",
      paymentId: payment.id,
      status: "failed",
    });
    await paymentRepository.createWebhookEvent({
      eventType: "payment_intent.payment_failed",
      lastError: "No matching payment intent.",
      payload: { id: "evt_failed_test" },
      status: "failed",
      stripeEventId: "evt_failed_test",
    });

    const rfqReviewResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "GET",
      url: `/api/v1/admin/rfqs/${rfq.id}`,
    });
    expect(rfqReviewResponse.statusCode).toBe(200);
    expect(rfqReviewResponse.json().data.rfq.eventName).toBe("Admin Review Lunch");

    const disputeResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "PATCH",
      payload: { note: "Customer reports deposit issue.", status: "open" },
      url: `/api/v1/admin/rfqs/${rfq.id}/dispute`,
    });
    expect(disputeResponse.statusCode).toBe(200);

    const paymentsResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "GET",
      url: "/api/v1/admin/payments?status=failed",
    });
    expect(paymentsResponse.statusCode).toBe(200);
    expect(paymentsResponse.json().data).toHaveLength(1);
    expect(paymentsResponse.json().data[0].attempts[0].failureCode).toBe("card_declined");

    const webhooksResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "GET",
      url: "/api/v1/admin/stripe-webhooks?failedOnly=true",
    });
    expect(webhooksResponse.statusCode).toBe(200);
    expect(webhooksResponse.json().data[0].stripeEventId).toBe("evt_failed_test");

    const dashboardResponse = await app.inject({
      headers: authHeaders(platformToken),
      method: "GET",
      url: "/api/v1/admin/dashboard",
    });
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json().data.counts.failedPayments).toBe(1);
    expect(dashboardResponse.json().data.counts.failedStripeWebhooks).toBe(1);

    const actions = [...adminRepository.auditLogs.values()].map((auditLog) => auditLog.action);
    expect(actions).toContain("admin.rfq_review.viewed");
    expect(actions).toContain("admin.rfq_dispute.status_changed");
    expect(actions).toContain("admin.payment_monitoring.viewed");
    expect(actions).toContain("admin.stripe_webhooks.viewed");
  });
});
