/**
 * Restrauque Customer Authoritative Order Preview Service
 * Communicates with Next.js backend endpoint:
 * POST /api/v1/customer/orders/preview
 */
import { apiClient, ApiClientError } from './apiClient.ts';
import { isValidQrTokenFormat } from './qrService.ts';
import type { CartItem } from './contracts/types.ts';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

// ----------------------------------------------------------------------------
// Backend Request & Response Contracts matching POST /api/v1/customer/orders/preview
// ----------------------------------------------------------------------------

export interface OrderPreviewItemInput {
  productId: string;
  variantId?: string | null;
  addonIds?: string[];
  quantity: number;
  specialInstructions?: string | null;
}

export interface OrderPreviewRequest {
  qrToken: string;
  tableId?: string | null;
  items: OrderPreviewItemInput[];
  couponCode?: string | null;
  notes?: string | null;
}

export interface BackendOrderPreviewAddon {
  productAddonId: string;
  addonName: string;
  unitPrice: number;
  unitPriceFormatted: string;
  totalPrice: number;
  totalPriceFormatted: string;
  quantity: number;
}

export interface BackendOrderPreviewItem {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  unitPriceFormatted: string;
  quantity: number;
  totalPrice: number;
  totalPriceFormatted: string;
  specialInstructions: string | null;
  addons: BackendOrderPreviewAddon[];
}

export interface BackendOrderPreviewPricing {
  subtotal: number;
  subtotalFormatted: string;
  discountAmount: number;
  discountAmountFormatted: string;
  taxAmount: number;
  taxAmountFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
  currency: string;
}

export interface BackendOrderPreviewCoupon {
  code: string;
  discountType: string;
}

export interface BackendOrderPreviewData {
  isValid: boolean;
  table: {
    id: string;
    tableNumber: string;
  };
  items: BackendOrderPreviewItem[];
  pricing: BackendOrderPreviewPricing;
  coupon: BackendOrderPreviewCoupon | null;
}

export interface AuthoritativeQuote {
  isValid: boolean;
  table: {
    id: string;
    tableNumber: string;
  };
  items: BackendOrderPreviewItem[];
  subtotal: number;
  subtotalFormatted: string;
  discountAmount: number;
  discountAmountFormatted: string;
  taxAmount: number;
  taxAmountFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
  currency: string;
  coupon: BackendOrderPreviewCoupon | null;
  quotedAt: Date;
}

/**
 * Maps cart state into the exact payload expected by the backend orderItemInputSchema.
 * Strictly validates identifiers and constraints without silently dropping variants or add-ons.
 */
export function mapCartToPreviewItems(cart: CartItem[]): OrderPreviewItemInput[] {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new ApiClientError(
      'Cart must contain at least one item to request a preview.',
      400,
      'EMPTY_CART'
    );
  }

  return cart.map((item) => {
    // 1. Validate Product ID
    if (!item.productId || typeof item.productId !== 'string' || !isValidUuid(item.productId)) {
      throw new ApiClientError(
        `Cannot preview order: Item "${item.productName || 'Unknown'}" has an invalid product identifier "${item.productId}". Products must come from the active restaurant menu.`,
        400,
        'INVALID_PRODUCT_ID'
      );
    }

    // 2. Validate Variant ID
    let variantId: string | null = null;
    if (item.variant && item.variant.id) {
      if (!isValidUuid(item.variant.id)) {
        throw new ApiClientError(
          `Cannot preview order: Item "${item.productName || 'Unknown'}" has an invalid variant identifier "${item.variant.id}". Variants must come from the active restaurant menu.`,
          400,
          'INVALID_VARIANT_ID'
        );
      }
      variantId = item.variant.id;
    }

    // 3. Validate Addons
    const addonIds: string[] = [];
    if (Array.isArray(item.addons)) {
      if (item.addons.length > 10) {
        throw new ApiClientError(
          `Cannot preview order: Item "${item.productName || 'Unknown'}" exceeds the maximum of 10 add-ons.`,
          400,
          'EXCEEDS_MAX_ADDONS'
        );
      }
      for (const addon of item.addons) {
        if (!addon.id || !isValidUuid(addon.id)) {
          throw new ApiClientError(
            `Cannot preview order: Item "${item.productName || 'Unknown'}" has an invalid add-on identifier "${addon.id}". Add-ons must come from the active restaurant menu.`,
            400,
            'INVALID_ADDON_ID'
          );
        }
        addonIds.push(addon.id);
      }
    }

    // 4. Validate Quantity
    if (
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new ApiClientError(
        `Cannot preview order: Quantity for "${item.productName || 'Unknown'}" must be an integer between 1 and 99.`,
        400,
        'INVALID_QUANTITY'
      );
    }

    // 5. Validate Special Instructions
    let specialInstructions: string | null = null;
    if (item.specialInstructions && item.specialInstructions.trim()) {
      const trimmed = item.specialInstructions.trim();
      if (trimmed.length > 255) {
        throw new ApiClientError(
          `Cannot preview order: Special instructions for "${item.productName || 'Unknown'}" cannot exceed 255 characters.`,
          400,
          'SPECIAL_INSTRUCTIONS_TOO_LONG'
        );
      }
      specialInstructions = trimmed;
    }

    return {
      productId: item.productId,
      variantId,
      addonIds,
      quantity: item.quantity,
      specialInstructions,
    };
  });
}

/**
 * Normalizes backend order preview data into AuthoritativeQuote domain model.
 */
export function normalizeOrderPreview(data: BackendOrderPreviewData): AuthoritativeQuote {
  if (!data || !data.pricing || !Array.isArray(data.items)) {
    throw new ApiClientError(
      'Malformed order preview response received from server.',
      500,
      'INVALID_PREVIEW_PAYLOAD'
    );
  }

  return {
    isValid: data.isValid ?? true,
    table: {
      id: data.table?.id || '',
      tableNumber: data.table?.tableNumber || '',
    },
    items: data.items,
    subtotal: Number(data.pricing.subtotal) || 0,
    subtotalFormatted: data.pricing.subtotalFormatted || (data.pricing.subtotal?.toFixed(2) ?? '0.00'),
    discountAmount: Number(data.pricing.discountAmount) || 0,
    discountAmountFormatted: data.pricing.discountAmountFormatted || (data.pricing.discountAmount?.toFixed(2) ?? '0.00'),
    taxAmount: Number(data.pricing.taxAmount) || 0,
    taxAmountFormatted: data.pricing.taxAmountFormatted || (data.pricing.taxAmount?.toFixed(2) ?? '0.00'),
    totalAmount: Number(data.pricing.totalAmount) || 0,
    totalAmountFormatted: data.pricing.totalAmountFormatted || (data.pricing.totalAmount?.toFixed(2) ?? '0.00'),
    currency: data.pricing.currency || 'INR',
    coupon: data.coupon || null,
    quotedAt: new Date(),
  };
}

/**
 * Requests authoritative order preview and price calculation from the backend.
 * Uses Prisma Decimal calculation server-side; client pricing is ignored.
 */
export async function fetchOrderPreview(
  request: OrderPreviewRequest,
  signal?: AbortSignal
): Promise<AuthoritativeQuote> {
  const trimmedToken = request.qrToken ? request.qrToken.trim() : '';
  if (!trimmedToken) {
    throw new ApiClientError(
      'QR token is required to preview an order.',
      400,
      'MISSING_QR_TOKEN'
    );
  }

  if (!isValidQrTokenFormat(trimmedToken)) {
    throw new ApiClientError(
      'Invalid QR token format.',
      400,
      'INVALID_QR_TOKEN'
    );
  }

  if (!request.items || request.items.length === 0) {
    throw new ApiClientError(
      'Cart must contain at least one item to request a preview.',
      400,
      'EMPTY_CART'
    );
  }

  if (request.items.length > 50) {
    throw new ApiClientError(
      'Order cannot exceed 50 items.',
      400,
      'EXCEEDS_MAX_ITEMS'
    );
  }

  // Verify all items match backend constraints
  for (const it of request.items) {
    if (!it.productId || !isValidUuid(it.productId)) {
      throw new ApiClientError(
        `Cannot preview order: Item ID "${it.productId}" is not a valid catalog identifier. Please select items from the live restaurant menu.`,
        400,
        'INVALID_PRODUCT_ID'
      );
    }
    if (it.variantId && !isValidUuid(it.variantId)) {
      throw new ApiClientError(
        `Cannot preview order: Variant ID "${it.variantId}" is not a valid identifier.`,
        400,
        'INVALID_VARIANT_ID'
      );
    }
    if (it.addonIds && Array.isArray(it.addonIds)) {
      if (it.addonIds.length > 10) {
        throw new ApiClientError('Cannot select more than 10 add-ons per item.', 400, 'EXCEEDS_MAX_ADDONS');
      }
      for (const addonId of it.addonIds) {
        if (!isValidUuid(addonId)) {
          throw new ApiClientError(
            `Cannot preview order: Add-on ID "${addonId}" is not a valid identifier.`,
            400,
            'INVALID_ADDON_ID'
          );
        }
      }
    }
    if (typeof it.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99) {
      throw new ApiClientError('Item quantity must be an integer between 1 and 99.', 400, 'INVALID_QUANTITY');
    }
    if (it.specialInstructions && it.specialInstructions.length > 255) {
      throw new ApiClientError('Special instructions cannot exceed 255 characters.', 400, 'SPECIAL_INSTRUCTIONS_TOO_LONG');
    }
  }

  // Construct strict request body matching backend orderPreviewSchema.strict()
  const payload: Record<string, unknown> = {
    qrToken: trimmedToken,
    items: request.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || null,
      addonIds: it.addonIds || [],
      quantity: it.quantity,
      specialInstructions: it.specialInstructions || null,
    })),
  };

  if (request.tableId) {
    const trimmedTableId = request.tableId.trim();
    if (!isValidUuid(trimmedTableId)) {
      throw new ApiClientError(
        `Cannot preview order: Table ID "${request.tableId}" is not a valid UUID identifier.`,
        400,
        'INVALID_TABLE_ID'
      );
    }
    payload.tableId = trimmedTableId;
  }

  if (request.couponCode && request.couponCode.trim()) {
    const trimmedCoupon = request.couponCode.trim();
    if (trimmedCoupon.length > 50) {
      throw new ApiClientError('Coupon code cannot exceed 50 characters.', 400, 'INVALID_COUPON_CODE');
    }
    payload.couponCode = trimmedCoupon;
  }

  if (request.notes && request.notes.trim()) {
    const trimmedNotes = request.notes.trim();
    if (trimmedNotes.length > 500) {
      throw new ApiClientError('Notes cannot exceed 500 characters.', 400, 'NOTES_TOO_LONG');
    }
    payload.notes = trimmedNotes;
  }

  const responseData = await apiClient.post<BackendOrderPreviewData>(
    '/api/v1/customer/orders/preview',
    payload,
    { signal }
  );

  return normalizeOrderPreview(responseData);
}

