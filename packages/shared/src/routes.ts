/** Canonical frontend paths for foodtruckzs. */

export const ROUTES = {
  home: "/",
  discover: "/discover",
  discoverTruck: (slug: string) => `/discover/trucks/${slug}`,
  plan: {
    root: "/plan",
    event: "/plan/event",
    preferences: "/plan/preferences",
    account: "/plan/account",
    review: "/plan/review",
  },
  marketplace: "/marketplace",
  vendorProfile: (slug: string) => `/vendors/${slug}`,
  rfq: {
    start: "/rfq/start",
    confirmation: "/rfq/confirmation",
  },
  customer: {
    dashboard: "/customer/dashboard",
    rfq: (rfqId: string) => `/customer/rfqs/${rfqId}`,
    quote: (quoteId: string) => `/customer/quotes/${quoteId}`,
    agreement: (agreementId: string) => `/customer/agreements/${agreementId}`,
    deposit: (agreementId: string) => `/customer/payments/deposits/${agreementId}`,
  },
  vendor: {
    login: "/vendor/login",
    register: "/vendor/register",
    dashboard: "/vendor/dashboard",
    rfqs: "/vendor/rfqs",
    onboarding: "/vendor/onboarding",
  },
  admin: {
    root: "/admin",
    platformBilling: "/admin/platform-billing",
  },
  notifications: "/notifications",
} as const;

export const GATEWAY_PATH_PREFIXES = ["/", "/discover", "/plan", "/vendor/login", "/vendor/register"] as const;

export function isGatewayPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/discover") ||
    pathname.startsWith("/plan") ||
    pathname === ROUTES.vendor.login ||
    pathname === ROUTES.vendor.register
  );
}
