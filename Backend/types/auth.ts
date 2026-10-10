export const AUTH_ROLES = {
  CUSTOMER: 'CUSTOMER',
  RESTAURANT_OWNER: 'RESTAURANT_OWNER',
} as const;

export type AuthRole = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

// Allowlist for registration
export const ALLOWED_REGISTRATION_ROLES: readonly AuthRole[] = [
  AUTH_ROLES.CUSTOMER,
  AUTH_ROLES.RESTAURANT_OWNER,
] as const;

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: AuthRole;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPayload {
  userId: string;
  sessionId: string;
  email: string;
  role: AuthRole;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
