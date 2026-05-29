/** Canonical frontend paths for foodtruckzs. */

export const ROUTES = {
  home: "/",
  discover: "/discover",
  discoverTruck: (slug: string) => `/discover/trucks/${slug}`,
  plan: {
    root: "/plan",
    event: "/plan/event",
    catering: "/plan/catering",
    logistics: "/plan/logistics",
    vendors: "/plan/vendors",
    account: "/plan/account",
    review: "/plan/review",
    /** @deprecated Use plan.catering */
    preferences: "/plan/catering",
  },
  marketplace: "/marketplace",
  vendorProfile: (slug: string) => `/vendors/${slug}`,
  rfq: {
    /** Canonical catering RFQ flow lives under /plan/* */
    start: "/plan/event",
    confirmation: "/rfq/confirmation",
    legacyStart: "/rfq/start",
  },
  customer: {
    login: "/customer/login",
    dashboard: "/customer/dashboard",
    profile: "/customer/profile",
    rfqs: "/customer/rfqs",
    messages: "/customer/messages",
    rfq: (rfqId: string) => `/customer/rfqs/${rfqId}`,
    quote: (quoteId: string) => `/customer/quotes/${quoteId}`,
    agreement: (agreementId: string) => `/customer/agreements/${agreementId}`,
    deposit: (agreementId: string) => `/customer/payments/deposits/${agreementId}`,
  },
  vendor: {
    login: "/vendor/login",
    register: "/vendor/register",
    dashboard: "/vendor/dashboard",
    profile: "/vendor/onboarding",
    menus: "/vendor/menus",
    rfqs: "/vendor/rfqs",
    availability: "/vendor/availability",
    hoursLocations: "/vendor/calendar?focus=operating",
    calendar: "/vendor/calendar",
    account: "/vendor/payments",
    platformBilling: "/vendor/platform-billing",
    onboarding: "/vendor/onboarding",
    /** @deprecated Use vendor.dashboard */
    operationalSetup: "/vendor/dashboard",
  },
  admin: {
    login: "/admin/login",
    root: "/admin",
    vendors: "/admin/vendors",
    marketplaceConfig: "/admin/marketplace-config",
    platformBilling: "/admin/platform-billing",
  },
  notifications: "/notifications",
} as const;

export const GATEWAY_PATH_PREFIXES = [
  "/",
  "/discover",
  "/plan",
  "/customer/login",
  "/vendor/login",
  "/vendor/register",
] as const;

export function isGatewayPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/discover") ||
    pathname.startsWith("/plan") ||
    pathname === ROUTES.customer.login ||
    pathname === ROUTES.vendor.login ||
    pathname === ROUTES.vendor.register
  );
}
