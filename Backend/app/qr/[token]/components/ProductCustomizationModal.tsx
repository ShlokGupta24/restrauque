'use client';

import React, { useState, useEffect } from 'react';
import { THEME, formatCurrency } from '../constants';
import { Product, ProductVariant, ProductAddon } from '../types';

interface ProductCustomizationModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmAddToCart: (customizedItem: {
    product: Product;
    selectedVariant: ProductVariant | null;
    selectedAddons: ProductAddon[];
    quantity: number;
    specialInstructions?: string;
    lineTotal: number;
  }) => void;
}

export default function ProductCustomizationModal({
  product,
  isOpen,
  onClose,
  onConfirmAddToCart,
}: ProductCustomizationModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  // Reset state whenever a new product is selected
  useEffect(() => {
    if (product) {
      if (product.variants.length > 0) {
        setSelectedVariantId(product.variants[0].id);
      } else {
        setSelectedVariantId('');
      }
      setSelectedAddonIds([]);
      setQuantity(1);
      setSpecialInstructions('');
    }
  }, [product]);

  if (!isOpen || !product) {
    return null;
  }

  const hasVariants = product.variants.length > 0;
  const selectedVariant = hasVariants
    ? product.variants.find((v) => v.id === selectedVariantId) || null
    : null;

  // Enforce required variant rule
  const isVariantSelectionValid = !hasVariants || Boolean(selectedVariant);

  const selectedAddons = product.addons.filter((a) =>
    selectedAddonIds.includes(a.id)
  );

  const effectiveBasePrice = selectedVariant
    ? selectedVariant.price
    : product.price;

  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const itemUnitPrice = effectiveBasePrice + addonsTotal;
  const lineTotal = itemUnitPrice * quantity;

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVariantSelectionValid) return;

    onConfirmAddToCart({
      product,
      selectedVariant,
      selectedAddons,
      quantity,
      specialInstructions: specialInstructions.trim() || undefined,
      lineTotal,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: THEME.colors.bgPage,
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          borderTopLeftRadius: THEME.radius.xl,
          borderTopRightRadius: THEME.radius.xl,
          boxShadow: THEME.shadow.floating,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Hero */}
        <div
          style={{
            position: 'relative',
            backgroundColor: THEME.colors.bgCard,
            borderBottom: `1px solid ${THEME.colors.borderSubtle}`,
          }}
        >
          {product.imageUrl ? (
            <div
              style={{
                width: '100%',
                height: '180px',
                backgroundColor: THEME.colors.bgCardSubtle,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <img
                src={product.imageUrl}
                alt={product.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                height: '100px',
                background: 'linear-gradient(135deg, #173f70 0%, #24599a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
              }}
            >
              🍲
            </div>
          )}

          {/* Close Button */}
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: `1px solid ${THEME.colors.borderSubtle}`,
              color: THEME.colors.navyPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: THEME.shadow.card,
            }}
          >
            ✕
          </button>

          {/* Title and Base Price Info */}
          <div style={{ padding: '16px 20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: THEME.colors.navyPrimary,
                    margin: '0 0 4px',
                  }}
                >
                  {product.name}
                </h3>
                {product.description && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: THEME.colors.textMuted,
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {product.description}
                  </p>
                )}
              </div>

              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCurrency(effectiveBasePrice)}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Customization Content */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Section: Variants / Sizes */}
          {hasVariants && (
            <div
              style={{
                backgroundColor: THEME.colors.bgCard,
                borderRadius: THEME.radius.lg,
                padding: '16px',
                border: `1px solid ${THEME.colors.borderSubtle}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: THEME.colors.navyPrimary,
                    margin: 0,
                  }}
                >
                  Choose Size / Variant
                </h4>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: THEME.colors.badgeRed,
                    backgroundColor: THEME.colors.badgeRedBg,
                    padding: '2px 8px',
                    borderRadius: THEME.radius.pill,
                  }}
                >
                  Required
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {product.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <label
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: THEME.radius.md,
                        border: isSelected
                          ? `1.5px solid ${THEME.colors.navyPrimary}`
                          : `1px solid ${THEME.colors.borderSubtle}`,
                        backgroundColor: isSelected
                          ? THEME.colors.navyLight
                          : THEME.colors.bgCardSubtle,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="radio"
                          name="product-variant"
                          value={v.id}
                          checked={isSelected}
                          onChange={() => setSelectedVariantId(v.id)}
                          style={{
                            accentColor: THEME.colors.navyPrimary,
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: isSelected ? 700 : 500,
                            color: THEME.colors.textMain,
                          }}
                        >
                          {v.name}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: THEME.colors.navyPrimary,
                        }}
                      >
                        {formatCurrency(v.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Add-ons */}
          {product.addons.length > 0 && (
            <div
              style={{
                backgroundColor: THEME.colors.bgCard,
                borderRadius: THEME.radius.lg,
                padding: '16px',
                border: `1px solid ${THEME.colors.borderSubtle}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: THEME.colors.navyPrimary,
                    margin: 0,
                  }}
                >
                  Select Add-ons
                </h4>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: THEME.colors.textMuted,
                  }}
                >
                  Optional
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {product.addons.map((a) => {
                  const isChecked = selectedAddonIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: THEME.radius.md,
                        border: isChecked
                          ? `1.5px solid ${THEME.colors.navyPrimary}`
                          : `1px solid ${THEME.colors.borderSubtle}`,
                        backgroundColor: isChecked
                          ? THEME.colors.navyLight
                          : THEME.colors.bgCardSubtle,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAddon(a.id)}
                          style={{
                            accentColor: THEME.colors.navyPrimary,
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: isChecked ? 700 : 500,
                            color: THEME.colors.textMain,
                          }}
                        >
                          {a.name}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: THEME.colors.accentGold,
                        }}
                      >
                        +{formatCurrency(a.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Special Instructions */}
          <div
            style={{
              backgroundColor: THEME.colors.bgCard,
              borderRadius: THEME.radius.lg,
              padding: '16px',
              border: `1px solid ${THEME.colors.borderSubtle}`,
            }}
          >
            <label
              htmlFor="special-instructions"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 700,
                color: THEME.colors.navyPrimary,
                marginBottom: '8px',
              }}
            >
              Special Preparation Requests
            </label>
            <textarea
              id="special-instructions"
              rows={2}
              maxLength={255}
              placeholder="e.g. Less spicy, dressing on the side, extra crispy..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: THEME.radius.md,
                border: `1px solid ${THEME.colors.borderSubtle}`,
                backgroundColor: THEME.colors.bgCardSubtle,
                color: THEME.colors.textMain,
                fontSize: '13px',
                boxSizing: 'border-box',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Footer Bar: Quantity & Add to Cart */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: THEME.colors.bgCard,
            borderTop: `1px solid ${THEME.colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          {/* Quantity Stepper */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: THEME.colors.bgCardSubtle,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              borderRadius: THEME.radius.md,
              height: '46px',
            }}
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={{
                width: '38px',
                height: '100%',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                fontWeight: 700,
                color: quantity <= 1 ? THEME.colors.textLight : THEME.colors.navyPrimary,
                cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              -
            </button>
            <span
              style={{
                minWidth: '28px',
                textAlign: 'center',
                fontSize: '15px',
                fontWeight: 700,
                color: THEME.colors.navyPrimary,
              }}
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= 99}
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              style={{
                width: '38px',
                height: '100%',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                fontWeight: 700,
                color: THEME.colors.navyPrimary,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={!isVariantSelectionValid}
            onClick={handleSubmit}
            style={{
              flex: 1,
              height: '46px',
              padding: '0 20px',
              backgroundColor: isVariantSelectionValid
                ? THEME.colors.navyPrimary
                : THEME.colors.textLight,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '15px',
              fontWeight: 700,
              cursor: isVariantSelectionValid ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: isVariantSelectionValid
                ? '0 4px 12px rgba(23, 63, 112, 0.25)'
                : 'none',
              transition: 'background-color 0.15s ease',
            }}
          >
            <span>Add to Cart</span>
            <span>{formatCurrency(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
