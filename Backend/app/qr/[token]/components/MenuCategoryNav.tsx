'use client';

import React from 'react';
import { THEME } from '../constants';
import { Category } from '../types';

interface MenuCategoryNavProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  totalProductsCount: number;
}

export default function MenuCategoryNav({
  categories,
  activeCategoryId,
  onSelectCategory,
  totalProductsCount,
}: MenuCategoryNavProps) {
  return (
    <nav
      style={{
        position: 'sticky',
        top: '64px',
        zIndex: 35,
        backgroundColor: 'rgba(251, 249, 245, 0.95)',
        backdropFilter: 'blur(8px)',
        padding: '8px 0 12px',
        borderBottom: `1px solid ${THEME.colors.borderSubtle}`,
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '0 4px',
        }}
      >
        {/* All Items Pill */}
        <button
          type="button"
          onClick={() => onSelectCategory('')}
          style={{
            padding: '8px 16px',
            borderRadius: THEME.radius.pill,
            fontSize: '13px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            border: !activeCategoryId
              ? `1.5px solid ${THEME.colors.navyPrimary}`
              : `1px solid ${THEME.colors.borderSubtle}`,
            backgroundColor: !activeCategoryId
              ? THEME.colors.navyPrimary
              : THEME.colors.bgCard,
            color: !activeCategoryId ? '#ffffff' : THEME.colors.textMain,
            cursor: 'pointer',
            boxShadow: !activeCategoryId
              ? '0 2px 8px rgba(23, 63, 112, 0.2)'
              : THEME.shadow.card,
            transition: 'all 0.15s ease',
          }}
        >
          All ({totalProductsCount})
        </button>

        {/* Specific Category Pills */}
        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              style={{
                padding: '8px 16px',
                borderRadius: THEME.radius.pill,
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                whiteSpace: 'nowrap',
                border: isActive
                  ? `1.5px solid ${THEME.colors.navyPrimary}`
                  : `1px solid ${THEME.colors.borderSubtle}`,
                backgroundColor: isActive
                  ? THEME.colors.navyPrimary
                  : THEME.colors.bgCard,
                color: isActive ? '#ffffff' : THEME.colors.textMain,
                cursor: 'pointer',
                boxShadow: isActive
                  ? '0 2px 8px rgba(23, 63, 112, 0.2)'
                  : THEME.shadow.card,
                transition: 'all 0.15s ease',
              }}
            >
              {cat.name} ({cat.products.length})
            </button>
          );
        })}
      </div>
    </nav>
  );
}
