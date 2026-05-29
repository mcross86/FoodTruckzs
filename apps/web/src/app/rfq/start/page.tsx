import { redirect } from "next/navigation";

import { ROUTES } from "@foodtruckzs/shared";

type SearchParams = Record<string, string | string[] | undefined>;

function serializeSearchParams(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value) {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function RfqStartRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const planQuery = serializeSearchParams(params);
  const next = `${ROUTES.plan.event}${planQuery}`;
  const loginQuery = new URLSearchParams({ next });
  redirect(`${ROUTES.customer.login}?${loginQuery.toString()}`);
}
