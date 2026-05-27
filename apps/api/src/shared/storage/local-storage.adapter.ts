import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  LocalDownloadInput,
  PutObjectInput,
  SignedDownloadInput,
  StorageAdapter,
} from "./storage-adapter.js";

type LocalStorageOptions = {
  apiBaseUrl: string;
  bucket: string;
  rootDir: string;
  signingSecret: string;
};

function safeSegment(value: string): string {
  return value.replace(/\\/g, "/");
}

function resolveObjectPath(rootDir: string, bucket: string, objectKey: string): string {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, bucket, safeSegment(objectKey));

  if (!target.startsWith(path.resolve(root, bucket))) {
    throw new Error("Storage object key resolved outside the storage root.");
  }

  return target;
}

function sign(secret: string, fileId: string, expiresAt: Date): string {
  return createHmac("sha256", secret)
    .update(`${fileId}.${expiresAt.toISOString()}`)
    .digest("base64url");
}

export function createLocalStorageAdapter(options: LocalStorageOptions): StorageAdapter {
  return {
    bucket: options.bucket,
    provider: "local",

    async createSignedDownloadUrl(input: SignedDownloadInput): Promise<string> {
      const url = new URL(`/api/v1/files/${input.fileId}/download`, options.apiBaseUrl);
      url.searchParams.set("expiresAt", input.expiresAt.toISOString());
      url.searchParams.set("signature", sign(options.signingSecret, input.fileId, input.expiresAt));
      return url.toString();
    },

    async getObject(input: LocalDownloadInput): Promise<Buffer> {
      return readFile(resolveObjectPath(options.rootDir, input.bucket, input.objectKey));
    },

    async putObject(input: PutObjectInput): Promise<void> {
      const filePath = resolveObjectPath(options.rootDir, input.bucket, input.objectKey);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.body);
    },

    verifySignedDownload(input): boolean {
      if (input.expiresAt.getTime() <= Date.now()) {
        return false;
      }

      const expected = Buffer.from(sign(options.signingSecret, input.fileId, input.expiresAt));
      const actual = Buffer.from(input.signature);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    },
  };
}
