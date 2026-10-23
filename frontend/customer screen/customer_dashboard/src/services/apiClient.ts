/**
 * Restrauque Customer Dashboard Typed HTTP Client
 * Reusable fetch wrapper for customer dashboard communicating with Next.js backend.
 *
 * Design features:
 * - Reads VITE_API_BASE_URL (defaults to relative /api proxied by Vite dev server).
 * - credentials: 'include' by default for HttpOnly session cookie ('restrauque_session').
 * - Preserves backend error envelopes and HTTP status codes.
 * - Supports AbortSignal for request cancellation.
 * - Never logs credentials, tokens, OTPs, or environment secrets.
 * - Never persists raw JWT or session tokens in localStorage or sessionStorage.
 */

export class ApiClientError extends Error {
  public status: number;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string = 'API_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: string;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: QueryParams;
  token?: string;
  body?: unknown;
}

function getDefaultStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request parameters.';
    case 401:
      return 'Authentication required. Please log in.';
    case 403:
      return 'Access denied. You do not have permission for this action.';
    case 404:
      return 'Requested resource was not found.';
    case 409:
      return 'Conflict: Operation could not be completed with current state.';
    case 422:
      return 'Validation failed for the submitted data.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server is temporarily unavailable. Please try again shortly.';
    default:
      return `Request failed with HTTP status ${status}.`;
  }
}

function getDefaultStatusCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 500:
      return 'INTERNAL_SERVER_ERROR';
    case 502:
    case 503:
    case 504:
      return 'SERVICE_UNAVAILABLE';
    default:
      return `HTTP_${status}`;
  }
}

export function buildUrl(endpoint: string, params?: QueryParams): string {
  const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
  const base = meta && meta.env && meta.env.VITE_API_BASE_URL
    ? String(meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
    : '';

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let fullUrl = `${base}${cleanEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  return fullUrl;
}

export async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, token, body, headers, ...customInit } = options;
  const url = buildUrl(endpoint, params);

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  let serializedBody: BodyInit | null | undefined = undefined;

  if (body !== undefined && body !== null) {
    if (typeof body === 'string' || body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
      serializedBody = body as BodyInit;
    } else {
      requestHeaders['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(body);
    }
  }

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token.trim()}`;
  }

  const fetchConfig: RequestInit = {
    method: 'GET',
    credentials: 'include',
    ...customInit,
    headers: {
      ...requestHeaders,
      ...(headers as Record<string, string>),
    },
    body: serializedBody,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchConfig);
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'AbortError' || options.signal?.aborted)) {
      throw new ApiClientError('Request was cancelled.', 0, 'ABORTED');
    }
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiClientError(
      `Unable to connect to the server: ${message}. Please check your connection.`,
      0,
      'NETWORK_ERROR'
    );
  }

  // Handle empty successful responses
  if (response.status === 204 || response.status === 205) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  let parsedBody: any = null;
  if (isJson) {
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }
  } else {
    try {
      parsedBody = await response.text();
    } catch {
      parsedBody = null;
    }
  }

  // Process error responses (status >= 400)
  if (!response.ok) {
    let errorCode = getDefaultStatusCode(response.status);
    let errorMessage = getDefaultStatusMessage(response.status);
    let errorDetails: unknown = undefined;

    if (parsedBody && typeof parsedBody === 'object') {
      if (parsedBody.error) {
        if (typeof parsedBody.error.message === 'string') {
          errorMessage = parsedBody.error.message;
        }
        if (typeof parsedBody.error.code === 'string') {
          errorCode = parsedBody.error.code;
        }
        if (parsedBody.error.details !== undefined) {
          errorDetails = parsedBody.error.details;
        }
      } else if (typeof parsedBody.message === 'string') {
        errorMessage = parsedBody.message;
      }
    } else if (typeof parsedBody === 'string' && parsedBody.trim().length > 0) {
      if (parsedBody.length < 200 && !parsedBody.includes('<html')) {
        errorMessage = parsedBody.trim();
      }
    }

    throw new ApiClientError(errorMessage, response.status, errorCode, errorDetails);
  }

  // Process successful responses: unwrap standard { success: true, data: T } envelope
  if (parsedBody && typeof parsedBody === 'object' && 'data' in parsedBody && parsedBody.success === true) {
    return parsedBody.data as T;
  }

  return parsedBody as T;
}

export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  request,
};
