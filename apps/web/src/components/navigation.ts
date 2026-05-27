export type NavGroup = {
  label: string;
  links: {
    href: string;
    label: string;
  }[];
};

export const navGroups = [
  {
    label: "Discover",
    links: [
      { href: "/", label: "Home" },
      { href: "/discover", label: "Hungry Now" },
      { href: "/plan/event", label: "Plan Event" },
      { href: "/marketplace", label: "Catering Search" },
    ],
  },
  {
    label: "Customer",
    links: [
      { href: "/customer/dashboard", label: "Dashboard" },
      { href: "/notifications", label: "Notifications" },
    ],
  },
  {
    label: "Vendor",
    links: [
      { href: "/vendor/dashboard", label: "Dashboard" },
      { href: "/vendor/rfqs", label: "RFQs" },
      { href: "/vendor/register", label: "Register" },
      { href: "/vendor/login", label: "Login" },
      { href: "/vendor/onboarding", label: "Onboarding" },
      { href: "/vendor/menus", label: "Menus" },
      { href: "/vendor/availability", label: "Availability" },
      { href: "/vendor/calendar", label: "Calendar" },
      { href: "/vendor/payments", label: "Payments" },
      { href: "/vendor/documents", label: "Documents" },
      { href: "/vendor/platform-billing", label: "Platform Billing" },
    ],
  },
  {
    label: "Admin",
    links: [
      { href: "/admin", label: "Operations" },
      { href: "/admin/platform-billing", label: "Platform Billing" },
    ],
  },
] satisfies NavGroup[];

export function allNavHrefs(): string[] {
  return navGroups.flatMap((group) => group.links.map((link) => link.href));
}
