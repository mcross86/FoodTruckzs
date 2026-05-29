import { ROUTES } from "@foodtruckzs/shared";

import { CustomerPlanGateway } from "@/components/customer/customer-plan-gateway";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const nextHref = firstValue(params.next) ?? ROUTES.plan.event;
  const returnTo = firstValue(params.from) ?? ROUTES.home;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 560 }}>
      <CustomerPlanGateway nextHref={nextHref} returnTo={returnTo} />
    </main>
  );
}
