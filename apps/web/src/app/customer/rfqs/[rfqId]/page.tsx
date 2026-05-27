import { CustomerRfqDetail } from "./customer-rfq-detail";

export const dynamic = "force-dynamic";

export default async function CustomerRfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = await params;

  return <CustomerRfqDetail rfqId={rfqId} />;
}
