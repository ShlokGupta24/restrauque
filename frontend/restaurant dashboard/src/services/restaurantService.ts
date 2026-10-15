import { apiClient } from './apiClient';
import { BackendRestaurantSummary, BackendBranchSummary } from './authService';

export interface CreateInitialBranchInput {
  name: string;
  phone?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone?: string;
}

export interface CreateRestaurantInput {
  name: string;
  legalName?: string | null;
  email?: string;
  phone?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone?: string;
  initialBranch?: CreateInitialBranchInput | null;
}

export interface UpdateRestaurantInput {
  name?: string;
  legalName?: string | null;
  email?: string;
  phone?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone?: string;
  status?: 'active' | 'inactive';
}

export interface CreateBranchInput {
  name: string;
  phone?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone?: string;
}

export interface UpdateBranchInput {
  name?: string;
  phone?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone?: string;
  status?: 'active' | 'inactive';
}

export interface SafeBranchProfile {
  id: string;
  restaurantId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafeRestaurantProfile {
  id: string;
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  timezone: string;
  status: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantProfileResponse {
  restaurant: SafeRestaurantProfile | null;
  branches: SafeBranchProfile[];
}

export interface BranchListResponse {
  restaurantId: string;
  branches: SafeBranchProfile[];
}

export const restaurantService = {
  getRestaurantProfile: async (): Promise<RestaurantProfileResponse> => {
    return apiClient.get<RestaurantProfileResponse>('/api/v1/owner/restaurant');
  },

  createRestaurant: async (data: CreateRestaurantInput): Promise<{
    restaurant: BackendRestaurantSummary;
    branches: BackendBranchSummary[];
  }> => {
    return apiClient.post('/api/v1/owner/restaurants', data);
  },

  updateRestaurantProfile: async (data: UpdateRestaurantInput): Promise<{
    restaurant: BackendRestaurantSummary;
  }> => {
    return apiClient.patch('/api/v1/owner/restaurant', data);
  },

  getBranches: async (status?: string): Promise<BranchListResponse> => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<BranchListResponse>(`/api/v1/owner/branches${query}`);
  },

  createBranch: async (data: CreateBranchInput): Promise<{
    branch: SafeBranchProfile;
  }> => {
    return apiClient.post('/api/v1/owner/branches', data);
  },

  updateBranch: async (
    branchId: string,
    data: UpdateBranchInput
  ): Promise<{
    branch: SafeBranchProfile;
  }> => {
    return apiClient.patch(`/api/v1/owner/branches/${encodeURIComponent(branchId)}`, data);
  },

  verifyAccess: async (
    restaurantId: string,
    branchId?: string
  ): Promise<{
    authorized: boolean;
    restaurant: BackendRestaurantSummary;
    branch?: BackendBranchSummary;
    branches?: BackendBranchSummary[];
  }> => {
    const params = new URLSearchParams({ restaurantId });
    if (branchId) params.append('branchId', branchId);
    return apiClient.get(`/api/v1/owner/verify-access?${params.toString()}`);
  },
};
