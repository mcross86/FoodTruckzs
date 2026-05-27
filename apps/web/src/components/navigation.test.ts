import assert from "node:assert/strict";
import test from "node:test";

import { allNavHrefs, navGroups } from "./navigation";

test("primary navigation exposes public, customer, vendor, and admin areas", () => {
  assert.deepEqual(
    navGroups.map((group) => group.label),
    ["Public", "Customer", "Vendor", "Admin"],
  );
});

test("primary navigation includes MVP workflow routes", () => {
  const hrefs = allNavHrefs();

  for (const href of [
    "/marketplace",
    "/rfq/start",
    "/customer/dashboard",
    "/vendor/dashboard",
    "/vendor/rfqs",
    "/vendor/onboarding",
    "/vendor/menus",
    "/vendor/availability",
    "/vendor/calendar",
    "/admin",
    "/admin/platform-billing",
  ]) {
    assert.ok(hrefs.includes(href), `${href} should be reachable from app navigation`);
  }
});
