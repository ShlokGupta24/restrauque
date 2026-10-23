'use client';

import React from 'react';
import { THEME } from '../constants';

interface MenuSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount?: number;
}

export default function MenuSearch({
  searchQuery,
  onSearchChange,
  resultCount,
}: MenuSearchProps) {
  return (
    <div
      style={{
        position: 'relative',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '16px',
            color: THEME.colors.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search dishes, drinks, desserts..."
          style={{
            width: '100%',
            height: '48px',
            padding: '0 44px 0 46px',
            backgroundColor: THEME.colors.bgCard,
            border: `1.5px solid ${searchQuery ? THEME.colors.navyPrimary : THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            fontSize: '14px',
            color: THEME.colors.textMain,
            boxShadow: THEME.shadow.card,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = THEME.colors.navyPrimary;
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(23, 63, 112, 0.1)';
          }}
          onBlur={(e) => {
            if (!searchQuery) {
              e.currentTarget.style.borderColor = THEME.colors.borderSubtle;
              e.currentTarget.style.boxShadow = THEME.shadow.card;
            }
          }}
        />

        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '12px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: THEME.colors.bgCardSubtle,
              border: 'none',
              color: THEME.colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {searchQuery && typeof resultCount === 'number' && (
        <div
          style={{
            marginTop: '8px',
            padding: '0 4px',
            fontSize: '12px',
            color: THEME.colors.textMuted,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            {resultCount} {resultCount === 1 ? 'dish' : 'dishes'} found for &quot;{searchQuery}&quot;
          </span>
          <button
            type="button"
            onClick={() => onSearchChange('')}
            style={{
              background: 'none',
              border: 'none',
              color: THEME.colors.navyPrimary,
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Clear Filter
          </button>
        </div>
      )}
    </div>
  );
}
