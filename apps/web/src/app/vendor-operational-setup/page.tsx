import { redirect } from "next/navigation";

import { ROUTES } from "@foodtruckzs/shared";

export default function VendorOperationalSetupRedirectPage() {
  redirect(ROUTES.vendor.dashboard);
}
