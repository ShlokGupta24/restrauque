/**
 * Restrauque QR Context and Venue Resolution Service
 * Resolves physical dining table QR token via Next.js backend endpoint:
 * GET /api/v1/public/qr/[token]
 */
import { apiClient, ApiClientError } from './apiClient.ts';
import type { RestaurantPublicInfo } from './contracts/types';

export type TableOperationalStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface PublicResolvedTableData {
  resolved: boolean;
  table: {
    id: string;
    tableNumber: string;
    capacity: number;
    status: TableOperationalStatus;
  };
  branch: {
    id: string;
    name: string;
    timezone: string;
  };
  restaurant: {
    id: string;
    name: string;
  };
}

/**
 * Validates whether the incoming token matches backend requirements:
 * URL-safe base64 / alphanumeric characters between 20 and 128 characters.
 */
export const QR_TOKEN_REGEX = /^[A-Za-z0-9_-]{20,128}$/;

export function isValidQrTokenFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  return QR_TOKEN_REGEX.test(token.trim());
}

/**
 * Normalizes backend PublicResolvedTable payload into the frontend RestaurantPublicInfo model.
 */
export function normalizeQrContext(data: PublicResolvedTableData): RestaurantPublicInfo {
  if (!data || !data.restaurant || !data.table || !data.branch) {
    throw new ApiClientError('Invalid QR resolution payload from server.', 500, 'MALFORMED_RESPONSE');
  }

  return {
    id: data.restaurant.id,
    name: data.restaurant.name,
    branchName: data.branch.name,
    tableLabel: `Table ${data.table.tableNumber}`,
    tableId: data.table.id,
    tableNumber: data.table.tableNumber,
    tableStatus: data.table.status,
    tableCapacity: data.table.capacity,
    branchId: data.branch.id,
    timezone: data.branch.timezone,
  };
}

/**
 * Resolves the physical QR token into restaurant and table context.
 * Performs fast-fail checks for missing or malformed tokens before calling the network.
 */
export async function resolveQrContext(
  qrToken: string | null | undefined,
  signal?: AbortSignal
): Promise<RestaurantPublicInfo> {
  const trimmed = qrToken ? qrToken.trim() : '';

  if (!trimmed) {
    throw new ApiClientError(
      'No table QR code detected. Please scan the QR code located on your dining table to get started.',
      400,
      'MISSING_QR_TOKEN'
    );
  }

  if (!isValidQrTokenFormat(trimmed)) {
    throw new ApiClientError(
      'QR code is invalid, expired, or inactive.',
      404,
      'INVALID_QR_FORMAT'
    );
  }

  try {
    const encodedToken = encodeURIComponent(trimmed);
    const data = await apiClient.get<PublicResolvedTableData>(
      `/api/v1/public/qr/${encodedToken}`,
      { signal }
    );
    return normalizeQrContext(data);
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiClientError(
      `Unable to connect to the restaurant service: ${message}. Please check your connection and scan again.`,
      0,
      'NETWORK_ERROR'
    );
  }
}
