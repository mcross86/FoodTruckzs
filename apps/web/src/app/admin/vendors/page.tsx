import { AdminVendorApprovals } from "@/components/admin/admin-vendor-approvals";
import { AdminPortalGate } from "@/components/admin/admin-portal-gate";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const approvalStatus = firstValue(params.approvalStatus);

  const initialApprovalStatus =
    approvalStatus === "all" ||
    approvalStatus === "approved" ||
    approvalStatus === "pending" ||
    approvalStatus === "rejected"
      ? approvalStatus
      : "pending";

  return (
    <AdminPortalGate>
      <AdminVendorApprovals initialApprovalStatus={initialApprovalStatus} />
    </AdminPortalGate>
  );
}
