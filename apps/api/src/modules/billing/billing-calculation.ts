export function calculateAgreementFeeCents(
  signedAgreementTotalCents: number,
  agreementFeeBasisPoints: number,
): number {
  return Math.round((signedAgreementTotalCents * agreementFeeBasisPoints) / 10_000);
}
