export type VendorApiRequest = {
  apiBaseUrl: string;
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  path: string;
  token?: string;
};

export type VendorApiResult = {
  body: unknown;
  ok: boolean;
  status: number;
};

export async function vendorApiRequest(request: VendorApiRequest): Promise<VendorApiResult> {
  const headers = new Headers({
    accept: "application/json",
  });

  if (request.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (request.token?.trim()) {
    headers.set("authorization", `Bearer ${request.token.trim()}`);
  }

  const response = await fetch(`${request.apiBaseUrl.replace(/\/$/, "")}${request.path}`, {
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    headers,
    method: request.method ?? "GET",
  });
  const text = await response.text();

  return {
    body: text ? (JSON.parse(text) as unknown) : null,
    ok: response.ok,
    status: response.status,
  };
}
