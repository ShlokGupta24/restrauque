export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EncodedCursorPayload {
  id: string;
  orderedAt: string;
}

/**
 * Encodes an order's tie-breaker pagination anchor into an opaque base64url string.
 */
export function encodeOrderCursor(id: string, orderedAt: Date | string): string {
  const isoDate = orderedAt instanceof Date ? orderedAt.toISOString() : new Date(orderedAt).toISOString();
  const payload: EncodedCursorPayload = { id, orderedAt: isoDate };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decodes a cursor string, accepting either an opaque base64url JSON cursor or a direct UUID.
 * Returns the target order ID if valid, or null if the cursor is malformed.
 */
export function decodeOrderCursor(cursorStr: string): string | null {
  if (!cursorStr || typeof cursorStr !== 'string') {
    return null;
  }

  const trimmed = cursorStr.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Direct UUID
  if (UUID_REGEX.test(trimmed)) {
    return trimmed;
  }

  // 2. Base64url JSON
  try {
    const jsonStr = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.id === 'string' && UUID_REGEX.test(parsed.id.trim())) {
      return parsed.id.trim();
    }
  } catch {
    // Ignore and return null
  }

  return null;
}
