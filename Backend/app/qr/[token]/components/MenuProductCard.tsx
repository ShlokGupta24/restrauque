'use client';

import React from 'react';
import { THEME, formatCurrency } from '../constants';
import { Product } from '../types';

interface MenuProductCardProps {
  product: Product;
  quantityInCart: number;
  onOpenCustomization: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onQuickUpdateQty: (product: Product, delta: number) => void;
}

export default function MenuProductCard({
  product,
  quantityInCart,
  onOpenCustomization,
  onQuickAdd,
  onQuickUpdateQty,
}: MenuProductCardProps) {
  const hasVariants = product.variants.length > 0;
  const hasAddons = product.addons.length > 0;
  const isCustomizable = hasVariants || hasAddons;

  return (
    <article
      style={{
        backgroundColor: THEME.colors.bgCard,
        border: `1px solid ${THEME.colors.borderSubtle}`,
        borderRadius: THEME.radius.lg,
        padding: '16px',
        boxShadow: THEME.shadow.card,
        display: 'flex',
        gap: '14px',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Left Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Customization Badge */}
        {isCustomizable && (
          <div style={{ marginBottom: '4px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: THEME.colors.badgeAmber,
                backgroundColor: THEME.colors.badgeAmberBg,
                padding: '2px 8px',
                borderRadius: THEME.radius.pill,
              }}
            >
              {hasVariants ? 'Sizes & Options' : 'Customizable'}
            </span>
          </div>
        )}

        <h4
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: THEME.colors.navyPrimary,
            margin: '0 0 4px',
            lineHeight: 1.3,
          }}
        >
          {product.name}
        </h4>

        {product.description && (
          <p
            style={{
              fontSize: '12px',
              color: THEME.colors.textMuted,
              margin: '0 0 8px',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.description}
          </p>
        )}

        {/* Pricing */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
            }}
          >
            {formatCurrency(product.price)}
          </span>
          {hasVariants && (
            <span style={{ fontSize: '11px', color: THEME.colors.textLight }}>
              onwards
            </span>
          )}
        </div>
      </div>

      {/* Right: Image & Action Button */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {/* Product Image */}
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: THEME.radius.md,
            overflow: 'hidden',
            backgroundColor: THEME.colors.bgCardSubtle,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                // Graceful fallback if remote image fails
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: THEME.colors.textLight,
                fontSize: '28px',
              }}
            >
              🥗
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isCustomizable ? (
            <button
              type="button"
              onClick={() => onOpenCustomization(product)}
              style={{
                padding: '6px 14px',
                borderRadius: THEME.radius.pill,
                backgroundColor: quantityInCart > 0 ? THEME.colors.navyLight : THEME.colors.navyPrimary,
                border: quantityInCart > 0 ? `1.5px solid ${THEME.colors.navyPrimary}` : 'none',
                color: quantityInCart > 0 ? THEME.colors.navyPrimary : '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: quantityInCart > 0 ? 'none' : '0 2px 6px rgba(23, 63, 112, 0.2)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{quantityInCart > 0 ? `In Cart (${quantityInCart})` : 'Customize'}</span>
              <span style={{ fontSize: '13px' }}>+</span>
            </button>
          ) : quantityInCart > 0 ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: THEME.colors.bgCard,
                border: `1.5px solid ${THEME.colors.navyPrimary}`,
                borderRadius: THEME.radius.pill,
                overflow: 'hidden',
                boxShadow: THEME.shadow.card,
              }}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => onQuickUpdateQty(product, -1)}
                style={{
                  width: '28px',
                  height: '28px',
                  background: 'none',
                  border: 'none',
                  color: THEME.colors.navyPrimary,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                -
              </button>
              <span
                style={{
                  minWidth: '20px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                }}
              >
                {quantityInCart}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => onQuickUpdateQty(product, 1)}
                style={{
                  width: '28px',
                  height: '28px',
                  background: 'none',
                  border: 'none',
                  color: THEME.colors.navyPrimary,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onQuickAdd(product)}
              style={{
                padding: '6px 16px',
                borderRadius: THEME.radius.pill,
                backgroundColor: THEME.colors.navyPrimary,
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(23, 63, 112, 0.2)',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = THEME.colors.navyHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = THEME.colors.navyPrimary;
              }}
            >
              Add +
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
