import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { PutObjectInput, SignedDownloadInput, StorageAdapter } from "./storage-adapter.js";

type S3CompatibleStorageOptions = {
  accessKeyId: string;
  bucket: string;
  endpoint?: string;
  region: string;
  secretAccessKey: string;
};

export function createS3CompatibleStorageAdapter(
  options: S3CompatibleStorageOptions,
): StorageAdapter {
  const client = new S3Client({
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    endpoint: options.endpoint || undefined,
    forcePathStyle: Boolean(options.endpoint),
    region: options.region,
  });

  return {
    bucket: options.bucket,
    provider: "s3",

    async createSignedDownloadUrl(input: SignedDownloadInput): Promise<string> {
      const expiresIn = Math.max(1, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000));
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
          ResponseContentType: input.contentType,
        }),
        { expiresIn },
      );
    },

    async putObject(input: PutObjectInput): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: input.bucket,
          ContentType: input.contentType,
          Key: input.objectKey,
        }),
      );
    },
  };
}
