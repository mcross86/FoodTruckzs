import { randomUUID } from "node:crypto";

import type { auditLogs, files } from "../../db/schema/index.js";
import type {
  AgreementAccessRecord,
  AuditLogRow,
  FileRow,
  RfqAccessRecord,
  StorageRepository,
  VendorDocumentRecord,
} from "../../modules/storage/storage.repository.js";
import type { InMemoryAgreementRepository } from "./in-memory-agreement-repository.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

function now(): Date {
  return new Date();
}

export class InMemoryStorageRepository implements StorageRepository {
  readonly auditLogs = new Map<string, AuditLogRow>();
  readonly files = new Map<string, FileRow>();

  constructor(
    private readonly agreementRepository: InMemoryAgreementRepository,
    private readonly rfqRepository: InMemoryRfqRepository,
    private readonly vendorRepository: InMemoryVendorRepository,
  ) {}

  async createFile(input: typeof files.$inferInsert): Promise<FileRow> {
    const createdAt = now();
    const file: FileRow = {
      bucket: input.bucket,
      checksum: input.checksum ?? null,
      contentType: input.contentType,
      createdAt,
      deletedAt: null,
      id: randomUUID(),
      metadata: input.metadata ?? {},
      objectKey: input.objectKey,
      ownerUserId: input.ownerUserId ?? null,
      sizeBytes: input.sizeBytes,
      status: input.status ?? "pending",
      storageProvider: input.storageProvider,
      updatedAt: createdAt,
      vendorId: input.vendorId ?? null,
      visibility: input.visibility ?? "private",
    };
    this.files.set(file.id, file);
    return file;
  }

  async findFileById(fileId: string): Promise<FileRow | null> {
    const file = this.files.get(fileId);
    return file && file.deletedAt === null ? file : null;
  }

  async findVendorById(vendorId: string): Promise<{ id: string } | null> {
    const vendor = this.vendorRepository.vendors.get(vendorId);
    return vendor && vendor.deletedAt === null ? { id: vendor.id } : null;
  }

  async findMenuById(
    vendorId: string,
    menuId: string,
  ): Promise<{ id: string; vendorId: string } | null> {
    const menu = this.vendorRepository.menus.get(menuId);
    return menu && menu.vendorId === vendorId && menu.deletedAt === null
      ? { id: menu.id, vendorId: menu.vendorId }
      : null;
  }

  async findRfqAccessById(rfqId: string): Promise<RfqAccessRecord | null> {
    const rfq = this.rfqRepository.rfqs.get(rfqId);

    if (!rfq || rfq.deletedAt !== null) {
      return null;
    }

    return {
      customerUserId: rfq.customerUserId,
      rfqId: rfq.id,
      targetVendorIds: [...this.rfqRepository.targets.values()]
        .filter((target) => target.rfqId === rfq.id)
        .map((target) => target.vendorId),
    };
  }

  async findAgreementAccessById(agreementId: string): Promise<AgreementAccessRecord | null> {
    const agreement = this.agreementRepository.agreements.get(agreementId);

    if (!agreement || agreement.deletedAt !== null) {
      return null;
    }

    return {
      agreementId: agreement.id,
      customerUserId: agreement.customerUserId,
      rfqId: agreement.rfqId,
      vendorId: agreement.vendorId,
    };
  }

  async attachAgreementFile(
    agreementId: string,
    fileId: string,
    kind: "draft" | "signed",
    updatedAt: Date,
  ): Promise<void> {
    const agreement = this.agreementRepository.agreements.get(agreementId);
    if (!agreement) return;
    this.agreementRepository.agreements.set(agreementId, {
      ...agreement,
      ...(kind === "signed" ? { signedDocumentFileId: fileId } : { documentFileId: fileId }),
      updatedAt,
    });
  }

  async attachVendorProfileImage(vendorId: string, fileId: string, updatedAt: Date): Promise<void> {
    const profile = this.vendorRepository.profiles.get(vendorId);
    if (!profile) return;
    this.vendorRepository.profiles.set(vendorId, {
      ...profile,
      coverImageFileId: fileId,
      updatedAt,
    });
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const auditLog: AuditLogRow = {
      action: input.action,
      actorRole: input.actorRole ?? null,
      actorUserId: input.actorUserId ?? null,
      createdAt: now(),
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      id: randomUUID(),
      ipAddress: input.ipAddress ?? null,
      newState: input.newState ?? null,
      previousState: input.previousState ?? null,
      requestId: input.requestId ?? null,
      userAgent: input.userAgent ?? null,
      vendorId: input.vendorId ?? null,
    };
    this.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  async listVendorDocuments(vendorId: string): Promise<VendorDocumentRecord[]> {
    return [...this.files.values()]
      .filter((file) => file.vendorId === vendorId && file.deletedAt === null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((file) => ({ file }));
  }
}
