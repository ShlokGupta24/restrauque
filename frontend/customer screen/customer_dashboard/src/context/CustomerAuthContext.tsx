import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CustomerProfile } from '../services/types';
import {
  SafeUser,
  restoreCustomerSession,
  requestCustomerOtp,
  verifyCustomerOtp,
  logoutCustomer,
  CustomerOtpRequestResponse,
} from '../services/authService';
import { ApiClientError } from '../services/apiClient';

export type CustomerAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface CustomerAuthContextType {
  status: CustomerAuthStatus;
  isAuthenticated: boolean;
  phone: string;
  profile: CustomerProfile;
  customer: SafeUser | null;
  error: string | null;
  requestOtp: (phone: string, signal?: AbortSignal) => Promise<CustomerOtpRequestResponse>;
  verifyOtp: (phone: string, otp: string, name?: string, signal?: AbortSignal) => Promise<SafeUser>;
  login: (inputPhone: string, user?: SafeUser) => void;
  logout: (signal?: AbortSignal) => Promise<void>;
  updateProfile: (updates: Partial<CustomerProfile>) => void;
  dataVersion: number;
  refreshData: () => void;
}

const EMPTY_PROFILE: CustomerProfile = {
  id: '',
  name: 'Customer',
  phone: '',
  email: '',
  memberSince: '',
  preferences: {
    dietaryPreference: 'all',
    spiceLevel: 'medium',
    emailReceipts: false,
    smsAlerts: false,
    promotionalOffers: false,
  },
};

export function mapUserToProfile(user: SafeUser): CustomerProfile {
  const rawPhone = user.phone || '';
  const cleanPhone = rawPhone.replace(/^\+91/, '').replace(/\D/g, '');
  return {
    id: user.id,
    name: user.name || 'Customer',
    phone: cleanPhone || rawPhone,
    email: user.email || '',
    memberSince: user.createdAt ? new Date(user.createdAt).getFullYear().toString() : '2024',
    preferences: {
      dietaryPreference: 'all',
      spiceLevel: 'medium',
      emailReceipts: true,
      smsAlerts: true,
      promotionalOffers: true,
    },
  };
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<CustomerAuthStatus>('loading');
  const [phone, setPhone] = useState<string>('');
  const [customer, setCustomer] = useState<SafeUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(1);

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  // Session restoration on application startup via GET /api/v1/auth/me
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const user = await restoreCustomerSession(controller.signal);
        if (!isMounted) return;

        if (user) {
          setCustomer(user);
          setProfile(mapUserToProfile(user));
          setPhone((user.phone || '').replace(/^\+91/, ''));
          setStatus('authenticated');
          setError(null);
        } else {
          // Unauthenticated (e.g. 401 or null user)
          setCustomer(null);
          setProfile(EMPTY_PROFILE);
          setPhone('');
          setStatus('unauthenticated');
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiClientError && err.code === 'ABORTED') {
          return;
        }
        setCustomer(null);
        setProfile(EMPTY_PROFILE);
        setPhone('');
        setStatus('unauthenticated');
        setError(err instanceof Error ? err.message : 'Session restoration error.');
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const requestOtp = useCallback(
    async (inputPhone: string, signal?: AbortSignal): Promise<CustomerOtpRequestResponse> => {
      setError(null);
      return await requestCustomerOtp(inputPhone, signal);
    },
    []
  );

  const verifyOtp = useCallback(
    async (
      inputPhone: string,
      otp: string,
      name?: string,
      signal?: AbortSignal
    ): Promise<SafeUser> => {
      setError(null);
      const res = await verifyCustomerOtp(inputPhone, otp, name, signal);
      if (!res || !res.user) {
        throw new ApiClientError(
          'Customer verification succeeded but user data was missing.',
          500,
          'MALFORMED_RESPONSE'
        );
      }

      setCustomer(res.user);
      setProfile(mapUserToProfile(res.user));
      setPhone((res.user.phone || inputPhone).replace(/^\+91/, ''));
      setStatus('authenticated');
      refreshData();
      return res.user;
    },
    [refreshData]
  );

  const login = useCallback(
    (inputPhone: string, user?: SafeUser) => {
      if (user) {
        setCustomer(user);
        setProfile(mapUserToProfile(user));
        setPhone((user.phone || inputPhone).replace(/^\+91/, ''));
      } else {
        setPhone(inputPhone);
      }
      setStatus('authenticated');
      refreshData();
    },
    [refreshData]
  );

  const logout = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      await logoutCustomer(signal);
      setCustomer(null);
      setProfile(EMPTY_PROFILE);
      setPhone('');
      setStatus('unauthenticated');
      setError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to revoke session on server.';
      setError(msg);
      throw err;
    }
  }, []);

  const updateProfile = useCallback((updates: Partial<CustomerProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...updates,
      preferences: {
        ...prev.preferences,
        ...(updates.preferences || {}),
      },
    }));
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        status,
        isAuthenticated: status === 'authenticated',
        phone,
        profile,
        customer,
        error,
        requestOtp,
        verifyOtp,
        login,
        logout,
        updateProfile,
        dataVersion,
        refreshData,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = (): CustomerAuthContextType => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};
