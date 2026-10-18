import React, { createContext, useContext, useState } from 'react';
import { CustomerProfile } from '../services/types';
import { customerDashboardService } from '../services/CustomerDashboardService';

interface CustomerAuthContextType {
  isAuthenticated: boolean;
  phone: string;
  profile: CustomerProfile;
  login: (phone: string) => void;
  logout: () => void;
  updateProfile: (updates: Partial<CustomerProfile>) => void;
  dataVersion: number;
  refreshData: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Default logged in for demo; togglable
  const [phone, setPhone] = useState<string>('9876543210');
  const [profile, setProfile] = useState<CustomerProfile>(customerDashboardService.getProfile());
  const [dataVersion, setDataVersion] = useState<number>(1);

  const refreshData = () => {
    setDataVersion((v) => v + 1);
    setProfile(customerDashboardService.getProfile());
  };

  const login = (inputPhone: string) => {
    setPhone(inputPhone);
    setIsAuthenticated(true);
    refreshData();
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const updateProfile = (updates: Partial<CustomerProfile>) => {
    const updated = customerDashboardService.updateProfile(updates);
    setProfile(updated);
    refreshData();
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        isAuthenticated,
        phone,
        profile,
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
