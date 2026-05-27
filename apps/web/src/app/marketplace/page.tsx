import Link from "next/link";

import { VendorCard } from "@/components/marketplace/vendor-card";
import {
  listMarketplaceCuisines,
  searchPublicVendors,
  type MarketplaceFilters,
  type PublicCuisine,
  type SearchPublicVendorsResult,
} from "@/lib/marketplace-api";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readFilters(params: SearchParams): MarketplaceFilters {
  return {
    budgetMaxCents: firstValue(params.budgetMaxCents),
    budgetMinCents: firstValue(params.budgetMinCents),
    cuisine: firstValue(params.cuisine),
    guestCount: firstValue(params.guestCount),
    serviceArea: firstValue(params.serviceArea),
    serviceStyle: firstValue(params.serviceStyle),
  };
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const filters = readFilters(params);
  let result: SearchPublicVendorsResult = { filters: {}, vendors: [] };
  let cuisines: PublicCuisine[] = [];
  let error: string | null = null;

  try {
    [result, cuisines] = await Promise.all([
      searchPublicVendors(filters),
      listMarketplaceCuisines(),
    ]);
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError.message : "Marketplace search failed.";
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1120 }}>
      <header
        style={{
          background:
            "linear-gradient(145deg, rgba(37, 41, 58, 0.94), rgba(31, 35, 52, 0.94))",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 30,
          boxShadow: "0 24px 52px rgba(4, 8, 22, 0.32)",
          marginBottom: 24,
          padding: "clamp(20px, 5vw, 30px)",
        }}
      >
        <Link href="/">foodtruckzs</Link>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "clamp(34px, 7vw, 58px)",
            letterSpacing: -1.2,
            lineHeight: 1,
            marginBottom: 10,
          }}
        >
          Marketplace Search
        </h1>
        <p style={{ color: "#c5cbe0", fontSize: 18, maxWidth: 760 }}>
          Browse approved, published food truck caterers. Availability and final pricing are
          confirmed through the RFQ workflow.
        </p>
      </header>

      <form
        action="/marketplace"
        style={{
          background: "rgba(37, 41, 58, 0.88)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          boxShadow: "0 18px 38px rgba(4, 8, 22, 0.2)",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: 24,
          padding: 16,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          Service area
          <input defaultValue={filters.serviceArea} name="serviceArea" placeholder="Atlanta" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Cuisine
          <input
            defaultValue={filters.cuisine}
            list="cuisine-options"
            name="cuisine"
            placeholder="Tacos"
          />
          <datalist id="cuisine-options">
            {cuisines.map((cuisine) => (
              <option key={cuisine.id} value={cuisine.slug}>
                {cuisine.name}
              </option>
            ))}
          </datalist>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Service style
          <input
            defaultValue={filters.serviceStyle}
            name="serviceStyle"
            placeholder="truck onsite"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Guest count
          <input defaultValue={filters.guestCount} min="1" name="guestCount" type="number" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Event date
          <input name="eventDate" type="date" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Min budget
          <input
            defaultValue={filters.budgetMinCents}
            min="0"
            name="budgetMinCents"
            placeholder="150000"
            type="number"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Max budget
          <input
            defaultValue={filters.budgetMaxCents}
            min="0"
            name="budgetMaxCents"
            placeholder="200000"
            type="number"
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      <section
        style={{
          background: "rgba(135, 221, 247, 0.12)",
          border: "1px dashed rgba(135, 221, 247, 0.38)",
          borderRadius: 22,
          marginBottom: 24,
          padding: 18,
        }}
      >
        <h2 style={{ color: "#f8fafc", marginTop: 0 }}>More RFQ fit filters</h2>
        <p style={{ color: "#c5cbe0" }}>
          Dietary accommodations, dessert service, onsite cooking, buffet service, alcohol service,
          equipment rentals, distance, and availability are still confirmed through RFQ/vendor
          review in this MVP. Operators see those details before quoting, so customers are not
          promised instant availability from search alone.
        </p>
      </section>

      <p
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 999,
          color: "#f8fafc",
          display: "inline-flex",
          fontWeight: 800,
          margin: "0 0 16px",
          padding: "10px 14px",
        }}
      >
        Showing {result.vendors.length} vendor{result.vendors.length === 1 ? "" : "s"}. Final quote
        depends on menu, headcount, travel, staffing, and venue setup.
      </p>
      {!error && result.vendors.length > 1 ? (
        <p>
          <Link
            href={`/rfq/start?vendorIds=${result.vendors.map((vendor) => vendor.id).join(",")}`}
          >
            Request quotes from visible vendors
          </Link>
        </p>
      ) : null}

      {error ? (
        <section style={{ background: "#ff9d66", borderRadius: 22, padding: 20 }}>
          <h2 style={{ color: "#171b2a" }}>Marketplace API unavailable</h2>
          <p style={{ color: "#171b2a" }}>{error}</p>
          <p style={{ color: "#171b2a" }}>Start the API locally to load live vendor search results.</p>
        </section>
      ) : null}

      {!error && result.vendors.length === 0 ? (
        <section style={{ background: "#ffe66d", borderRadius: 22, padding: 20 }}>
          <h2 style={{ color: "#171b2a" }}>No matching food trucks yet</h2>
          <p style={{ color: "#171b2a" }}>
            Try broadening the cuisine, service area, guest count, or budget filters. You can still
            start a general catering request and let foodtruckzs match it later.
          </p>
          <Link href="/rfq/start">Start a general RFQ</Link>
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {result.vendors.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </section>
    </main>
  );
}
