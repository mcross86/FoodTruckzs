import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  acceptQuoteSchema,
  createQuoteRevisionSchema,
  createQuoteSchema,
  declineQuoteSchema,
  quoteIdParamsSchema,
  requestQuoteRevisionSchema,
  rfqQuoteParamsSchema,
} from "./quotes.dto.js";
import type { QuoteService } from "./quotes.service.js";

type QuoteRouteDeps = {
  quoteService: QuoteService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerQuoteRoutes(
  app: FastifyInstance,
  deps: QuoteRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);

  app.post("/api/v1/rfqs/:rfqId/quotes", { preHandler: authenticate }, async (request, reply) => {
    const params = parseWithZod(rfqQuoteParamsSchema, request.params);
    const dto = parseWithZod(createQuoteSchema, request.body);
    const quote = await deps.quoteService.createQuote(request.requestContext, params.rfqId, dto);
    return reply.code(201).send(envelope(request.requestContext.requestId, quote));
  });

  app.get("/api/v1/rfqs/:rfqId/quotes", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(rfqQuoteParamsSchema, request.params);
    const quotes = await deps.quoteService.listRfqQuotes(request.requestContext, params.rfqId);
    return envelope(request.requestContext.requestId, quotes);
  });

  app.get("/api/v1/quotes/:quoteId", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(quoteIdParamsSchema, request.params);
    const quote = await deps.quoteService.getQuote(request.requestContext, params.quoteId);
    return envelope(request.requestContext.requestId, quote);
  });

  app.post(
    "/api/v1/quotes/:quoteId/revisions",
    { preHandler: authenticate },
    async (request, reply) => {
      const params = parseWithZod(quoteIdParamsSchema, request.params);
      const dto = parseWithZod(createQuoteRevisionSchema, request.body);
      const quote = await deps.quoteService.createRevision(
        request.requestContext,
        params.quoteId,
        dto,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, quote));
    },
  );

  app.post("/api/v1/quotes/:quoteId/accept", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(quoteIdParamsSchema, request.params);
    const dto = parseWithZod(acceptQuoteSchema, request.body);
    const quote = await deps.quoteService.acceptQuote(request.requestContext, params.quoteId, dto);
    return envelope(request.requestContext.requestId, quote);
  });

  app.post("/api/v1/quotes/:quoteId/decline", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(quoteIdParamsSchema, request.params);
    const dto = parseWithZod(declineQuoteSchema, request.body);
    const quote = await deps.quoteService.declineQuote(request.requestContext, params.quoteId, dto);
    return envelope(request.requestContext.requestId, quote);
  });

  app.post(
    "/api/v1/quotes/:quoteId/request-revision",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(quoteIdParamsSchema, request.params);
      const dto = parseWithZod(requestQuoteRevisionSchema, request.body);
      const quote = await deps.quoteService.requestRevision(
        request.requestContext,
        params.quoteId,
        dto,
      );
      return envelope(request.requestContext.requestId, quote);
    },
  );
}
