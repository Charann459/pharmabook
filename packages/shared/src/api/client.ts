/**
 * Base API client — used by both web (Next.js) and mobile (React Native).
 * Reads API_URL from environment. No framework dependencies.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

// Resolved at runtime so both web and mobile can set it differently
let _baseUrl = '';
let _getToken: (() => string | null) | null = null;

export const configureClient = (baseUrl: string, getToken?: () => string | null) => {
  _baseUrl = baseUrl.replace(/\/$/, '');
  if (getToken) _getToken = getToken;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = 'GET', body, token } = options;

  const resolvedToken = token ?? _getToken?.();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (resolvedToken) {
    headers['Authorization'] = `Bearer ${resolvedToken}`;
  }

  const res = await fetch(`${_baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data as Record<string, string>)?.error ?? `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
};
