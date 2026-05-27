export type SendEmailInput = {
  body: string;
  notificationId: string;
  subject: string;
  to: string;
};

export type SendEmailResult = {
  providerMessageId: string;
};

export type EmailDeliveryProvider = {
  sendEmail: (input: SendEmailInput) => Promise<SendEmailResult>;
};

export function createDevelopmentEmailProvider(): EmailDeliveryProvider {
  return {
    async sendEmail(input) {
      return {
        providerMessageId: `dev-email:${input.notificationId}:${Buffer.from(input.to)
          .toString("base64url")
          .slice(0, 24)}`,
      };
    },
  };
}
