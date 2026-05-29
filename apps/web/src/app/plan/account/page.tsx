import { PlanRfqPage, buildPlanPageProps } from "../plan-rfq-page";

export const dynamic = "force-dynamic";

export default async function PlanAccountPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const props = buildPlanPageProps((await searchParams) ?? {});
  return <PlanRfqPage {...props} />;
}
