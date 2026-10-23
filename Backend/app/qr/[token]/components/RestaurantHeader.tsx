'use client';

import React from 'react';
import { THEME } from '../constants';
import { RestaurantContext, BranchContext, TableContext, DineInViewMode } from '../types';

interface RestaurantHeaderProps {
  restaurant: RestaurantContext;
  branch: BranchContext;
  table: TableContext;
  totalCartItems: number;
  currentView: DineInViewMode;
  onNavigate: (view: DineInViewMode) => void;
}

export default function RestaurantHeader({
  restaurant,
  branch,
  table,
  totalCartItems,
  currentView,
  onNavigate,
}: RestaurantHeaderProps) {
  const handleBackClick = () => {
    if (currentView === 'checkout') {
      onNavigate('cart');
    } else if (currentView === 'cart') {
      onNavigate('menu');
    } else if (currentView === 'confirmation') {
      onNavigate('menu');
    } else {
      onNavigate('welcome');
    }
  };

  const showCartButton = currentView === 'welcome' || currentView === 'menu';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'rgba(251, 249, 245, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${THEME.colors.borderSubtle}`,
        padding: '12px 16px',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentView !== 'welcome' && (
            <button
              type="button"
              aria-label="Back"
              onClick={handleBackClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: THEME.radius.full,
                border: `1px solid ${THEME.colors.borderSubtle}`,
                backgroundColor: THEME.colors.bgCard,
                color: THEME.colors.navyPrimary,
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                boxShadow: THEME.shadow.card,
              }}
            >
              ←
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: THEME.colors.navyPrimary,
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                }}
              >
                {restaurant.name}
              </h1>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: THEME.colors.textMuted,
                margin: '2px 0 0',
                lineHeight: 1.2,
              }}
            >
              {branch.name}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Verified Table Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: THEME.colors.bgCard,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              color: THEME.colors.navyPrimary,
              padding: '6px 12px',
              borderRadius: THEME.radius.pill,
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: THEME.shadow.card,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: THEME.colors.successGreen,
                display: 'inline-block',
              }}
            />
            <span>Table {table.tableNumber}</span>
          </div>

          {/* Cart Toggle Button */}
          {showCartButton && (
            <button
              type="button"
              aria-label={`Cart (${totalCartItems} items)`}
              onClick={() => onNavigate('cart')}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: THEME.radius.full,
                border:
                  totalCartItems > 0
                    ? `1.5px solid ${THEME.colors.navyPrimary}`
                    : `1px solid ${THEME.colors.borderSubtle}`,
                backgroundColor:
                  totalCartItems > 0 ? THEME.colors.navyPrimary : THEME.colors.bgCard,
                color: totalCartItems > 0 ? '#ffffff' : THEME.colors.navyPrimary,
                cursor: 'pointer',
                boxShadow: THEME.shadow.card,
                transition: 'all 0.15s ease',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {totalCartItems > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: THEME.colors.accentGold,
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #ffffff',
                  }}
                >
                  {totalCartItems}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
