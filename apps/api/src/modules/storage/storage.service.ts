import { createHash, randomUUID } from "node:crypto";

import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type { StorageAdapter } from "../../shared/storage/storage-adapter.js";
import type { UploadFileDto } from "./storage.dto.js";
import type { FileRow, StorageRepository, VendorDocumentRecord } from "./storage.repository.js";

type FilePurpose = UploadFileDto["purpose"];

export type StoredFileResult = {
  bucket: string;
  checksum: string | null;
  contentType: string;
  createdAt: Date;
  fileName: string;
  id: string;
  metadata: Record<string, unknown>;
  objectKey: string;
  purpose: string | null;
  sizeBytes: number;
  status: string;
  storageProvider: string;
  vendorId: string | null;
  visibility: string;
};

export type FileDownloadUrlResult = {
  downloadUrl: string;
  expiresAt: Date;
  file: StoredFileResult;
};

export type LocalDownloadResult = {
  body: Buffer;
  contentType: string;
  fileName: string;
};

export type CreateSystemFileInput = {
  agreementId?: string;
  body: Buffer;
  contentType: string;
  fileName: string;
  metadata?: Record<string, unknown>;
  ownerUserId?: string;
  purpose: FilePurpose;
  rfqId?: string;
  vendorId?: string;
  visibility?: "private" | "public";
};

export type StorageService = {
  createSystemFile: (input: CreateSystemFileInput) => Promise<StoredFileResult>;
  getDownloadUrl: (ctx: RequestContext, fileId: string) => Promise<FileDownloadUrlResult>;
  listVendorDocuments: (ctx: RequestContext, vendorId: string) => Promise<StoredFileResult[]>;
  openSignedLocalDownload: (
    fileId: string,
    query: { expiresAt: Date; signature: string },
  ) => Promise<LocalDownloadResult>;
  uploadFile: (ctx: RequestContext, input: UploadFileDto) => Promise<StoredFileResult>;
};

export type StorageServiceDeps = {
  adapter: StorageAdapter;
  repository: StorageRepository;
  signedUrlTtlSeconds: number;
};

function now(): Date {
  return new Date();
}

function isAdmin(ctx: RequestContext): boolean {
  return ctx.globalRoles.includes("platform_admin") || ctx.globalRoles.includes("support_admin");
}

function canReadVendor(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) => membership.vendorId === vendorId && membership.status === "active",
  );
}

function canManageVendor(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) =>
      membership.vendorId === vendorId &&
      membership.status === "active" &&
      (membership.role === "owner" || membership.role === "manager"),
  );
}

function fileNameFromMetadata(file: FileRow): string {
  const value = file.metadata.fileName;
  return typeof value === "string" && value.trim()
    ? value
    : (file.objectKey.split("/").at(-1) ?? file.id);
}

function purposeFromMetadata(file: FileRow): string | null {
  return typeof file.metadata.purpose === "string" ? file.metadata.purpose : null;
}

function toResult(file: FileRow): StoredFileResult {
  return {
    bucket: file.bucket,
    checksum: file.checksum,
    contentType: file.contentType,
    createdAt: file.createdAt,
    fileName: fileNameFromMetadata(file),
    id: file.id,
    metadata: file.metadata,
    objectKey: file.objectKey,
    purpose: purposeFromMetadata(file),
    sizeBytes: file.sizeBytes,
    status: file.status,
    storageProvider: file.storageProvider,
    vendorId: file.vendorId,
    visibility: file.visibility,
  };
}

function safeFileName(fileName: string): string {
  return (
    fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "upload.bin"
  );
}

function decodeBase64(value: string, expectedSizeBytes: number): Buffer {
  const body = Buffer.from(value, "base64");

  if (body.length !== expectedSizeBytes) {
    throw new ValidationError("Uploaded file size does not match the declared size.", {
      actualSizeBytes: body.length,
      expectedSizeBytes,
    });
  }

  return body;
}

function checksumFor(body: Buffer): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

function objectKeyFor(input: {
  agreementId?: string;
  fileName: string;
  purpose: FilePurpose;
  rfqId?: string;
  vendorId?: string;
}): string {
  const fileName = safeFileName(input.fileName);
  const uniqueName = `${randomUUID()}-${fileName}`;

  if (input.purpose === "rfq_attachment" && input.rfqId) {
    return `rfqs/${input.rfqId}/attachments/${uniqueName}`;
  }

  if (
    (input.purpose === "agreement_document" || input.purpose === "signed_agreement_document") &&
    input.agreementId
  ) {
    return `agreements/${input.agreementId}/${input.purpose}/${uniqueName}`;
  }

  if (input.vendorId) {
    return `vendors/${input.vendorId}/${input.purpose}/${uniqueName}`;
  }

  return `uploads/${input.purpose}/${uniqueName}`;
}

async function assertRfqAccess(
  repository: StorageRepository,
  ctx: RequestContext,
  rfqId: string,
  mode: "read" | "write",
): Promise<{ customerUserId: string; targetVendorIds: string[] }> {
  const rfq = await repository.findRfqAccessById(rfqId);

  if (!rfq) {
    throw new NotFoundError("RFQ was not found.");
  }

  const vendorAccess = rfq.targetVendorIds.some((vendorId) =>
    mode === "write" ? canManageVendor(ctx, vendorId) : canReadVendor(ctx, vendorId),
  );

  if (isAdmin(ctx) || rfq.customerUserId === ctx.userId || vendorAccess) {
    return rfq;
  }

  throw new AuthorizationError("You are not authorized to access this RFQ file.");
}

async function assertAgreementAccess(
  repository: StorageRepository,
  ctx: RequestContext,
  agreementId: string,
  mode: "read" | "write",
): Promise<{ customerUserId: string; rfqId: string; vendorId: string }> {
  const agreement = await repository.findAgreementAccessById(agreementId);

  if (!agreement) {
    throw new NotFoundError("Agreement was not found.");
  }

  const vendorAccess =
    mode === "write"
      ? canManageVendor(ctx, agreement.vendorId)
      : canReadVendor(ctx, agreement.vendorId);

  if (isAdmin(ctx) || agreement.customerUserId === ctx.userId || vendorAccess) {
    return agreement;
  }

  throw new AuthorizationError("You are not authorized to access this agreement file.");
}

async function assertUploadIntent(
  repository: StorageRepository,
  ctx: RequestContext,
  input: UploadFileDto,
): Promise<{ ownerUserId?: string; vendorId?: string }> {
  if (!ctx.userId) {
    throw new AuthorizationError("Authentication is required to upload files.");
  }

  if (input.purpose === "rfq_attachment") {
    if (!input.rfqId) throw new ValidationError("RFQ attachment uploads require an RFQ ID.");
    const rfq = await assertRfqAccess(repository, ctx, input.rfqId, "write");
    if (input.vendorId && !rfq.targetVendorIds.includes(input.vendorId)) {
      throw new ValidationError("RFQ attachment vendor ID must be targeted by the RFQ.");
    }
    return {
      ownerUserId: rfq.customerUserId === ctx.userId ? ctx.userId : undefined,
      vendorId: input.vendorId,
    };
  }

  if (input.purpose === "agreement_document" || input.purpose === "signed_agreement_document") {
    if (!input.agreementId)
      throw new ValidationError("Agreement document uploads require an agreement ID.");
    const agreement = await assertAgreementAccess(repository, ctx, input.agreementId, "write");
    return { ownerUserId: agreement.customerUserId, vendorId: agreement.vendorId };
  }

  if (!input.vendorId) {
    throw new ValidationError("Vendor uploads require a vendor ID.");
  }

  if (!isAdmin(ctx) && !canManageVendor(ctx, input.vendorId)) {
    throw new AuthorizationError("Vendor owner or manager access is required to upload this file.");
  }

  const vendor = await repository.findVendorById(input.vendorId);
  if (!vendor) throw new NotFoundError("Vendor was not found.");

  if (input.purpose === "menu_file") {
    if (!input.menuId) throw new ValidationError("Menu file uploads require a menu ID.");
    const menu = await repository.findMenuById(input.vendorId, input.menuId);
    if (!menu) throw new NotFoundError("Menu was not found.");
  }

  return { ownerUserId: ctx.userId, vendorId: input.vendorId };
}

function defaultVisibility(
  purpose: FilePurpose,
  requested?: "private" | "public",
): "private" | "public" {
  if (purpose === "vendor_image") {
    return requested ?? "public";
  }

  if (purpose === "menu_file") {
    return requested ?? "private";
  }

  return "private";
}

function metadataFor(input: {
  agreementId?: string;
  fileName: string;
  menuId?: string;
  metadata?: Record<string, unknown>;
  purpose: FilePurpose;
  rfqId?: string;
}): Record<string, unknown> {
  return {
    ...(input.metadata ?? {}),
    agreementId: input.agreementId,
    fileName: input.fileName,
    menuId: input.menuId,
    purpose: input.purpose,
    rfqId: input.rfqId,
  };
}

async function createStoredFile(
  deps: StorageServiceDeps,
  input: {
    agreementId?: string;
    body: Buffer;
    checksum?: string;
    contentType: string;
    fileName: string;
    menuId?: string;
    metadata?: Record<string, unknown>;
    ownerUserId?: string;
    purpose: FilePurpose;
    rfqId?: string;
    vendorId?: string;
    visibility?: "private" | "public";
  },
): Promise<FileRow> {
  const objectKey = objectKeyFor(input);
  await deps.adapter.putObject({
    body: input.body,
    bucket: deps.adapter.bucket,
    contentType: input.contentType,
    objectKey,
  });

  return deps.repository.createFile({
    bucket: deps.adapter.bucket,
    checksum: input.checksum ?? checksumFor(input.body),
    contentType: input.contentType,
    metadata: metadataFor(input),
    objectKey,
    ownerUserId: input.ownerUserId,
    sizeBytes: input.body.length,
    status: "ready",
    storageProvider: deps.adapter.provider,
    vendorId: input.vendorId,
    visibility: input.visibility ?? defaultVisibility(input.purpose),
  });
}

async function assertCanReadFile(
  repository: StorageRepository,
  ctx: RequestContext,
  file: FileRow,
): Promise<void> {
  if (file.status !== "ready") {
    throw new BusinessRuleError("File is not ready for download.");
  }

  if (file.visibility === "public" || isAdmin(ctx) || file.ownerUserId === ctx.userId) {
    return;
  }

  if (file.vendorId && canReadVendor(ctx, file.vendorId)) {
    return;
  }

  const rfqId = typeof file.metadata.rfqId === "string" ? file.metadata.rfqId : undefined;
  if (rfqId) {
    await assertRfqAccess(repository, ctx, rfqId, "read");
    return;
  }

  const agreementId =
    typeof file.metadata.agreementId === "string" ? file.metadata.agreementId : undefined;
  if (agreementId) {
    await assertAgreementAccess(repository, ctx, agreementId, "read");
    return;
  }

  throw new AuthorizationError("You are not authorized to access this file.");
}

function roleForAudit(ctx: RequestContext): string {
  if (ctx.globalRoles.includes("platform_admin")) return "platform_admin";
  if (ctx.globalRoles.includes("support_admin")) return "support_admin";
  if (ctx.globalRoles.includes("vendor_user")) return "vendor_user";
  if (ctx.globalRoles.includes("customer")) return "customer";
  return "user";
}

async function auditAgreementFileAccess(
  repository: StorageRepository,
  ctx: RequestContext,
  file: FileRow,
): Promise<void> {
  const agreementId =
    typeof file.metadata.agreementId === "string" ? file.metadata.agreementId : undefined;

  if (!agreementId) {
    return;
  }

  await repository.createAuditLog({
    action: "file.download_url_issued",
    actorRole: roleForAudit(ctx),
    actorUserId: ctx.userId,
    entityId: file.id,
    entityType: "file",
    newState: {
      agreementId,
      fileId: file.id,
      purpose: purposeFromMetadata(file),
    },
    previousState: null,
    requestId: ctx.requestId,
    vendorId: file.vendorId,
  });
}

export function createStorageService(deps: StorageServiceDeps): StorageService {
  return {
    async createSystemFile(input) {
      const file = await createStoredFile(deps, {
        ...input,
        checksum: checksumFor(input.body),
        visibility: input.visibility ?? "private",
      });
      return toResult(file);
    },

    async getDownloadUrl(ctx, fileId) {
      const file = await deps.repository.findFileById(fileId);
      if (!file) throw new NotFoundError("File was not found.");

      await assertCanReadFile(deps.repository, ctx, file);
      await auditAgreementFileAccess(deps.repository, ctx, file);

      const expiresAt = new Date(now().getTime() + deps.signedUrlTtlSeconds * 1000);
      const downloadUrl = await deps.adapter.createSignedDownloadUrl({
        bucket: file.bucket,
        contentType: file.contentType,
        expiresAt,
        fileId: file.id,
        objectKey: file.objectKey,
      });

      return {
        downloadUrl,
        expiresAt,
        file: toResult(file),
      };
    },

    async listVendorDocuments(ctx, vendorId) {
      if (!isAdmin(ctx) && !canReadVendor(ctx, vendorId)) {
        throw new AuthorizationError("Vendor access is required to view documents.");
      }

      const records: VendorDocumentRecord[] = await deps.repository.listVendorDocuments(vendorId);
      return records.map((record) => toResult(record.file));
    },

    async openSignedLocalDownload(fileId, query) {
      const file = await deps.repository.findFileById(fileId);
      if (!file) throw new NotFoundError("File was not found.");

      if (!deps.adapter.verifySignedDownload || !deps.adapter.getObject) {
        throw new BusinessRuleError(
          "Local signed downloads are not enabled for this storage adapter.",
        );
      }

      if (
        !deps.adapter.verifySignedDownload({
          expiresAt: query.expiresAt,
          fileId,
          signature: query.signature,
        })
      ) {
        throw new AuthorizationError("Signed file URL is invalid or expired.");
      }

      return {
        body: await deps.adapter.getObject({ bucket: file.bucket, objectKey: file.objectKey }),
        contentType: file.contentType,
        fileName: fileNameFromMetadata(file),
      };
    },

    async uploadFile(ctx, input) {
      const scope = await assertUploadIntent(deps.repository, ctx, input);
      const body = decodeBase64(input.contentBase64, input.sizeBytes);
      const file = await createStoredFile(deps, {
        agreementId: input.agreementId,
        body,
        checksum: input.checksum,
        contentType: input.contentType,
        fileName: input.fileName,
        menuId: input.menuId,
        metadata: input.metadata,
        ownerUserId: scope.ownerUserId,
        purpose: input.purpose,
        rfqId: input.rfqId,
        vendorId: scope.vendorId,
        visibility: defaultVisibility(input.purpose, input.visibility),
      });

      if (input.purpose === "agreement_document" && input.agreementId) {
        await deps.repository.attachAgreementFile(input.agreementId, file.id, "draft", now());
      }

      if (input.purpose === "signed_agreement_document" && input.agreementId) {
        await deps.repository.attachAgreementFile(input.agreementId, file.id, "signed", now());
      }

      if (
        input.purpose === "vendor_image" &&
        input.vendorId &&
        input.metadata?.imageRole === "cover"
      ) {
        await deps.repository.attachVendorProfileImage(input.vendorId, file.id, now());
      }

      return toResult(file);
    },
  };
}
