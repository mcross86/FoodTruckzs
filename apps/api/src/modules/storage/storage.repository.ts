import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  agreements,
  auditLogs,
  files,
  rfqs,
  rfqVendorTargets,
  vendorMenus,
  vendorProfiles,
  vendors,
} from "../../db/schema/index.js";

type StorageDb = Database | Transaction;

export type FileRow = typeof files.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type RfqAccessRecord = {
  customerUserId: string;
  rfqId: string;
  targetVendorIds: string[];
};
export type AgreementAccessRecord = {
  agreementId: string;
  customerUserId: string;
  rfqId: string;
  vendorId: string;
};
export type VendorDocumentRecord = {
  file: FileRow;
};

export type StorageRepository = {
  attachAgreementFile: (
    agreementId: string,
    fileId: string,
    kind: "draft" | "signed",
    updatedAt: Date,
  ) => Promise<void>;
  attachVendorProfileImage: (vendorId: string, fileId: string, updatedAt: Date) => Promise<void>;
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createFile: (input: typeof files.$inferInsert) => Promise<FileRow>;
  findAgreementAccessById: (agreementId: string) => Promise<AgreementAccessRecord | null>;
  findFileById: (fileId: string) => Promise<FileRow | null>;
  findMenuById: (
    vendorId: string,
    menuId: string,
  ) => Promise<{ id: string; vendorId: string } | null>;
  findRfqAccessById: (rfqId: string) => Promise<RfqAccessRecord | null>;
  findVendorById: (vendorId: string) => Promise<{ id: string } | null>;
  listVendorDocuments: (vendorId: string) => Promise<VendorDocumentRecord[]>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzleStorageRepository implements StorageRepository {
  constructor(private readonly db: StorageDb) {}

  async createFile(input: typeof files.$inferInsert): Promise<FileRow> {
    const [file] = await this.db.insert(files).values(input).returning();
    return requireReturnedRow(file);
  }

  async findFileById(fileId: string): Promise<FileRow | null> {
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
      .limit(1);
    return file ?? null;
  }

  async findVendorById(vendorId: string): Promise<{ id: string } | null> {
    const [vendor] = await this.db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .limit(1);
    return vendor ?? null;
  }

  async findMenuById(
    vendorId: string,
    menuId: string,
  ): Promise<{ id: string; vendorId: string } | null> {
    const [menu] = await this.db
      .select({ id: vendorMenus.id, vendorId: vendorMenus.vendorId })
      .from(vendorMenus)
      .where(
        and(
          eq(vendorMenus.id, menuId),
          eq(vendorMenus.vendorId, vendorId),
          isNull(vendorMenus.deletedAt),
        ),
      )
      .limit(1);
    return menu ?? null;
  }

  async findRfqAccessById(rfqId: string): Promise<RfqAccessRecord | null> {
    const [rfq] = await this.db
      .select({ customerUserId: rfqs.customerUserId, id: rfqs.id })
      .from(rfqs)
      .where(and(eq(rfqs.id, rfqId), isNull(rfqs.deletedAt)))
      .limit(1);

    if (!rfq) {
      return null;
    }

    const targets = await this.db
      .select({ vendorId: rfqVendorTargets.vendorId })
      .from(rfqVendorTargets)
      .where(eq(rfqVendorTargets.rfqId, rfqId));

    return {
      customerUserId: rfq.customerUserId,
      rfqId: rfq.id,
      targetVendorIds: targets.map((target) => target.vendorId),
    };
  }

  async findAgreementAccessById(agreementId: string): Promise<AgreementAccessRecord | null> {
    const [agreement] = await this.db
      .select({
        agreementId: agreements.id,
        customerUserId: agreements.customerUserId,
        rfqId: agreements.rfqId,
        vendorId: agreements.vendorId,
      })
      .from(agreements)
      .where(and(eq(agreements.id, agreementId), isNull(agreements.deletedAt)))
      .limit(1);
    return agreement ?? null;
  }

  async attachAgreementFile(
    agreementId: string,
    fileId: string,
    kind: "draft" | "signed",
    updatedAt: Date,
  ): Promise<void> {
    await this.db
      .update(agreements)
      .set(
        kind === "signed"
          ? { signedDocumentFileId: fileId, updatedAt }
          : { documentFileId: fileId, updatedAt },
      )
      .where(eq(agreements.id, agreementId));
  }

  async attachVendorProfileImage(vendorId: string, fileId: string, updatedAt: Date): Promise<void> {
    await this.db
      .update(vendorProfiles)
      .set({ coverImageFileId: fileId, updatedAt })
      .where(eq(vendorProfiles.vendorId, vendorId));
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async listVendorDocuments(vendorId: string): Promise<VendorDocumentRecord[]> {
    const rows = await this.db
      .select()
      .from(files)
      .where(and(eq(files.vendorId, vendorId), isNull(files.deletedAt)))
      .orderBy(desc(files.createdAt));
    return rows.map((file) => ({ file }));
  }
}

export function createUnavailableStorageRepository(): StorageRepository {
  const unavailable = async () => {
    throw new Error("Storage repository is unavailable because no database client was provided.");
  };

  return {
    attachAgreementFile: unavailable,
    attachVendorProfileImage: unavailable,
    createAuditLog: unavailable,
    createFile: unavailable,
    findAgreementAccessById: unavailable,
    findFileById: unavailable,
    findMenuById: unavailable,
    findRfqAccessById: unavailable,
    findVendorById: unavailable,
    listVendorDocuments: unavailable,
  };
}
