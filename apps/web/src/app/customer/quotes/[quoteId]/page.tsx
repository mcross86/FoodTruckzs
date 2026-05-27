import { CustomerQuoteReview } from "./customer-quote-review";

type CustomerQuoteReviewPageProps = {
  params: Promise<{
    quoteId: string;
  }>;
};

export default async function CustomerQuoteReviewPage({ params }: CustomerQuoteReviewPageProps) {
  const { quoteId } = await params;
  return <CustomerQuoteReview quoteId={quoteId} />;
}
