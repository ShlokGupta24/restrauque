import React, { ReactNode } from 'react';
import { CustomerHamburgerNav } from '../features/navigation/CustomerHamburgerNav';
import './CustomerLayout.css';

interface CustomerLayoutProps {
  children: ReactNode;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  return (
    <div className="customer-shell">
      <CustomerHamburgerNav />
      <main className="customer-main-content">
        {children}
      </main>
    </div>
  );
};
