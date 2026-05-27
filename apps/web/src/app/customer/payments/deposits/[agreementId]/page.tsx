import { CustomerDepositPayment } from "./customer-deposit-payment";

type CustomerDepositPaymentPageProps = {
  params: Promise<{
    agreementId: string;
  }>;
};

export default async function CustomerDepositPaymentPage({
  params,
}: CustomerDepositPaymentPageProps) {
  const { agreementId } = await params;
  return <CustomerDepositPayment agreementId={agreementId} />;
}
