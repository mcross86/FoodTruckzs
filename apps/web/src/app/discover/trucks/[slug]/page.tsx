import Link from "next/link";
import { notFound } from "next/navigation";

import { ROUTES } from "@foodtruckzs/shared";

import { VendorProfile } from "@/components/marketplace/vendor-profile";
import { getPublicVendorProfile } from "@/lib/marketplace-api";

export const dynamic = "force-dynamic";

export default async function DiscoverTruckPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let vendor;
  try {
    vendor = await getPublicVendorProfile(slug);
  } catch {
    notFound();
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 960 }}>
      <p>
        <Link href={ROUTES.discover}>← Back to discovery</Link>
      </p>
      <section
        style={{
          background: "rgba(37, 41, 58, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 20,
          marginBottom: 20,
          padding: 16,
        }}
      >
        <p style={{ color: "#9cf579", fontWeight: 800, margin: "0 0 6px" }}>
          LIVE DISCOVERY PROFILE (PREVIEW)
        </p>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Photos, live location, route schedule, and order CTAs will appear here as the discovery
          domain ships. Menu and catering details below come from the published vendor profile.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.businessName)}`}
            rel="noreferrer"
            style={{
              background: "#87ddf7",
              borderRadius: 999,
              color: "#171b2a",
              fontWeight: 800,
              padding: "10px 14px",
            }}
            target="_blank"
          >
            Get directions
          </a>
          <Link
            href={`${ROUTES.rfq.start}?vendorId=${vendor.id}&from=${encodeURIComponent(ROUTES.discoverTruck(slug))}`}
            style={{
              background: "#ffe66d",
              borderRadius: 999,
              color: "#171b2a",
              fontWeight: 800,
              padding: "10px 14px",
            }}
          >
            Request catering quote
          </Link>
        </div>
      </section>
      <VendorProfile vendor={vendor} />
    </main>
  );
}
