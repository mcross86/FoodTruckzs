import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  fileIdParamsSchema,
  localDownloadQuerySchema,
  uploadFileSchema,
  vendorDocumentParamsSchema,
} from "./storage.dto.js";
import type { StorageService } from "./storage.service.js";

type StorageRouteDeps = {
  storageService: StorageService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerStorageRoutes(
  app: FastifyInstance,
  deps: StorageRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const requireVendorRead = requireVendorMembership();

  app.post("/api/v1/files", { preHandler: authenticate }, async (request, reply) => {
    const dto = parseWithZod(uploadFileSchema, request.body);
    const file = await deps.storageService.uploadFile(request.requestContext, dto);
    return reply.code(201).send(envelope(request.requestContext.requestId, file));
  });

  app.get("/api/v1/files/:fileId/download-url", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(fileIdParamsSchema, request.params);
    const download = await deps.storageService.getDownloadUrl(
      request.requestContext,
      params.fileId,
    );
    return envelope(request.requestContext.requestId, download);
  });

  app.get("/api/v1/files/:fileId/download", async (request, reply) => {
    const params = parseWithZod(fileIdParamsSchema, request.params);
    const query = parseWithZod(localDownloadQuerySchema, request.query);
    const download = await deps.storageService.openSignedLocalDownload(params.fileId, {
      expiresAt: new Date(query.expiresAt),
      signature: query.signature,
    });

    return reply
      .header("content-type", download.contentType)
      .header(
        "content-disposition",
        `attachment; filename="${download.fileName.replace(/"/g, "")}"`,
      )
      .send(download.body);
  });

  app.get(
    "/api/v1/vendors/:vendorId/documents",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorDocumentParamsSchema, request.params);
      const files = await deps.storageService.listVendorDocuments(
        request.requestContext,
        params.vendorId,
      );
      return envelope(request.requestContext.requestId, files);
    },
  );
}
