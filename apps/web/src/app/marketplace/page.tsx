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
      <header style={{ marginBottom: 24 }}>
        <Link href="/">foodtruckzs</Link>
        <h1>Marketplace Search</h1>
        <p>
          Browse approved, published food truck caterers. Availability and final pricing are
          confirmed through the RFQ workflow.
        </p>
      </header>

      <form
        action="/marketplace"
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: 24,
          padding: 16,
        }}
      >
        <label>
          Service area
          <input defaultValue={filters.serviceArea} name="serviceArea" placeholder="Atlanta" />
        </label>
        <label>
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
        <label>
          Service style
          <input
            defaultValue={filters.serviceStyle}
            name="serviceStyle"
            placeholder="truck onsite"
          />
        </label>
        <label>
          Guest count
          <input defaultValue={filters.guestCount} min="1" name="guestCount" type="number" />
        </label>
        <label>
          Event date
          <input name="eventDate" type="date" />
        </label>
        <label>
          Min budget
          <input
            defaultValue={filters.budgetMinCents}
            min="0"
            name="budgetMinCents"
            placeholder="150000"
            type="number"
          />
        </label>
        <label>
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
        style={{ border: "1px dashed #bbb", borderRadius: 16, marginBottom: 24, padding: 16 }}
      >
        <h2 style={{ marginTop: 0 }}>More RFQ fit filters</h2>
        <p>
          Dietary accommodations, dessert service, onsite cooking, buffet service, alcohol service,
          equipment rentals, distance, and availability are still confirmed through RFQ/vendor
          review in this MVP. Operators see those details before quoting, so customers are not
          promised instant availability from search alone.
        </p>
      </section>

      <p>
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
        <section style={{ background: "#fff4df", borderRadius: 16, padding: 20 }}>
          <h2>Marketplace API unavailable</h2>
          <p>{error}</p>
          <p>Start the API locally to load live vendor search results.</p>
        </section>
      ) : null}

      {!error && result.vendors.length === 0 ? (
        <section style={{ background: "#fff4df", borderRadius: 16, padding: 20 }}>
          <h2>No matching food trucks yet</h2>
          <p>
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
