import { redirect } from "next/navigation";

import { ROUTES } from "@foodtruckzs/shared";

export default function PlanIndexPage() {
  redirect(ROUTES.customer.login);
}
