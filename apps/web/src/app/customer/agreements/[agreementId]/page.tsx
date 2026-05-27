import { CustomerAgreementReview } from "./customer-agreement-review";

type CustomerAgreementPageProps = {
  params: Promise<{
    agreementId: string;
  }>;
};

export default async function CustomerAgreementPage({ params }: CustomerAgreementPageProps) {
  const { agreementId } = await params;

  return <CustomerAgreementReview agreementId={agreementId} />;
}
