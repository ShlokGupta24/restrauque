'use client';

import React from 'react';
import { THEME } from '../constants';
import { RestaurantContext, BranchContext, TableContext, Category } from '../types';

interface RestaurantWelcomeProps {
  restaurant: RestaurantContext;
  branch: BranchContext;
  table: TableContext;
  categories: Category[];
  totalProductsCount: number;
  onExploreMenu: (categoryId?: string) => void;
}

export default function RestaurantWelcome({
  restaurant,
  branch,
  table,
  categories,
  totalProductsCount,
  onExploreMenu,
}: RestaurantWelcomeProps) {
  const restaurantInitials = restaurant.name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '20px 16px 40px',
      }}
    >
      {/* Hero Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.elevated,
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        {/* Decorative Top Accent Banner */}
        <div
          style={{
            height: '140px',
            background: 'linear-gradient(135deg, #173f70 0%, #0e294b 60%, #1f4f89 100%)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Subtle culinary background pattern / glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              backgroundImage: 'radial-gradient(circle at 20% 50%, #ffffff 0%, transparent 60%)',
            }}
          />

          {/* Table Indicator Pill on Banner */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: THEME.radius.pill,
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#4ade80',
              }}
            />
            Dine-In Session
          </div>
        </div>

        {/* Content Box with overlapping Logo Badge */}
        <div
          style={{
            padding: '0 24px 28px',
            marginTop: '-44px',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          {/* Stylized Logo Badge */}
          <div
            style={{
              width: '88px',
              height: '88px',
              margin: '0 auto 16px',
              borderRadius: '24px',
              backgroundColor: '#ffffff',
              border: `3px solid ${THEME.colors.bgPage}`,
              boxShadow: '0 8px 20px rgba(23, 63, 112, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: THEME.colors.navyPrimary,
              fontWeight: 800,
              fontSize: '28px',
              letterSpacing: '-0.02em',
            }}
          >
            {restaurantInitials || 'RQ'}
          </div>

          <h2
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 6px',
              lineHeight: 1.2,
            }}
          >
            {restaurant.name}
          </h2>

          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              margin: '0 0 16px',
            }}
          >
            {branch.name} · Dine-In Experience
          </p>

          {/* Table & Capacity Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: THEME.colors.bgCardSubtle,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              padding: '10px 18px',
              borderRadius: THEME.radius.pill,
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '15px' }}>🍽️</span>
              <strong style={{ color: THEME.colors.navyPrimary, fontSize: '13px' }}>
                Table {table.tableNumber}
              </strong>
            </div>
            <span style={{ color: THEME.colors.borderStrong }}>•</span>
            <span style={{ color: THEME.colors.textMuted, fontSize: '13px' }}>
              Seats {table.capacity} Guests
            </span>
          </div>

          {/* Main View Menu Action */}
          <div>
            <button
              type="button"
              onClick={() => onExploreMenu()}
              style={{
                width: '100%',
                padding: '16px 24px',
                backgroundColor: THEME.colors.navyPrimary,
                color: '#ffffff',
                border: 'none',
                borderRadius: THEME.radius.md,
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(23, 63, 112, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = THEME.colors.navyHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = THEME.colors.navyPrimary;
              }}
            >
              <span>Explore Menu</span>
              <span style={{ fontSize: '18px' }}>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Shortcuts Section */}
      {categories.length > 0 && (
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              padding: '0 4px',
            }}
          >
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: THEME.colors.navyPrimary,
                margin: 0,
              }}
            >
              Browse Categories
            </h3>
            <span
              style={{
                fontSize: '12px',
                color: THEME.colors.textMuted,
              }}
            >
              {totalProductsCount} dishes available
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onExploreMenu(cat.id)}
                style={{
                  backgroundColor: THEME.colors.bgCard,
                  border: `1px solid ${THEME.colors.borderSubtle}`,
                  borderRadius: THEME.radius.md,
                  padding: '16px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: THEME.shadow.card,
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '80px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = THEME.colors.navyPrimary;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = THEME.colors.borderSubtle;
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: THEME.colors.navyPrimary,
                      marginBottom: '4px',
                    }}
                  >
                    {cat.name}
                  </div>
                  {cat.description && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: THEME.colors.textMuted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.description}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: THEME.colors.accentGold,
                    fontWeight: 600,
                    marginTop: '8px',
                  }}
                >
                  {cat.products.length} {cat.products.length === 1 ? 'item' : 'items'} →
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Verified QR Security Assurance */}
      <div
        style={{
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '12px',
          color: THEME.colors.textLight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        <span>🔒</span>
        <span>Secure dine-in ordering connected to Table {table.tableNumber}</span>
      </div>
    </div>
  );
}
