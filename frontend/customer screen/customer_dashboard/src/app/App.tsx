import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { AppRouter } from './router';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <CustomerAuthProvider>
          <AppRouter />
        </CustomerAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
