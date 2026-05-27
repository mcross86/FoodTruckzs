import { VendorRfqDetail } from "./vendor-rfq-detail";

export const dynamic = "force-dynamic";

export default async function VendorRfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = await params;

  return <VendorRfqDetail rfqId={rfqId} />;
}
