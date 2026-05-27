"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { rfqApiRequest, statusLabel } from "@/lib/rfq-api";

import { formatDate } from "../rfq-shared";

type VendorDocument = {
  contentType: string;
  createdAt: string;
  fileName: string;
  id: string;
  purpose: string | null;
  sizeBytes: number;
  status: string;
  visibility: string;
};

type DownloadResponse = {
  downloadUrl: string;
};

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VendorDocumentCenter() {
  const session = useAuthSession();
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  async function loadDocuments() {
    setError(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor to load documents.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<VendorDocument[]>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/documents`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Document center failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setDocuments(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Document load failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function openDownload(fileId: string) {
    setError(null);

    try {
      const result = await rfqApiRequest<DownloadResponse>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/files/${encodeURIComponent(fileId)}/download-url`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Download URL failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Download URL request failed.");
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/vendor/dashboard">Back to vendor dashboard</Link>
        <h1>Vendor Document Center</h1>
        <p>
          Review signed agreements, RFQ attachments, menu files, vendor documents, and private file
          downloads issued through short-lived URLs.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireVendor session={session} title="Vendor Account" />
        <button disabled={isLoading} onClick={() => void loadDocuments()} type="button">
          {isLoading ? "Loading..." : "Load documents"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {documents.length === 0 ? (
          <div style={{ border: "1px dashed #bbb", borderRadius: 16, padding: 18 }}>
            <h2>No documents loaded</h2>
            <p>Load the vendor document center to see signed agreements and uploaded documents.</p>
          </div>
        ) : null}

        {documents.map((document) => (
          <article
            key={document.id}
            style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16 }}
          >
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 4px" }}>
              {document.purpose ? statusLabel(document.purpose) : "File"} ·{" "}
              {statusLabel(document.visibility)}
            </p>
            <h2 style={{ margin: "0 0 6px" }}>{document.fileName}</h2>
            <p style={{ margin: "0 0 10px" }}>
              {document.contentType} · {sizeLabel(document.sizeBytes)} ·{" "}
              {formatDate(document.createdAt)} · {statusLabel(document.status)}
            </p>
            <button onClick={() => void openDownload(document.id)} type="button">
              Get signed download URL
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
