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
        background: "rgba(37, 41, 58, 0.92)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 28,
        boxShadow: "0 18px 38px rgba(4, 8, 22, 0.22)",
        display: "grid",
        gap: 16,
        overflow: "hidden",
        padding: 20,
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          gap: 12,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            background: "#ff9d66",
            borderRadius: 18,
            boxShadow: "0 10px 22px rgba(255, 157, 102, 0.2)",
            flex: "0 0 auto",
            height: 52,
            width: 52,
          }}
        />
        <div>
          <p style={{ color: "#87ddf7", fontWeight: 800, margin: "0 0 6px" }}>
            {compactList(vendor.cuisines.map((cuisine) => cuisine.name)) || "Cuisine coming soon"}
          </p>
          <h2 style={{ color: "#f8fafc", margin: "0 0 8px" }}>
            <Link href={`/vendors/${vendor.slug}`}>{vendor.businessName}</Link>
          </h2>
        </div>
      </div>
      <div>
        {vendor.headline ? (
          <p style={{ color: "#f8fafc", fontWeight: 700, margin: "0 0 8px" }}>
            {vendor.headline}
          </p>
        ) : null}
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          {vendor.description ?? "This food truck is building out its public catering profile."}
        </p>
      </div>

      <dl style={{ display: "grid", gap: 8, margin: 0 }}>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Service area</dt>
          <dd style={{ color: "#c5cbe0", margin: 0 }}>{serviceAreaLabel(vendor)}</dd>
        </div>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Service styles</dt>
          <dd style={{ color: "#c5cbe0", margin: 0 }}>
            {compactList(vendor.serviceStyles) || "Service styles not listed"}
          </dd>
        </div>
        <div
          style={{
            background: "#ffe66d",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <dt style={{ color: "#171b2a", fontWeight: 800 }}>Budget fit</dt>
          <dd style={{ color: "#171b2a", margin: 0 }}>{priceLabel(vendor)}</dd>
        </div>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Dietary and menus</dt>
          <dd style={{ color: "#c5cbe0", margin: 0 }}>
            {compactList(vendor.dietaryAccommodations) || "Ask in RFQ"} ·{" "}
            {vendor.publishedMenuCount} public menu preview
            {vendor.publishedMenuCount === 1 ? "" : "s"}
          </dd>
        </div>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Availability</dt>
          <dd style={{ color: "#c5cbe0", margin: 0 }}>
            No guaranteed booking until operator accepts.{" "}
            {vendor.averageResponseTimeMinutes
              ? `Typical response target ${Math.round(vendor.averageResponseTimeMinutes / 60)}h.`
              : "Response target not listed."}
          </dd>
        </div>
      </dl>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Link
          href={`/rfq/start?vendorId=${vendor.id}`}
          style={{
            background: "#87ddf7",
            borderRadius: 999,
            color: "#171b2a",
            padding: "10px 14px",
          }}
        >
          Request quote
        </Link>
        <Link
          href={`/vendors/${vendor.slug}`}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 999,
            color: "#f8fafc",
            padding: "10px 14px",
          }}
        >
          View profile
        </Link>
      </div>
    </article>
  );
}
