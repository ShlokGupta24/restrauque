import { type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';

// The standard email/password login screen designed for restaurant owners and staff.
// Currently serves as a frontend prototype UI, so it intercepts the submit event 
// to prevent an actual page reload and shows an alert instead.
export default function RestaurantLoginPage() {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    // Prevent the default browser form submission
    event.preventDefault();
    window.alert('Authentication is not connected yet. This is a frontend prototype.');
  };

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to manage your restaurant operations and intelligence."
      eyebrow="RESTAURANT ACCESS"
    >
      <form onSubmit={submit}>
        <label htmlFor="email">Email or phone</label>
        <input id="email" autoComplete="username" placeholder="you@restaurant.com" required/>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="Enter password" required/>
        <button className="button button-red" type="submit">Sign in <ArrowRight size={16}/></button>
        <p className="auth-note">Frontend prototype only. Real authentication is not connected.</p>
      </form>
    </AuthLayout>
  );
}
