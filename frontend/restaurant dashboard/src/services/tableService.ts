import { apiClient } from './apiClient';

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

export interface TableListResponse {
  tables: SafeDiningTable[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: TableSummaryCounts;
}

export interface CreateTableInput {
  branchId: string;
  tableNumber: string;
  capacity: number;
  status?: TableOperationalStatus;
  isActive?: boolean;
  isQrActive?: boolean;
}

export interface CreateTableResponse {
  table: SafeDiningTable;
  qr: {
    id: string;
    isActive: boolean;
    rawToken: string;
    qrUrl: string;
  };
}

export interface UpdateTableInput {
  tableNumber?: string;
  capacity?: number;
  status?: TableOperationalStatus;
  isActive?: boolean;
  isQrActive?: boolean;
}

export interface SafeQrCodeMetadata {
  id: string;
  tableId: string;
  tableNumber?: string;
  branchId?: string;
  branchName?: string;
  qrType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RotateQrResponse {
  qrCodeId: string;
  tableId: string;
  isQrActive: boolean;
  rawToken: string;
  qrUrl: string;
  rotatedAt: string;
}

export interface PublicResolvedTableResponse {
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

export interface DeleteTableResult {
  deleted: boolean;
  archived: boolean;
  message: string;
  table?: SafeDiningTable;
}

export const tableService = {
  getTables: async (params?: {
    branchId?: string;
    status?: string;
    isActive?: boolean | string;
    isQrActive?: boolean | string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<TableListResponse> => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.isActive !== undefined && params.isActive !== 'all') {
      query.append('isActive', String(params.isActive));
    }
    if (params?.isQrActive !== undefined && params.isQrActive !== 'all') {
      query.append('isQrActive', String(params.isQrActive));
    }
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<TableListResponse>(`/api/v1/owner/tables${qs}`);
  },

  getTable: async (tableId: string): Promise<{ table: SafeDiningTable }> => {
    return apiClient.get<{ table: SafeDiningTable }>(
      `/api/v1/owner/tables/${encodeURIComponent(tableId)}`
    );
  },

  createTable: async (data: CreateTableInput): Promise<CreateTableResponse> => {
    return apiClient.post<CreateTableResponse>('/api/v1/owner/tables', data);
  },

  updateTable: async (
    tableId: string,
    data: UpdateTableInput
  ): Promise<{ table: SafeDiningTable }> => {
    return apiClient.patch<{ table: SafeDiningTable }>(
      `/api/v1/owner/tables/${encodeURIComponent(tableId)}`,
      data
    );
  },

  deleteTable: async (tableId: string): Promise<DeleteTableResult> => {
    return apiClient.delete<DeleteTableResult>(
      `/api/v1/owner/tables/${encodeURIComponent(tableId)}`
    );
  },

  getTableQr: async (tableId: string): Promise<{ qr: SafeQrCodeMetadata }> => {
    return apiClient.get<{ qr: SafeQrCodeMetadata }>(
      `/api/v1/owner/tables/${encodeURIComponent(tableId)}/qr`
    );
  },

  rotateTableQr: async (tableId: string): Promise<RotateQrResponse> => {
    return apiClient.post<RotateQrResponse>(
      `/api/v1/owner/tables/${encodeURIComponent(tableId)}/qr/rotate`,
      {}
    );
  },

  resolvePublicQr: async (token: string): Promise<PublicResolvedTableResponse> => {
    return apiClient.get<PublicResolvedTableResponse>(
      `/api/v1/public/qr/${encodeURIComponent(token)}`
    );
  },
};
