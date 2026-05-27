import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type {
  PutObjectInput,
  SignedDownloadInput,
  StorageAdapter,
} from "../../shared/storage/storage-adapter.js";
import { InMemoryAgreementRepository } from "../fakes/in-memory-agreement-repository.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryQuoteRepository } from "../fakes/in-memory-quote-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryStorageRepository } from "../fakes/in-memory-storage-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

const password = "StrongerPassword123!";

class MemoryStorageAdapter implements StorageAdapter {
  readonly bucket = "memory-test";
  readonly objects = new Map<string, Buffer>();
  readonly provider = "local" as const;

  async createSignedDownloadUrl(input: SignedDownloadInput): Promise<string> {
    return `memory://download/${input.fileId}?expiresAt=${encodeURIComponent(input.expiresAt.toISOString())}`;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    this.objects.set(`${input.bucket}/${input.objectKey}`, input.body);
  }
}

async function buildStorageTestApp() {
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
  const storageRepository = new InMemoryStorageRepository(
    agreementRepository,
    rfqRepository,
    vendorRepository,
  );
  const storageAdapter = new MemoryStorageAdapter();
  const app = await buildApp({
    agreementRepository,
    authRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(),
    marketplaceRepository,
    quoteRepository,
    rfqRepository,
    storageAdapter,
    storageRepository,
    vendorRepository,
  });

  return {
    agreementRepository,
    app,
    authRepository,
    rfqRepository,
    storageRepository,
    vendorRepository,
  };
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const response = await app.inject({
    method: "POST",
    payload: {
      email,
      firstName: "Storage",
      lastName: "Tester",
      password,
    },
    url: "/api/v1/auth/register",
  });
  expect(response.statusCode).toBe(201);
  const body = response.json();
  return {
    accessToken: body.data.accessToken as string,
    userId: body.data.user.id as string,
  };
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    payload: { email, password },
    url: "/api/v1/auth/login",
  });
  expect(response.statusCode).toBe(200);
  return response.json().data.accessToken as string;
}

function authHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

async function seedVendor(vendorRepository: InMemoryVendorRepository) {
  const vendor = await vendorRepository.createVendor({
    businessName: "Storage Taco Truck",
    cateringMinimumCents: 100_000,
    slug: `storage-taco-truck-${randomUUID()}`,
    status: "active",
  });
  await vendorRepository.upsertProfile(vendor.id, {
    headline: "Storage Taco Truck",
    publicDescription: "Storage test vendor.",
    serviceStyles: ["truck onsite"],
  });
  return vendor;
}

async function seedRfq(
  rfqRepository: InMemoryRfqRepository,
  customerUserId: string,
  vendorId: string,
) {
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const address = await rfqRepository.createAddress({
    city: "Atlanta",
    country: "US",
    line1: "100 Event Way",
    state: "GA",
  });
  const rfq = await rfqRepository.createRfq({
    customerUserId,
    endsAt: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000),
    estimatedHeadcount: 100,
    eventName: "Storage RFQ",
    eventType: "Corporate lunch",
    indoorOutdoor: "outdoor",
    startsAt,
    status: "submitted",
    timezone: "America/New_York",
    venueAddressId: address.id,
  });
  await rfqRepository.createVendorTargets([{ rfqId: rfq.id, status: "invited", vendorId }]);
  return rfq;
}

describe("file storage routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("limits private RFQ attachment signed URLs to visible participants", async () => {
    const { app, authRepository, rfqRepository, vendorRepository } = await buildStorageTestApp();
    apps.push(app);
    const vendor = await seedVendor(vendorRepository);
    const customer = await registerUser(app, `storage-customer-${randomUUID()}@test.dev`);
    const otherCustomer = await registerUser(app, `storage-other-${randomUUID()}@test.dev`);
    const vendorUser = await registerUser(app, `storage-vendor-${randomUUID()}@test.dev`);
    authRepository.users.set(vendorUser.userId, {
      ...authRepository.users.get(vendorUser.userId)!,
      globalRoles: ["vendor_user"],
    });
    authRepository.addVendorMembership({
      role: "manager",
      userId: vendorUser.userId,
      vendorId: vendor.id,
    });
    const vendorToken = await login(app, authRepository.users.get(vendorUser.userId)!.email);
    const rfq = await seedRfq(rfqRepository, customer.userId, vendor.id);

    const uploadResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
      method: "POST",
      payload: {
        contentBase64: Buffer.from("venue map").toString("base64"),
        contentType: "application/pdf",
        fileName: "venue-map.pdf",
        purpose: "rfq_attachment",
        rfqId: rfq.id,
        sizeBytes: Buffer.byteLength("venue map"),
        vendorId: vendor.id,
      },
      url: "/api/v1/files",
    });
    expect(uploadResponse.statusCode).toBe(201);
    const fileId = uploadResponse.json().data.id as string;

    const deniedResponse = await app.inject({
      headers: authHeaders(otherCustomer.accessToken),
      method: "GET",
      url: `/api/v1/files/${fileId}/download-url`,
    });
    expect(deniedResponse.statusCode).toBe(403);

    const vendorDownloadResponse = await app.inject({
      headers: authHeaders(vendorToken),
      method: "GET",
      url: `/api/v1/files/${fileId}/download-url`,
    });
    expect(vendorDownloadResponse.statusCode).toBe(200);
    expect(vendorDownloadResponse.json().data.downloadUrl).toContain(`memory://download/${fileId}`);
  });

  it("lists vendor documents and authorizes signed agreement file access", async () => {
    const { agreementRepository, app, authRepository, storageRepository, vendorRepository } =
      await buildStorageTestApp();
    apps.push(app);
    const vendor = await seedVendor(vendorRepository);
    const customer = await registerUser(app, `agreement-customer-${randomUUID()}@test.dev`);
    const otherCustomer = await registerUser(app, `agreement-other-${randomUUID()}@test.dev`);
    const vendorUser = await registerUser(app, `agreement-vendor-${randomUUID()}@test.dev`);
    authRepository.users.set(vendorUser.userId, {
      ...authRepository.users.get(vendorUser.userId)!,
      globalRoles: ["vendor_user"],
    });
    authRepository.addVendorMembership({
      role: "owner",
      userId: vendorUser.userId,
      vendorId: vendor.id,
    });
    const vendorToken = await login(app, authRepository.users.get(vendorUser.userId)!.email);
    const agreement = await agreementRepository.createAgreement({
      customerUserId: customer.userId,
      quoteId: randomUUID(),
      quoteRevisionId: randomUUID(),
      rfqId: randomUUID(),
      status: "signed",
      vendorId: vendor.id,
    });

    const uploadResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
      method: "POST",
      payload: {
        agreementId: agreement.id,
        contentBase64: Buffer.from("signed pdf").toString("base64"),
        contentType: "application/pdf",
        fileName: "signed-agreement.pdf",
        purpose: "signed_agreement_document",
        sizeBytes: Buffer.byteLength("signed pdf"),
      },
      url: "/api/v1/files",
    });
    expect(uploadResponse.statusCode).toBe(201);
    const fileId = uploadResponse.json().data.id as string;

    const deniedResponse = await app.inject({
      headers: authHeaders(otherCustomer.accessToken),
      method: "GET",
      url: `/api/v1/files/${fileId}/download-url`,
    });
    expect(deniedResponse.statusCode).toBe(403);

    const vendorDownloadResponse = await app.inject({
      headers: authHeaders(vendorToken),
      method: "GET",
      url: `/api/v1/files/${fileId}/download-url`,
    });
    expect(vendorDownloadResponse.statusCode).toBe(200);
    expect(storageRepository.auditLogs.size).toBe(1);

    const documentsResponse = await app.inject({
      headers: authHeaders(vendorToken),
      method: "GET",
      url: `/api/v1/vendors/${vendor.id}/documents`,
    });
    expect(documentsResponse.statusCode).toBe(200);
    expect(documentsResponse.json().data).toHaveLength(1);
    expect(documentsResponse.json().data[0].id).toBe(fileId);
  });
});
