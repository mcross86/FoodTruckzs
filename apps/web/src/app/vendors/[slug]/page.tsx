import Link from "next/link";

import { VendorProfile } from "@/components/marketplace/vendor-profile";
import { getPublicVendorProfile } from "@/lib/marketplace-api";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const vendor = await getPublicVendorProfile(slug);

    return (
      <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
        <VendorProfile vendor={vendor} />
      </main>
    );
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Vendor profile could not be loaded.";

    return (
      <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 760 }}>
        <Link href="/marketplace">Back to marketplace</Link>
        <h1>Vendor profile unavailable</h1>
        <p>
          This profile may be unpublished, suspended, or not approved for marketplace visibility.
        </p>
        <p>{message}</p>
        <Link href="/rfq/start">Start a general RFQ</Link>
      </main>
    );
  }
}
