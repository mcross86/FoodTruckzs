import { moneyLabel, type RfqDetail } from "@/lib/rfq-api";

export const vendorTokenStorageKey = "foodtruckzs.vendorAccessToken";
export const vendorIdStorageKey = "foodtruckzs.activeVendorId";
export const apiBaseStorageKey = "foodtruckzs.rfqApiBaseUrl";

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function budgetLabel(rfq: RfqDetail): string {
  const budget = rfq.requirements.budget ?? {};
  const min = typeof budget.budgetMinCents === "number" ? budget.budgetMinCents : null;
  const max = typeof budget.budgetMaxCents === "number" ? budget.budgetMaxCents : null;

  if (min === null && max === null) {
    return "Budget guidance requested";
  }

  return `${moneyLabel(min)} - ${moneyLabel(max)}`;
}

export function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "Not provided";
  return JSON.stringify(value);
}

export function targetForVendor(rfq: RfqDetail, vendorId: string) {
  return rfq.vendorTargets.find((target) => target.vendor.id === vendorId);
}

export function cityStateLabel(rfq: RfqDetail): string {
  return rfq.address ? `${rfq.address.city}, ${rfq.address.state}` : "Venue TBD";
}
