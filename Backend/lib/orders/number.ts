import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { ConflictError } from '@/lib/http/errors';

const SUFFIX_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Formats date as YYYYMMDD in UTC or provided date.
 */
function formatDateCompact(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Generates an alphanumeric candidate order number in format ORD-YYYYMMDD-XXXX.
 */
export function generateOrderNumberCandidate(date: Date = new Date()): string {
  const dateStr = formatDateCompact(date);
  const randomBytes = crypto.randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += SUFFIX_CHARS[randomBytes[i] % SUFFIX_CHARS.length];
  }
  return `ORD-${dateStr}-${suffix}`;
}

/**
 * Generates a guaranteed unique order number for the specified branch,
 * verifying against the database with bounded collision retries.
 */
export async function generateUniqueOrderNumber(
  branchId: string,
  tx: Prisma.TransactionClient,
  maxRetries = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateOrderNumberCandidate();

    const existing = await tx.orders.findUnique({
      where: {
        branch_id_order_number: {
          branch_id: branchId,
          order_number: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new ConflictError('Order number collision limit reached. Please retry submission.');
}
