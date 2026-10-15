import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Restaurant, Branch } from '../types/domain';
import { useAuth } from './AuthContext';
import { authService } from '../services/authService';

interface RestaurantContextValue {
  restaurant: Restaurant | null;
  activeBranch: Branch | null;
  availableBranches: Branch[];
  hasRestaurant: boolean;
  isLoadingContext: boolean;
  contextError: string | null;
  setActiveBranch: (branch: Branch) => void;
  formatCurrency: (amount: number) => string;
  updateRestaurant: (updated: Partial<Restaurant>) => void;
  reloadContext: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [hasRestaurant, setHasRestaurant] = useState<boolean>(false);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const loadBackendContext = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setHasRestaurant(false);
      setRestaurant(null);
      setActiveBranch(null);
      setAvailableBranches([]);
      setContextError(null);
      return;
    }

    // Role check: Only RESTAURANT_OWNER may load owner restaurant context
    if (user.role !== 'RESTAURANT_OWNER') {
      setHasRestaurant(false);
      setRestaurant(null);
      setActiveBranch(null);
      setAvailableBranches([]);
      setContextError('Unauthorized: Only restaurant owners may access this context');
      return;
    }

    setIsLoadingContext(true);
    setContextError(null);

    try {
      const context = await authService.getOwnerContext();

      if (context.restaurant) {
        const loadedRestaurant: Restaurant = {
          id: context.restaurant.id,
          name: context.restaurant.name,
          slug: context.restaurant.name.toLowerCase().replace(/\s+/g, '-'),
          ownerName: user.name,
          ownerEmail: user.email || '',
          defaultBranchId: context.branches[0]?.id || '',
          currency: 'INR',
          currencySymbol: '₹',
          locale: 'en-IN',
        };

        const mappedBranches: Branch[] = context.branches.map((b, idx) => {
          const city = b.city?.trim() || '';
          const area = b.address?.trim() || b.name;

          return {
            id: b.id,
            restaurantId: b.restaurantId,
            name: b.name,
            city,
            area,
            isDefault: idx === 0,
          };
        });

        setRestaurant(loadedRestaurant);
        setAvailableBranches(mappedBranches);
        setHasRestaurant(true);

        if (mappedBranches.length > 0) {
          setActiveBranch((prev) => {
            const exists = mappedBranches.find((mb) => mb.id === prev?.id);
            return exists || mappedBranches[0];
          });
        } else {
          setActiveBranch(null);
        }
      } else {
        // Authenticated owner with no restaurant yet (requires onboarding)
        setRestaurant(null);
        setActiveBranch(null);
        setAvailableBranches([]);
        setHasRestaurant(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load restaurant context';
      setContextError(message);
      setRestaurant(null);
      setActiveBranch(null);
      setAvailableBranches([]);
      setHasRestaurant(false);
    } finally {
      setIsLoadingContext(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated) {
      loadBackendContext();
    } else {
      setHasRestaurant(false);
      setRestaurant(null);
      setActiveBranch(null);
      setAvailableBranches([]);
      setContextError(null);
    }
  }, [isAuthenticated, loadBackendContext]);

  const updateRestaurant = (updated: Partial<Restaurant>) => {
    setRestaurant((prev) => (prev ? { ...prev, ...updated } : null));
  };

  const formatCurrency = (amount: number): string => {
    const locale = restaurant?.locale || 'en-IN';
    const currency = restaurant?.currency || 'INR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        activeBranch,
        availableBranches,
        hasRestaurant,
        isLoadingContext,
        contextError,
        setActiveBranch,
        formatCurrency,
        updateRestaurant,
        reloadContext: loadBackendContext,
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
