import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

export type AdminCuisine = {
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
};

type ApiEnvelope<T> = {
  data: T;
};

function readEnvelopeData<T>(result: VendorApiResult): T | null {
  if (!result.ok || typeof result.body !== "object" || result.body === null || !("data" in result.body)) {
    return null;
  }

  return (result.body as ApiEnvelope<T>).data;
}

export function slugFromCuisineName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export async function listAdminCuisines(input: {
  apiBaseUrl: string;
  token: string;
}): Promise<AdminCuisine[]> {
  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    path: "/api/v1/admin/cuisines",
    token: input.token,
  });

  return readEnvelopeData<AdminCuisine[]>(result) ?? [];
}

export async function createAdminCuisine(input: {
  apiBaseUrl: string;
  isActive?: boolean;
  name: string;
  slug: string;
  token: string;
}): Promise<{ cuisine: AdminCuisine | null; result: VendorApiResult }> {
  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    body: {
      isActive: input.isActive ?? true,
      name: input.name.trim(),
      slug: input.slug.trim(),
    },
    method: "POST",
    path: "/api/v1/admin/cuisines",
    token: input.token,
  });

  return {
    cuisine: readEnvelopeData<AdminCuisine>(result),
    result,
  };
}

export async function updateAdminCuisine(input: {
  apiBaseUrl: string;
  cuisineId: string;
  isActive?: boolean;
  name?: string;
  slug?: string;
  token: string;
}): Promise<{ cuisine: AdminCuisine | null; result: VendorApiResult }> {
  const body: { isActive?: boolean; name?: string; slug?: string } = {};

  if (input.isActive !== undefined) body.isActive = input.isActive;
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.slug !== undefined) body.slug = input.slug.trim();

  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    body,
    method: "PATCH",
    path: `/api/v1/admin/cuisines/${encodeURIComponent(input.cuisineId)}`,
    token: input.token,
  });

  return {
    cuisine: readEnvelopeData<AdminCuisine>(result),
    result,
  };
}

export type AdminVendorReview = {
  cuisines: { id: string; name: string; slug: string }[];
  profile: {
    businessEmail: string | null;
    businessPhone: string | null;
    headline: string | null;
    ownerContactName: string | null;
    publicDescription: string | null;
    serviceStyles: string[];
  } | null;
  serviceAreas: { city: string; metroArea: string | null; radiusMiles: number | null; state: string }[];
  vendor: {
    approvalStatus: "approved" | "pending" | "rejected";
    businessName: string;
    cateringMinimumCents: number | null;
    createdAt: string;
    id: string;
    isPublished: boolean;
    pricingSummary: string | null;
    slug: string;
    status: string;
    updatedAt: string;
  };
};

export async function listAdminVendors(input: {
  apiBaseUrl: string;
  approvalStatus?: "approved" | "pending" | "rejected";
  search?: string;
  token: string;
}): Promise<AdminVendorReview[]> {
  const params = new URLSearchParams();
  if (input.approvalStatus) params.set("approvalStatus", input.approvalStatus);
  if (input.search?.trim()) params.set("search", input.search.trim());
  const query = params.toString();

  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    path: `/api/v1/admin/vendors${query ? `?${query}` : ""}`,
    token: input.token,
  });

  return readEnvelopeData<AdminVendorReview[]>(result) ?? [];
}

export async function approveAdminVendor(input: {
  apiBaseUrl: string;
  note?: string;
  token: string;
  vendorId: string;
}): Promise<{ result: VendorApiResult; vendor: AdminVendorReview | null }> {
  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    body: input.note?.trim() ? { note: input.note.trim() } : {},
    method: "POST",
    path: `/api/v1/admin/vendors/${encodeURIComponent(input.vendorId)}/approve`,
    token: input.token,
  });

  return {
    result,
    vendor: readEnvelopeData<AdminVendorReview>(result),
  };
}

export async function rejectAdminVendor(input: {
  apiBaseUrl: string;
  reason: string;
  token: string;
  vendorId: string;
}): Promise<{ result: VendorApiResult; vendor: AdminVendorReview | null }> {
  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    body: { reason: input.reason.trim() },
    method: "POST",
    path: `/api/v1/admin/vendors/${encodeURIComponent(input.vendorId)}/reject`,
    token: input.token,
  });

  return {
    result,
    vendor: readEnvelopeData<AdminVendorReview>(result),
  };
}

export async function requestAdminVendorChanges(input: {
  apiBaseUrl: string;
  note: string;
  token: string;
  vendorId: string;
}): Promise<{ result: VendorApiResult; vendor: AdminVendorReview | null }> {
  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    body: { note: input.note.trim() },
    method: "POST",
    path: `/api/v1/admin/vendors/${encodeURIComponent(input.vendorId)}/request-changes`,
    token: input.token,
  });

  return {
    result,
    vendor: readEnvelopeData<AdminVendorReview>(result),
  };
}

export function adminApiErrorMessage(result: VendorApiResult): string {
  if (typeof result.body === "object" && result.body !== null) {
    const body = result.body as { error?: { message?: unknown }; message?: unknown };

    if (typeof body.error?.message === "string") {
      return body.error.message;
    }

    if (typeof body.message === "string") {
      return body.message;
    }
  }

  return `Request failed with status ${result.status}.`;
}
