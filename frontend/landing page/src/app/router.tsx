import { Routes, Route } from 'react-router-dom';
import LandingPage from '../pages/landing/LandingPage';
import RestaurantLoginPage from '../pages/auth/RestaurantLoginPage';
import CustomerLoginPage from '../pages/auth/CustomerLoginPage';
import GetStartedPage from '../pages/auth/GetStartedPage';
import NotFoundPage from '../pages/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login/restaurant" element={<RestaurantLoginPage />} />
      <Route path="/login/customer" element={<CustomerLoginPage />} />
      <Route path="/get-started" element={<GetStartedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
