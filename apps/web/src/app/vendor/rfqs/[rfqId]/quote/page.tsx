import { VendorQuoteBuilder } from "./vendor-quote-builder";

type VendorQuoteBuilderPageProps = {
  params: Promise<{
    rfqId: string;
  }>;
};

export default async function VendorQuoteBuilderPage({ params }: VendorQuoteBuilderPageProps) {
  const { rfqId } = await params;
  return <VendorQuoteBuilder rfqId={rfqId} />;
}
