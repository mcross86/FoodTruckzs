import Stripe from "stripe";

import { ExternalServiceError } from "../errors/app-error.js";

export type StripeAccountReadiness = {
  accountId: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  payoutsEnabled: boolean;
};

export type StripeCheckoutSessionResult = {
  checkoutUrl: string;
  paymentIntentId: string | null;
  sessionId: string;
};

export type CreateConnectedAccountInput = {
  businessName: string;
  vendorId: string;
};

export type CreateOnboardingLinkInput = {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
};

export type CreateDepositCheckoutSessionInput = {
  amountCents: number;
  connectedAccountId: string;
  currency: string;
  customerUserId: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
  paymentId: string;
  scheduleItemLabel: string;
  successUrl: string;
  cancelUrl: string;
  vendorBusinessName: string;
};

export type StripeWebhookEvent = Stripe.Event;

export type StripeClient = {
  constructWebhookEvent: (
    rawBody: string | Buffer,
    signature: string,
    webhookSecret: string,
  ) => StripeWebhookEvent;
  createConnectedAccount: (input: CreateConnectedAccountInput) => Promise<StripeAccountReadiness>;
  createDepositCheckoutSession: (
    input: CreateDepositCheckoutSessionInput,
  ) => Promise<StripeCheckoutSessionResult>;
  createOnboardingLink: (input: CreateOnboardingLinkInput) => Promise<{ url: string }>;
  retrieveAccount: (accountId: string) => Promise<StripeAccountReadiness>;
};

function toReadiness(account: Stripe.Account): StripeAccountReadiness {
  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    disabledReason: account.requirements?.disabled_reason ?? null,
    payoutsEnabled: account.payouts_enabled,
  };
}

export function createStripeClient(secretKey: string): StripeClient {
  if (!secretKey.trim()) {
    throw new ExternalServiceError("Stripe is not configured.", {
      integration: "stripe",
      missing: "STRIPE_SECRET_KEY",
    });
  }

  const stripe = new Stripe(secretKey);

  return {
    constructWebhookEvent(rawBody, signature, webhookSecret) {
      if (!webhookSecret.trim()) {
        throw new ExternalServiceError("Stripe webhook verification is not configured.", {
          integration: "stripe",
          missing: "STRIPE_WEBHOOK_SECRET",
        });
      }

      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },

    async createConnectedAccount(input) {
      const account = await stripe.accounts.create({
        business_profile: {
          name: input.businessName,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        country: "US",
        metadata: {
          vendorId: input.vendorId,
        },
        type: "express",
      });

      return toReadiness(account);
    },

    async createOnboardingLink(input) {
      const link = await stripe.accountLinks.create({
        account: input.accountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: "account_onboarding",
      });

      return { url: link.url };
    },

    async retrieveAccount(accountId) {
      return toReadiness(await stripe.accounts.retrieve(accountId));
    },

    async createDepositCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create(
        {
          cancel_url: input.cancelUrl,
          line_items: [
            {
              price_data: {
                currency: input.currency,
                product_data: {
                  name: input.scheduleItemLabel,
                  metadata: input.metadata,
                },
                unit_amount: input.amountCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            ...input.metadata,
            paymentId: input.paymentId,
          },
          mode: "payment",
          payment_intent_data: {
            metadata: {
              ...input.metadata,
              paymentId: input.paymentId,
            },
          },
          success_url: input.successUrl,
        },
        {
          idempotencyKey: input.idempotencyKey,
          stripeAccount: input.connectedAccountId,
        },
      );

      if (!session.url) {
        throw new ExternalServiceError("Stripe did not return a checkout URL.", {
          integration: "stripe",
          sessionId: session.id,
        });
      }

      return {
        checkoutUrl: session.url,
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        sessionId: session.id,
      };
    },
  };
}

export function createUnavailableStripeClient(): StripeClient {
  const unavailable = () => {
    throw new ExternalServiceError("Stripe is not configured.", {
      integration: "stripe",
      missing: "STRIPE_SECRET_KEY",
    });
  };

  return {
    constructWebhookEvent: unavailable,
    createConnectedAccount: unavailable,
    createDepositCheckoutSession: unavailable,
    createOnboardingLink: unavailable,
    retrieveAccount: unavailable,
  };
}
