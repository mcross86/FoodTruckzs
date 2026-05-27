import { VendorEventOperations } from "./vendor-event-operations";

export const dynamic = "force-dynamic";

export default async function VendorEventOperationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return <VendorEventOperations eventId={eventId} />;
}
