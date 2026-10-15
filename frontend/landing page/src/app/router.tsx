import { Routes, Route } from 'react-router-dom';
import LandingPage from '../pages/landing/LandingPage';
import RestaurantLoginPage from '../pages/auth/RestaurantLoginPage';
import CustomerLoginPage from '../pages/auth/CustomerLoginPage';
import GetStartedPage from '../pages/auth/GetStartedPage';
import NotFoundPage from '../pages/NotFoundPage';

// AppRouter defines all the URL routes for the frontend.
// It maps specific URL paths to the corresponding page components.
export function AppRouter() {
  return (
    <Routes>
      {/* Primary public landing page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Authentication routes for different user types */}
      <Route path="/login/restaurant" element={<RestaurantLoginPage />} />
      <Route path="/login/customer" element={<CustomerLoginPage />} />
      
      {/* Onboarding selection page */}
      <Route path="/get-started" element={<GetStartedPage />} />
      
      {/* Catch-all route for URLs that don't match anything above */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
