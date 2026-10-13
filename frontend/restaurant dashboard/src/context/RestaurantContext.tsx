import React, { createContext, useContext, useState } from 'react';
import { Restaurant, Branch } from '../types/domain';

interface RestaurantContextValue {
  restaurant: Restaurant;
  activeBranch: Branch;
  availableBranches: Branch[];
  setActiveBranch: (branch: Branch) => void;
  formatCurrency: (amount: number) => string;
  updateRestaurant: (updated: Partial<Restaurant>) => void;
}

const defaultRestaurant: Restaurant = {
  id: 'rest_bb_01',
  name: 'Basil & Brick',
  slug: 'bb-hazratganj',
  ownerName: 'Aarav Kapoor',
  ownerEmail: 'owner@basilbrick.example',
  defaultBranchId: 'branch_hz_01',
  currency: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
};

const defaultBranches: Branch[] = [
  {
    id: 'branch_hz_01',
    restaurantId: 'rest_bb_01',
    name: 'Hazratganj branch',
    city: 'Lucknow',
    area: 'Hazratganj',
    isDefault: true,
  },
  {
    id: 'branch_gm_02',
    restaurantId: 'rest_bb_01',
    name: 'Gomti Nagar branch',
    city: 'Lucknow',
    area: 'Gomti Nagar',
    isDefault: false,
  },
];

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [restaurant, setRestaurant] = useState<Restaurant>(defaultRestaurant);
  const [activeBranch, setActiveBranch] = useState<Branch>(defaultBranches[0]);
  const [availableBranches] = useState<Branch[]>(defaultBranches);

  const updateRestaurant = (updated: Partial<Restaurant>) => {
    setRestaurant((prev) => ({ ...prev, ...updated }));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(restaurant.locale, {
      style: 'currency',
      currency: restaurant.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        activeBranch,
        availableBranches,
        setActiveBranch,
        formatCurrency,
        updateRestaurant,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = (): RestaurantContextValue => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};
