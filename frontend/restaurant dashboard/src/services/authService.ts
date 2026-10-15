import { apiClient } from './apiClient';

export interface SafeUser {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  role: 'RESTAURANT_OWNER' | 'CUSTOMER';
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendRestaurantSummary {
  id: string;
  name: string;
  legalName?: string | null;
  status: string;
  timezone: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendBranchSummary {
  id: string;
  restaurantId: string;
  name: string;
  status: string;
  timezone: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  address?: string | null;
  city?: string | null;
}

export interface OwnerContextResponse {
  owner: SafeUser;
  restaurant: BackendRestaurantSummary | null;
  branches: BackendBranchSummary[];
}

export interface AuthSuccessResult {
  user: SafeUser;
  token?: string;
}

export const authService = {
  loginOwner: async (credentials: { email: string; password: string }): Promise<AuthSuccessResult> => {
    return apiClient.post<AuthSuccessResult>('/api/v1/auth/owner/login', credentials);
  },

  registerOwner: async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthSuccessResult> => {
    return apiClient.post<AuthSuccessResult>('/api/v1/auth/owner/register', data);
  },

  getCurrentUser: async (): Promise<{ user: SafeUser }> => {
    return apiClient.get<{ user: SafeUser }>('/api/v1/auth/me');
  },

  getOwnerContext: async (): Promise<OwnerContextResponse> => {
    return apiClient.get<OwnerContextResponse>('/api/v1/owner/context');
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout');
  },
};
