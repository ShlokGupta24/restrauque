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

export interface AuthSuccessResult {
  user: SafeUser;
  token?: string;
}

export interface OtpRequestResult {
  message: string;
  phone: string;
  expiresInSeconds: number;
  simulated?: boolean;
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

  requestCustomerOtp: async (phone: string): Promise<OtpRequestResult> => {
    return apiClient.post<OtpRequestResult>('/api/v1/auth/customer/otp/request', { phone });
  },

  verifyCustomerOtp: async (data: {
    phone: string;
    otp: string;
    name?: string;
  }): Promise<AuthSuccessResult> => {
    return apiClient.post<AuthSuccessResult>('/api/v1/auth/customer/otp/verify', data);
  },

  getCurrentUser: async (): Promise<{ user: SafeUser }> => {
    return apiClient.get<{ user: SafeUser }>('/api/v1/auth/me');
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout');
  },

  logoutCustomer: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/customer/logout');
  },
};
