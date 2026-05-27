export type StorageProvider = "local" | "s3";

export type PutObjectInput = {
  body: Buffer;
  bucket: string;
  contentType: string;
  objectKey: string;
};

export type SignedDownloadInput = {
  bucket: string;
  contentType: string;
  expiresAt: Date;
  fileId: string;
  objectKey: string;
};

export type LocalDownloadInput = {
  bucket: string;
  objectKey: string;
};

export type StorageAdapter = {
  bucket: string;
  provider: StorageProvider;
  createSignedDownloadUrl: (input: SignedDownloadInput) => Promise<string>;
  getObject?: (input: LocalDownloadInput) => Promise<Buffer>;
  putObject: (input: PutObjectInput) => Promise<void>;
  verifySignedDownload?: (input: { expiresAt: Date; fileId: string; signature: string }) => boolean;
};
