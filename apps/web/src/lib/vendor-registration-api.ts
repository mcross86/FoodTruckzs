import { ROUTES } from "@foodtruckzs/shared";

import { parseCuisinesText } from "@/lib/catering-cuisines";
import { listMarketplaceCuisines } from "@/lib/marketplace-api";
import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

export type VendorRegisterDraftInput = {
  businessName: string;
  businessPhone: string;
  cuisinesText: string;
  email: string;
  firstName: string;
  headline: string;
  lastName: string;
  phone: string;
  publicDescription: string;
  serviceIncludeSurroundingArea: boolean;
  serviceState: string;
  serviceZipCode: string;
};

function readCreatedVendorId(result: VendorApiResult): string | undefined {
  if (typeof result.body !== "object" || result.body === null || !("data" in result.body)) {
    return undefined;
  }

  const data = (result.body as { data?: unknown }).data;

  if (typeof data !== "object" || data === null || !("vendor" in data)) {
    return undefined;
  }

  const vendor = (data as { vendor?: unknown }).vendor;

  if (typeof vendor !== "object" || vendor === null || !("id" in vendor)) {
    return undefined;
  }

  const id = (vendor as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function resolveCuisineIds(cuisinesText: string, available: { id: string; name: string; slug: string }[]) {
  const selected = parseCuisinesText(cuisinesText).filter(
    (name) => name.toLowerCase() !== "vendor recommendation",
  );
  const ids = new Set<string>();

  for (const name of selected) {
    const normalized = name.toLowerCase();
    const match = available.find((cuisine) => {
      const cuisineName = cuisine.name.toLowerCase();
      const cuisineSlug = cuisine.slug.toLowerCase();
      return (
        cuisineName === normalized ||
        cuisineSlug === normalized.replace(/\s+/g, "-") ||
        cuisineName.includes(normalized) ||
        normalized.includes(cuisineName)
      );
    });

    if (match) {
      ids.add(match.id);
    }
  }

  if (ids.size === 0 && available[0]) {
    ids.add(available[0].id);
  }

  return [...ids];
}

export async function createVendorFromRegisterDraft(input: {
  apiBaseUrl: string;
  draft: VendorRegisterDraftInput;
  token: string;
}): Promise<string> {
  const cuisines = await listMarketplaceCuisines();
  const cuisineIds = resolveCuisineIds(input.draft.cuisinesText, cuisines);
  const zip = input.draft.serviceZipCode.trim().split("-")[0] ?? "";
  const state = input.draft.serviceState.trim().toUpperCase();

  if (cuisineIds.length === 0) {
    throw new Error(
      `No cuisines are configured in the marketplace yet. A platform admin must add cuisine categories at ${ROUTES.admin.marketplaceConfig} before vendors can complete setup.`,
    );
  }

  const ownerContactName = [input.draft.firstName.trim(), input.draft.lastName.trim()]
    .filter(Boolean)
    .join(" ");

  const result = await vendorApiRequest({
    apiBaseUrl: input.apiBaseUrl,
    body: {
      businessEmail: input.draft.email.trim() || undefined,
      businessName: input.draft.businessName.trim(),
      businessPhone: input.draft.businessPhone.trim() || input.draft.phone.trim() || undefined,
      cateringMinimumCents: 150_000,
      cuisineIds,
      headline: input.draft.headline.trim() || undefined,
      ownerContactName: ownerContactName || undefined,
      profileDescription: input.draft.publicDescription.trim() || undefined,
      serviceAreas: [
        {
          metroArea: zip,
          postalCode: zip,
          radiusMiles: input.draft.serviceIncludeSurroundingArea ? 25 : 15,
          state,
        },
      ],
      serviceStyles: ["food truck onsite", "catering"],
      settings: {
        minimumLeadTimeDays: 7,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        travelRadiusMiles: input.draft.serviceIncludeSurroundingArea ? 25 : 15,
      },
    },
    method: "POST",
    path: "/api/v1/vendors",
    token: input.token,
  });

  if (!result.ok) {
    const message =
      typeof result.body === "object" &&
      result.body !== null &&
      "error" in result.body &&
      typeof (result.body as { error?: { message?: string } }).error?.message === "string"
        ? (result.body as { error: { message: string } }).error.message
        : `Create vendor failed (${result.status}).`;
    throw new Error(message);
  }

  const vendorId = readCreatedVendorId(result);
  if (!vendorId) {
    throw new Error("Vendor was created but the response did not include a vendor id.");
  }

  return vendorId;
}
