export type MenuApiRequest = {
  apiBaseUrl: string;
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
  token?: string;
};

export type MenuApiResult<T> = {
  body: unknown;
  data: T | null;
  ok: boolean;
  status: number;
};

type ApiEnvelope<T> = {
  data: T;
};

export type VendorMenuStatus = "draft" | "published" | "archived";
export type VendorMenuPricingModel = "fixed" | "per_person" | "market";

export type VendorMenuRow = {
  createdAt: string;
  description: string | null;
  dietaryTags: string[];
  id: string;
  isPublic: boolean;
  maximumGuestCount: number | null;
  minimumGuestCount: number | null;
  name: string;
  prepLeadTimeHours: number | null;
  seasonalEndDate: string | null;
  seasonalStartDate: string | null;
  serviceStyles: string[];
  status: VendorMenuStatus;
  updatedAt: string;
  vendorId: string;
};

export type VendorMenuItemRow = {
  category: string | null;
  createdAt: string;
  description: string | null;
  dietaryTags: string[];
  id: string;
  isAvailable: boolean;
  menuId: string;
  name: string;
  priceCents: number | null;
  sortOrder: number;
  status: "active" | "archived";
  updatedAt: string;
  vendorId: string;
};

export type VendorMenuPackageRow = {
  createdAt: string;
  description: string | null;
  dietaryTags: string[];
  id: string;
  includedItemIds: string[];
  isAvailable: boolean;
  maximumGuestCount: number | null;
  menuId: string;
  minimumGuestCount: number | null;
  name: string;
  priceCents: number | null;
  pricingModel: VendorMenuPricingModel;
  sortOrder: number;
  status: "active" | "archived";
  updatedAt: string;
  vendorId: string;
};

export type MenuDetail = {
  items: VendorMenuItemRow[];
  menu: VendorMenuRow;
  packages: VendorMenuPackageRow[];
};

export type CreateMenuPayload = {
  description?: string;
  dietaryTags?: string[];
  isPublic?: boolean;
  items?: {
    category?: string;
    description?: string;
    dietaryTags?: string[];
    isAvailable?: boolean;
    name: string;
    priceCents?: number;
    sortOrder?: number;
  }[];
  maximumGuestCount?: number;
  minimumGuestCount?: number;
  name: string;
  packages?: {
    description?: string;
    dietaryTags?: string[];
    includedItemIds?: string[];
    isAvailable?: boolean;
    maximumGuestCount?: number;
    minimumGuestCount?: number;
    name: string;
    priceCents?: number;
    pricingModel?: VendorMenuPricingModel;
    sortOrder?: number;
  }[];
  prepLeadTimeHours?: number;
  serviceStyles?: string[];
  status?: VendorMenuStatus;
};

export type UpdateMenuPayload = Partial<
  Omit<CreateMenuPayload, "items" | "packages">
>;

export type CreateMenuItemPayload = {
  category?: string;
  description?: string;
  dietaryTags?: string[];
  isAvailable?: boolean;
  name: string;
  priceCents?: number;
  sortOrder?: number;
};

export type UpdateMenuItemPayload = Partial<CreateMenuItemPayload> & {
  status?: "active" | "archived";
};

export type CreateMenuPackagePayload = {
  description?: string;
  dietaryTags?: string[];
  includedItemIds?: string[];
  isAvailable?: boolean;
  maximumGuestCount?: number;
  minimumGuestCount?: number;
  name: string;
  priceCents?: number;
  pricingModel?: VendorMenuPricingModel;
  sortOrder?: number;
};

export type UpdateMenuPackagePayload = Partial<CreateMenuPackagePayload> & {
  status?: "active" | "archived";
};

function endpoint(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}${path}`;
}

export async function menuApiRequest<T>(request: MenuApiRequest): Promise<MenuApiResult<T>> {
  const headers = new Headers({
    accept: "application/json",
  });

  if (request.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (request.token?.trim()) {
    headers.set("authorization", `Bearer ${request.token.trim()}`);
  }

  const response = await fetch(endpoint(request.apiBaseUrl, request.path), {
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    headers,
    method: request.method ?? "GET",
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  const data =
    body && typeof body === "object" && "data" in body
      ? ((body as ApiEnvelope<T>).data ?? null)
      : null;

  return {
    body,
    data,
    ok: response.ok,
    status: response.status,
  };
}

export function menuApiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: string } }).error;
    if (error?.message?.trim()) {
      return error.message;
    }
  }

  return fallback;
}

export function centsToUsd(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100);
}

export function dollarsToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.round(parsed * 100);
}

export function centsToDollarInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "";
  }

  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function parseTagList(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTagList(tags: string[]): string {
  return tags.join(", ");
}

export function guestRangeLabel(minimum: number | null, maximum: number | null): string {
  if (minimum && maximum) {
    return `${minimum}–${maximum} guests`;
  }
  if (minimum) {
    return `${minimum}+ guests`;
  }
  if (maximum) {
    return `Up to ${maximum} guests`;
  }
  return "Guest count by quote";
}

export function menuStatusLabel(status: VendorMenuStatus): string {
  if (status === "published") {
    return "Published";
  }
  if (status === "archived") {
    return "Archived";
  }
  return "Draft";
}

export function pricingModelLabel(model: VendorMenuPricingModel): string {
  if (model === "per_person") {
    return "per person";
  }
  if (model === "market") {
    return "market price";
  }
  return "fixed";
}

export function groupItemsByCategory(items: VendorMenuItemRow[]): { category: string; items: VendorMenuItemRow[] }[] {
  const groups = new Map<string, VendorMenuItemRow[]>();

  for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    const category = item.category?.trim() || "Uncategorized";
    const bucket = groups.get(category) ?? [];
    bucket.push(item);
    groups.set(category, bucket);
  }

  return [...groups.entries()].map(([category, groupedItems]) => ({
    category,
    items: groupedItems,
  }));
}

export const MENU_TEMPLATE: CreateMenuPayload = {
  description: "Reusable catering menu for quotes and marketplace previews.",
  dietaryTags: ["vegetarian-available"],
  isPublic: false,
  items: [
    {
      category: "Mains",
      dietaryTags: ["gluten-free-available"],
      name: "Signature Entree",
      priceCents: 1800,
      sortOrder: 0,
    },
    {
      category: "Sides",
      name: "Seasonal Side",
      priceCents: 600,
      sortOrder: 1,
    },
  ],
  minimumGuestCount: 25,
  name: "Corporate Catering Menu",
  packages: [
    {
      minimumGuestCount: 25,
      name: "Buffet Package",
      priceCents: 2800,
      pricingModel: "per_person",
      sortOrder: 0,
    },
  ],
  serviceStyles: ["buffet", "truck onsite"],
  status: "draft",
};

export const DIETARY_TAG_SUGGESTIONS = [
  "vegetarian-available",
  "vegan-available",
  "gluten-free-available",
  "dairy-free-available",
  "nut-free",
  "halal",
  "kosher",
];
