export type TableOperationalStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface SafeDiningTable {
  id: string;
  branchId: string;
  branchName?: string;
  tableNumber: string;
  capacity: number;
  status: TableOperationalStatus;
  isActive: boolean;
  isQrActive: boolean;
  qrCodeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TableSummaryCounts {
  totalTables: number;
  activeTables: number;
  inactiveTables: number;
  availableTables: number;
  occupiedTables: number;
  reservedTables: number;
  maintenanceTables: number;
  qrActiveTables: number;
}

export interface SafeQrCodeMetadata {
  id: string;
  tableId: string;
  tableNumber?: string;
  branchId?: string;
  branchName?: string;
  qrType: string;
  isActive: boolean;
  qrUrl?: string;
  qrImage?: string;
  qrSvg?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicResolvedTable {
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
