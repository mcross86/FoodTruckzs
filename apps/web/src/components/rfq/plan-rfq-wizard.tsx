"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { RfqWizard } from "@/app/rfq/start/rfq-wizard";
import type { RfqSearchSeed } from "@/lib/rfq-draft-hydration";

export const PLAN_STEP_ROUTES = [
  ROUTES.plan.event,
  ROUTES.plan.catering,
  ROUTES.plan.logistics,
  ROUTES.plan.vendors,
  ROUTES.plan.account,
  ROUTES.plan.review,
] as const;

export function planStepIndexFromPath(pathname: string): number {
  const index = PLAN_STEP_ROUTES.findIndex((route) => pathname === route);
  return index >= 0 ? index : 0;
}

type PlanRfqWizardProps = {
  initialVendorIds: string[];
  returnTo?: string;
  searchSeed?: RfqSearchSeed;
};

export function PlanRfqWizard({
  initialVendorIds,
  returnTo = "/",
  searchSeed = {},
}: PlanRfqWizardProps) {
  const pathname = usePathname() ?? ROUTES.plan.event;
  const router = useRouter();
  const initialStep = useMemo(() => planStepIndexFromPath(pathname), [pathname]);

  return (
    <RfqWizard
      initialStep={initialStep}
      initialVendorIds={initialVendorIds}
      onStepChange={(step) => {
        const route = PLAN_STEP_ROUTES[step];
        if (route && route !== pathname) {
          router.push(route);
        }
      }}
      returnTo={returnTo}
      searchSeed={searchSeed}
      variant="plan"
    />
  );
}
