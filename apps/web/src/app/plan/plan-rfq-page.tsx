import Link from "next/link";

import { PlanRfqWizard } from "@/components/rfq/plan-rfq-wizard";
import type { RfqSearchSeed } from "@/lib/rfq-draft-hydration";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function values(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function buildPlanPageProps(searchParams: SearchParams = {}) {
  const selectedVendorIds = [
    ...values(searchParams.vendorId),
    ...values(searchParams.vendorIds).flatMap((value) => value.split(",")),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  const searchSeed: RfqSearchSeed = {
    budgetMaxCents: firstValue(searchParams.budgetMaxCents),
    budgetMinCents: firstValue(searchParams.budgetMinCents),
    cuisine: firstValue(searchParams.cuisine),
    eventDate: firstValue(searchParams.eventDate),
    eventType: firstValue(searchParams.eventType),
    guestCount: firstValue(searchParams.guestCount),
    serviceArea: firstValue(searchParams.serviceArea),
  };

  const returnTo = firstValue(searchParams.from) ?? "/";

  return { returnTo, searchSeed, selectedVendorIds };
}

export function PlanRfqPage({
  returnTo,
  searchSeed,
  selectedVendorIds,
}: ReturnType<typeof buildPlanPageProps>) {
  return (
    <>
      <p>
        <Link href={returnTo}>← Back</Link>
      </p>
      <PlanRfqWizard
        initialVendorIds={selectedVendorIds}
        returnTo={returnTo}
        searchSeed={searchSeed}
      />
    </>
  );
}
