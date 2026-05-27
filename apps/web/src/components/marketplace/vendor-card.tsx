import Link from "next/link";

import { centsToUsd, compactList, type PublicVendorCard } from "@/lib/marketplace-api";

type VendorCardProps = {
  vendor: PublicVendorCard;
};

function serviceAreaLabel(vendor: PublicVendorCard): string {
  if (vendor.serviceAreas.length === 0) {
    return "Service area not listed";
  }

  return vendor.serviceAreas
    .slice(0, 2)
    .map((area) => `${area.metroArea}, ${area.state}`)
    .join(" | ");
}

function priceLabel(vendor: PublicVendorCard): string {
  const minimum = centsToUsd(vendor.cateringMinimumCents);

  if (minimum) {
    return `Catering minimum ${minimum}`;
  }

  if (vendor.samplePriceRangeCents) {
    const min = centsToUsd(vendor.samplePriceRangeCents.minCents);
    const max = centsToUsd(vendor.samplePriceRangeCents.maxCents);
    return min === max ? `Sample pricing ${min}` : `Sample pricing ${min}-${max}`;
  }

  return "Pricing by quote";
}

export function VendorCard({ vendor }: VendorCardProps) {
  return (
    <article
      style={{
        border: "1px solid #ddd",
        borderRadius: 16,
        display: "grid",
        gap: 12,
        padding: 20,
      }}
    >
      <div>
        <p style={{ color: "#8a4b00", margin: "0 0 6px" }}>
          {compactList(vendor.cuisines.map((cuisine) => cuisine.name)) || "Cuisine coming soon"}
        </p>
        <h2 style={{ margin: "0 0 8px" }}>
          <Link href={`/vendors/${vendor.slug}`}>{vendor.businessName}</Link>
        </h2>
        {vendor.headline ? (
          <p style={{ fontWeight: 700, margin: "0 0 8px" }}>{vendor.headline}</p>
        ) : null}
        <p style={{ color: "#444", margin: 0 }}>
          {vendor.description ?? "This food truck is building out its public catering profile."}
        </p>
      </div>

      <dl style={{ display: "grid", gap: 8, margin: 0 }}>
        <div>
          <dt style={{ fontWeight: 700 }}>Service area</dt>
          <dd style={{ margin: 0 }}>{serviceAreaLabel(vendor)}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700 }}>Service styles</dt>
          <dd style={{ margin: 0 }}>
            {compactList(vendor.serviceStyles) || "Service styles not listed"}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700 }}>Budget fit</dt>
          <dd style={{ margin: 0 }}>{priceLabel(vendor)}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700 }}>Dietary and menus</dt>
          <dd style={{ margin: 0 }}>
            {compactList(vendor.dietaryAccommodations) || "Ask in RFQ"} ·{" "}
            {vendor.publishedMenuCount} public menu preview
            {vendor.publishedMenuCount === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700 }}>Availability</dt>
          <dd style={{ margin: 0 }}>
            No guaranteed booking until operator accepts.{" "}
            {vendor.averageResponseTimeMinutes
              ? `Typical response target ${Math.round(vendor.averageResponseTimeMinutes / 60)}h.`
              : "Response target not listed."}
          </dd>
        </div>
      </dl>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Link href={`/rfq/start?vendorId=${vendor.id}`}>Request quote</Link>
        <Link href={`/vendors/${vendor.slug}`}>View profile</Link>
      </div>
    </article>
  );
}
