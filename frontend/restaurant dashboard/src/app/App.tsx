import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { RestaurantProvider } from '../context/RestaurantContext';
import { EntitlementProvider } from '../context/EntitlementContext';
import { router } from './router';

export const App: React.FC = () => {
  return (
    <RestaurantProvider>
      <EntitlementProvider>
        <RouterProvider router={router} />
      </EntitlementProvider>
    </RestaurantProvider>
  );
};
