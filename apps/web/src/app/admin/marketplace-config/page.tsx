import { AdminMarketplaceConfig } from "@/components/admin/admin-marketplace-config";
import { AdminPortalGate } from "@/components/admin/admin-portal-gate";

export default function AdminMarketplaceConfigPage() {
  return (
    <AdminPortalGate>
      <AdminMarketplaceConfig />
    </AdminPortalGate>
  );
}
