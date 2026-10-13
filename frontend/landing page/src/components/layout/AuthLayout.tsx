import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow: string;
  children: React.ReactNode;
  showNewToLink?: boolean;
}

// A reusable layout wrapper for all authentication-related pages (login, get started, etc.).
// By keeping the structure and styling here, we ensure all auth pages look consistent
// without duplicating the background, logo, and "back to website" HTML on every single page.
export function AuthLayout({ title, subtitle, eyebrow, children, showNewToLink = true }: AuthLayoutProps) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <Link className="brand" to="/">Restrauque<span>.</span></Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        
        {children}

        {showNewToLink && (
          <Link className="text-button" to="/get-started">New to Restrauque? Get started</Link>
        )}
        <Link className="auth-back" to="/">← Back to website</Link>
      </section>
    </main>
  );
}
