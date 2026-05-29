import { AdminOperationsDashboard } from "@/components/admin/admin-operations-dashboard";
import { AdminPortalGate } from "@/components/admin/admin-portal-gate";

export default function AdminPortalPage() {
  return (
    <AdminPortalGate>
      <AdminOperationsDashboard />
    </AdminPortalGate>
  );
}
