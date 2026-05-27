export type PublicCuisine = {
  id: string;
  name: string;
  slug: string;
};

export type PublicServiceArea = {
  city: string | null;
  metroArea: string;
  postalCode: string | null;
  radiusMiles: number | null;
  state: string;
};

export type PublicPriceRange = {
  maxCents: number;
  minCents: number;
};

export type PublicVendorCard = {
  averageResponseTimeMinutes: number | null;
  businessName: string;
  cateringMinimumCents: number | null;
  cuisines: PublicCuisine[];
  description: string | null;
  dietaryAccommodations: string[];
  headline: string | null;
  id: string;
  minimumGuestCount: number | null;
  pricingSummary: string | null;
  publishedMenuCount: number;
  samplePriceRangeCents: PublicPriceRange | null;
  serviceAreas: PublicServiceArea[];
  serviceStyles: string[];
  slug: string;
  travelRadiusMiles: number | null;
};

export type PublicVendorProfile = PublicVendorCard & {
  menus: {
    description: string | null;
    dietaryTags: string[];
    items: {
      category: string | null;
      description: string | null;
      dietaryTags: string[];
      name: string;
      priceCents: number | null;
    }[];
    maximumGuestCount: number | null;
    minimumGuestCount: number | null;
    name: string;
    packages: {
      description: string | null;
      dietaryTags: string[];
      maximumGuestCount: number | null;
      minimumGuestCount: number | null;
      name: string;
      priceCents: number | null;
      pricingModel: string;
    }[];
    serviceStyles: string[];
  }[];
  minimumLeadTimeDays: number | null;
  publicDescription: string | null;
  quoteResponseTargetHours: number | null;
  socialLinks: Record<string, string>;
  websiteUrl: string | null;
};

type ApiEnvelope<T> = {
  data: T;
};

export type SearchPublicVendorsResult = {
  filters: Record<string, unknown>;
  vendors: PublicVendorCard[];
};

export type MarketplaceFilters = {
  budgetMaxCents?: string;
  budgetMinCents?: string;
  cuisine?: string;
  guestCount?: string;
  serviceArea?: string;
  serviceStyle?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function marketplaceUrl(path: string, searchParams?: URLSearchParams): string {
  const url = new URL(path, apiBaseUrl.replace(/\/?$/, "/"));

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}

async function getJson<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const response = await fetch(marketplaceUrl(path, searchParams), {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Marketplace API request failed with ${response.status}.`);
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  return body.data;
}

export function centsToUsd(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

export function compactList(values: string[]): string {
  return values.filter(Boolean).join(", ");
}

export async function listMarketplaceCuisines(): Promise<PublicCuisine[]> {
  return getJson<PublicCuisine[]>("/api/v1/marketplace/cuisines");
}

export async function searchPublicVendors(
  filters: MarketplaceFilters,
): Promise<SearchPublicVendorsResult> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) {
      searchParams.set(key, value.trim());
    }
  }

  return getJson<SearchPublicVendorsResult>("/api/v1/marketplace/vendors", searchParams);
}

export async function getPublicVendorProfile(slug: string): Promise<PublicVendorProfile> {
  return getJson<PublicVendorProfile>(`/api/v1/marketplace/vendors/${encodeURIComponent(slug)}`);
}
