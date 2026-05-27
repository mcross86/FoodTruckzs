import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  agreementIdParamsSchema,
  quoteAgreementParamsSchema,
  signAgreementSchema,
} from "./agreements.dto.js";
import type { AgreementService } from "./agreements.service.js";

type AgreementRouteDeps = {
  agreementService: AgreementService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerAgreementRoutes(
  app: FastifyInstance,
  deps: AgreementRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);

  app.get("/api/v1/agreements/:agreementId", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(agreementIdParamsSchema, request.params);
    const agreement = await deps.agreementService.getAgreement(
      request.requestContext,
      params.agreementId,
    );
    return envelope(request.requestContext.requestId, agreement);
  });

  app.post(
    "/api/v1/agreements/:agreementId/generate",
    { preHandler: authenticate },
    async (request, reply) => {
      const params = parseWithZod(agreementIdParamsSchema, request.params);
      const agreement = await deps.agreementService.generateVersion(
        request.requestContext,
        params.agreementId,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, agreement));
    },
  );

  app.post(
    "/api/v1/quotes/:quoteId/agreement",
    { preHandler: authenticate },
    async (request, reply) => {
      const params = parseWithZod(quoteAgreementParamsSchema, request.params);
      const agreement = await deps.agreementService.ensureDraftForAcceptedQuote(
        request.requestContext,
        params.quoteId,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, agreement));
    },
  );

  app.post(
    "/api/v1/agreements/:agreementId/sign",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(agreementIdParamsSchema, request.params);
      const dto = parseWithZod(signAgreementSchema, request.body);
      const agreement = await deps.agreementService.signAgreement(
        request.requestContext,
        params.agreementId,
        dto,
      );
      return envelope(request.requestContext.requestId, agreement);
    },
  );

  app.get(
    "/api/v1/agreements/:agreementId/download-url",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(agreementIdParamsSchema, request.params);
      const download = await deps.agreementService.getDownloadUrl(
        request.requestContext,
        params.agreementId,
      );
      return envelope(request.requestContext.requestId, download);
    },
  );
}
