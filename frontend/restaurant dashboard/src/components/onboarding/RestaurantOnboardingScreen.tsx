import React, { useState } from 'react';
import { Store, MapPin, ArrowRight, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRestaurant } from '../../context/RestaurantContext';
import { restaurantService } from '../../services/restaurantService';
import { ApiClientError } from '../../services/apiClient';

export const RestaurantOnboardingScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { reloadContext } = useRestaurant();

  const [restaurantName, setRestaurantName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState('Lucknow');
  const [address, setAddress] = useState('');
  const [branchName, setBranchName] = useState('Main Branch');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!restaurantName.trim()) {
      setError('Restaurant name is required');
      return;
    }

    if (!branchName.trim()) {
      setError('Initial branch name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await restaurantService.createRestaurant({
        name: restaurantName.trim(),
        legalName: legalName.trim() ? legalName.trim() : undefined,
        phone: phone.trim() ? phone.trim() : undefined,
        email: user?.email || undefined,
        city: city.trim() ? city.trim() : undefined,
        address: address.trim() ? address.trim() : undefined,
        country: 'India',
        timezone: 'Asia/Kolkata',
        initialBranch: {
          name: branchName.trim(),
          phone: phone.trim() ? phone.trim() : undefined,
          city: city.trim() ? city.trim() : undefined,
          address: address.trim() ? address.trim() : undefined,
          country: 'India',
          timezone: 'Asia/Kolkata',
        },
      });

      // Reload real context from backend
      await reloadContext();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.details && Array.isArray(err.details)) {
          const formatted = (err.details as Array<{ field: string; message: string }>)
            .map((d) => d.message)
            .join('. ');
          setError(formatted || err.message);
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create restaurant. Please check the inputs and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#101112',
        backgroundImage: 'radial-gradient(ellipse at 70% 15%, rgba(229, 57, 53, 0.12), transparent 45%)',
        padding: '24px',
        fontFamily: 'var(--font-family, sans-serif)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#191a1c',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
          color: '#ffffff',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--brand-red, #e53935)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '14px',
                }}
              >
                R
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                restrauque<span style={{ color: 'var(--brand-red, #e53935)' }}>.</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                background: 'none',
                border: 'none',
                color: '#a5a6aa',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>

          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: 'var(--brand-red, #e53935)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            RESTAURANT ONBOARDING
          </span>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Set up your restaurant
          </h1>
          <p style={{ fontSize: '13px', color: '#a5a6aa', margin: 0, lineHeight: 1.6 }}>
            Welcome, <strong>{user?.name || 'Owner'}</strong>! Complete this one-time setup to register your restaurant and initial branch.
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(229, 57, 53, 0.12)',
              border: '1px solid rgba(229, 57, 53, 0.35)',
              color: '#ff6c64',
              fontSize: '12px',
              lineHeight: 1.5,
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="onboard-name" style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}>
              Restaurant name *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="onboard-name"
                type="text"
                required
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="e.g. Basil & Brick"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '9px',
                  border: '1px solid #3b3d40',
                  backgroundColor: '#111213',
                  color: '#ffffff',
                  padding: '0 14px 0 38px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Store size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#71717a' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="onboard-legal-name" style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}>
                Legal entity name
              </label>
              <input
                id="onboard-legal-name"
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Basil & Brick Pvt Ltd"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '9px',
                  border: '1px solid #3b3d40',
                  backgroundColor: '#111213',
                  color: '#ffffff',
                  padding: '0 14px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label htmlFor="onboard-phone" style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}>
                Contact phone
              </label>
              <input
                id="onboard-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '9px',
                  border: '1px solid #3b3d40',
                  backgroundColor: '#111213',
                  color: '#ffffff',
                  padding: '0 14px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="onboard-branch-name" style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}>
                Initial branch name *
              </label>
              <input
                id="onboard-branch-name"
                type="text"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Hazratganj Branch"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '9px',
                  border: '1px solid #3b3d40',
                  backgroundColor: '#111213',
                  color: '#ffffff',
                  padding: '0 14px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label htmlFor="onboard-city" style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}>
                City
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="onboard-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lucknow"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '9px',
                    border: '1px solid #3b3d40',
                    backgroundColor: '#111213',
                    color: '#ffffff',
                    padding: '0 14px 0 34px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <MapPin size={15} style={{ position: 'absolute', left: '10px', top: '15px', color: '#71717a' }} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="onboard-address" style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}>
              Address (optional)
            </label>
            <input
              id="onboard-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. M.G. Marg, Hazratganj"
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '9px',
                border: '1px solid #3b3d40',
                backgroundColor: '#111213',
                color: '#ffffff',
                padding: '0 14px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: '46px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--brand-red, #e53935)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '10px',
              boxShadow: '0 4px 14px rgba(229, 57, 53, 0.35)',
            }}
          >
            {isSubmitting ? (
              'Creating restaurant...'
            ) : (
              <>
                Complete Setup & Open Dashboard <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
