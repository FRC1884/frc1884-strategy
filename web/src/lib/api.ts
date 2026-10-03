export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(code);
  }
}

// True when the request never reached the server (no signal, server down).
export function isOffline(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof ApiError && error.status === 0);
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api/hub${path}`, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (response.status === 401 && path !== "/session") {
    // Signed out elsewhere (or by a manager): let the app show the sign-in page.
    window.dispatchEvent(new Event("hub-signed-out"));
  }
  if (!response.ok) {
    const code = (data as { error?: string } | null)?.error ?? `http_${response.status}`;
    throw new ApiError(response.status, code, data);
  }
  return data as T;
}
