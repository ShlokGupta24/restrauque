import {
  SafeDiningTable,
  SafeQrCodeMetadata,
  PublicResolvedTable,
  TableOperationalStatus,
} from '@/types/tables';

export function formatDiningTable(
  t: any,
  branchName?: string,
  activeQr?: any
): SafeDiningTable {
  // If activeQr is passed or attached in t.qr_codes
  const qrRecord = activeQr ?? (Array.isArray(t.qr_codes) ? t.qr_codes.find((q: any) => q.is_active) : undefined);

  return {
    id: t.id,
    branchId: t.branch_id,
    ...(branchName || t.branches?.name ? { branchName: branchName || t.branches.name } : {}),
    tableNumber: t.table_number,
    capacity: t.capacity,
    status: t.status as TableOperationalStatus,
    isActive: t.is_active,
    isQrActive: qrRecord ? qrRecord.is_active : false,
    ...(qrRecord ? { qrCodeId: qrRecord.id } : {}),
    createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : t.created_at,
    updatedAt: t.updated_at instanceof Date ? t.updated_at.toISOString() : t.updated_at,
  };
}

export function formatQrMetadata(
  qr: any,
  table?: any,
  branch?: any
): SafeQrCodeMetadata {
  return {
    id: qr.id,
    tableId: qr.table_id,
    ...(table?.table_number ? { tableNumber: table.table_number } : {}),
    ...(branch?.id ? { branchId: branch.id } : {}),
    ...(branch?.name ? { branchName: branch.name } : {}),
    qrType: qr.qr_type,
    isActive: qr.is_active,
    createdAt: qr.created_at instanceof Date ? qr.created_at.toISOString() : qr.created_at,
    updatedAt: qr.updated_at instanceof Date ? qr.updated_at.toISOString() : qr.updated_at,
  };
}

export function formatPublicResolvedTable(
  t: any,
  b: any,
  r: any
): PublicResolvedTable {
  return {
    resolved: true,
    table: {
      id: t.id,
      tableNumber: t.table_number,
      capacity: t.capacity,
      status: t.status as TableOperationalStatus,
    },
    branch: {
      id: b.id,
      name: b.name,
      timezone: b.timezone,
    },
    restaurant: {
      id: r.id,
      name: r.name,
    },
  };
}
