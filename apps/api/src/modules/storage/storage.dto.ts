import { z } from "zod";

const trimmedString = z.string().trim();
const uuidSchema = z.uuid();

export const fileIdParamsSchema = z.object({
  fileId: uuidSchema,
});

export const localDownloadQuerySchema = z.object({
  expiresAt: trimmedString.datetime({ offset: true }),
  signature: trimmedString.min(32),
});

export const vendorDocumentParamsSchema = z.object({
  vendorId: uuidSchema,
});

export const uploadFileSchema = z.object({
  agreementId: uuidSchema.optional(),
  checksum: trimmedString.min(1).max(256).optional(),
  contentBase64: trimmedString.min(1),
  contentType: trimmedString.min(1).max(160),
  fileName: trimmedString.min(1).max(240),
  menuId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  purpose: z.enum([
    "agreement_document",
    "menu_file",
    "rfq_attachment",
    "signed_agreement_document",
    "vendor_document",
    "vendor_image",
  ]),
  rfqId: uuidSchema.optional(),
  sizeBytes: z.number().int().positive().max(25_000_000),
  vendorId: uuidSchema.optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

export type UploadFileDto = z.infer<typeof uploadFileSchema>;
