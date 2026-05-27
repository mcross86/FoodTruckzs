import Link from "next/link";

import { RfqWizard } from "./rfq-wizard";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function values(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

export default async function RfqStartPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const selectedVendorIds = [
    ...values(params.vendorId),
    ...values(params.vendorIds).flatMap((value) => value.split(",")),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const returnTo = firstValue(params.from) ?? "/marketplace";

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1120 }}>
      <p>
        <Link href={returnTo}>Back to marketplace</Link>
      </p>
      <RfqWizard initialVendorIds={selectedVendorIds} />
    </main>
  );
}
