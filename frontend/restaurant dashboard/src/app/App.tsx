import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { RestaurantProvider } from '../context/RestaurantContext';
import { EntitlementProvider } from '../context/EntitlementContext';
import { router } from './router';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RestaurantProvider>
        <EntitlementProvider>
          <RouterProvider router={router} />
        </EntitlementProvider>
      </RestaurantProvider>
    </AuthProvider>
  );
};
