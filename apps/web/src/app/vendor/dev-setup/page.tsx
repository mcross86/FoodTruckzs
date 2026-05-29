"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { useVendorAuthSession } from "@/lib/auth-session";
import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

const defaultCreatePayload = {
  businessEmail: "hello@exampletruck.test",
  businessName: "Example Catering Truck",
  cateringMinimumCents: 150000,
  cuisineIds: ["replace-with-cuisine-id"],
  ownerContactName: "Owner Name",
  profileDescription: "A catering-ready food truck profile.",
  serviceAreas: [
    {
      city: "Atlanta",
      metroArea: "Atlanta",
      radiusMiles: 35,
      state: "GA",
    },
  ],
  serviceStyles: ["truck onsite", "buffet"],
  settings: {
    minimumLeadTimeDays: 7,
    timezone: "America/New_York",
    travelRadiusMiles: 35,
  },
};

const defaultAvailabilityPayload = {
  exceptions: [],
  rules: [
    {
      dayOfWeek: 5,
      endsAtLocal: "16:00",
      startsAtLocal: "10:00",
      timezone: "America/New_York",
    },
  ],
  settings: {
    minimumLeadTimeDays: 7,
    requestAnywayOnBlackout: false,
    timezone: "America/New_York",
    travelRadiusMiles: 35,
  },
};

const defaultMenuPayload = {
  items: [
    {
      dietaryTags: ["vegetarian-available"],
      name: "Sample Entree",
      priceCents: 1800,
    },
  ],
  name: "Sample Catering Menu",
  packages: [
    {
      minimumGuestCount: 25,
      name: "Event Package",
      priceCents: 2500,
      pricingModel: "per_person",
    },
  ],
};

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

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

/** Internal API exercise screen — not linked from the operator dashboard. */
export default function VendorDevSetupPage() {
  const session = useVendorAuthSession();
  const [createPayload, setCreatePayload] = useState(stringify(defaultCreatePayload));
  const [availabilityPayload, setAvailabilityPayload] = useState(
    stringify(defaultAvailabilityPayload),
  );
  const [menuPayload, setMenuPayload] = useState(stringify(defaultMenuPayload));
  const [result, setResult] = useState<VendorApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedResult = useMemo(() => (result ? stringify(result.body) : ""), [result]);

  async function runRequest(request: {
    body?: unknown;
    method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    path: string;
    requiresVendor?: boolean;
  }) {
    setError(null);

    if (request.requiresVendor && !session.activeVendorId.trim()) {
      setError("Choose an active vendor first.");
      return;
    }

    try {
      const apiResult = await vendorApiRequest({
        apiBaseUrl: session.apiBaseUrl,
        body: request.body,
        method: request.method,
        path: request.path.replace(":vendorId", session.activeVendorId.trim()),
        token: session.accessToken,
      });
      const createdVendorId = readCreatedVendorId(apiResult);

      if (createdVendorId) {
        session.setActiveVendorId(createdVendorId);
        await session.refreshMe();
      }

      setResult(apiResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Request failed.");
    }
  }

  function parsePayload(payload: string): unknown | undefined {
    try {
      setError(null);
      return JSON.parse(payload) as unknown;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Invalid JSON payload.");
      return undefined;
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1180 }}>
      <p>
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
      </p>
      <h1>Vendor API dev setup</h1>
      <p>Development screen for raw vendor API calls. Operators use the Vendor Dashboard instead.</p>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
        <button onClick={() => void runRequest({ path: "/api/v1/marketplace/cuisines" })} type="button">
          Load Cuisines
        </button>
        <button
          onClick={() => {
            const body = parsePayload(createPayload);

            if (body !== undefined) {
              void runRequest({ body, method: "POST", path: "/api/v1/vendors" });
            }
          }}
          type="button"
        >
          Create Vendor
        </button>
        <button
          onClick={() =>
            void runRequest({
              path: "/api/v1/vendors/:vendorId/profile",
              requiresVendor: true,
            })
          }
          type="button"
        >
          Load Profile
        </button>
        <button
          onClick={() => {
            const body = parsePayload(availabilityPayload);

            if (body !== undefined) {
              void runRequest({
                body,
                method: "PUT",
                path: "/api/v1/vendors/:vendorId/availability",
                requiresVendor: true,
              });
            }
          }}
          type="button"
        >
          Save Availability
        </button>
        <button
          onClick={() => {
            const body = parsePayload(menuPayload);

            if (body !== undefined) {
              void runRequest({
                body,
                method: "POST",
                path: "/api/v1/vendors/:vendorId/menus",
                requiresVendor: true,
              });
            }
          }}
          type="button"
        >
          Create Menu
        </button>
        <button
          onClick={() =>
            void runRequest({
              path: "/api/v1/vendors/:vendorId/platform-billing",
              requiresVendor: true,
            })
          }
          type="button"
        >
          Load Billing
        </button>
      </section>

      <section
        style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr", marginTop: 24 }}
      >
        <label>
          Create vendor payload
          <textarea
            onChange={(event) => setCreatePayload(event.target.value)}
            rows={18}
            style={{ display: "block", fontFamily: "monospace", marginTop: 4, width: "100%" }}
            value={createPayload}
          />
        </label>
        <label>
          Availability payload
          <textarea
            onChange={(event) => setAvailabilityPayload(event.target.value)}
            rows={18}
            style={{ display: "block", fontFamily: "monospace", marginTop: 4, width: "100%" }}
            value={availabilityPayload}
          />
        </label>
        <label>
          Menu payload
          <textarea
            onChange={(event) => setMenuPayload(event.target.value)}
            rows={18}
            style={{ display: "block", fontFamily: "monospace", marginTop: 4, width: "100%" }}
            value={menuPayload}
          />
        </label>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Response</h2>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {result ? <p>Status: {result.status}</p> : null}
        <pre style={{ background: "#111", color: "#eee", overflow: "auto", padding: 16 }}>
          {formattedResult || "No response yet."}
        </pre>
      </section>
    </main>
  );
}
