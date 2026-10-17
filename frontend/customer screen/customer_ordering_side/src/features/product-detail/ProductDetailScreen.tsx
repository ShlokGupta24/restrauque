import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Heart, Check, Minus, Plus } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { Product } from '../../services/contracts/types';
import './ProductDetailScreen.css';

/**
 * Screen 03: Product Details & Customization (Variants/Add-ons)
 * Visual reference: UIUX/03-product-details.png
 */
export const ProductDetailScreen: React.FC = () => {
  const { activeProductId, goBack, navigateTo, addToCart } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Load product data
  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        // Default to 'prod-iced-latte' if none active for robust preview
        const idToFetch = activeProductId || 'prod-iced-latte';
        const found = await customerDataService.getProductById(idToFetch);
        if (found) {
          setProduct(found);
          const defaultVar = found.variants?.find((v) => v.isDefault) || found.variants?.[0];
          if (defaultVar) {
            setSelectedVariantId(defaultVar.id);
          }
        }
      } catch (err) {
        console.error('Failed to load product detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [activeProductId]);

  // Compute live price
  const { unitPrice, totalPrice } = useMemo(() => {
    if (!product) return { unitPrice: 0, totalPrice: 0 };

    const variantDelta =
      product.variants?.find((v) => v.id === selectedVariantId)?.priceDelta || 0;

    const addonsDelta = (product.addons || [])
      .filter((a) => selectedAddonIds.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);

    const unit = product.price + variantDelta + addonsDelta;
    return {
      unitPrice: unit,
      totalPrice: unit * quantity,
    };
  }, [product, selectedVariantId, selectedAddonIds, quantity]);

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity, selectedVariantId, selectedAddonIds);
    // Return to menu or cart
    navigateTo('menu');
  };

  if (loading) {
    return (
      <div className="product-detail-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p>Loading dish details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p>Product not found.</p>
        <button className="stepper-btn" onClick={goBack} style={{ margin: '20px auto' }}>
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      {/* Hero Media Section */}
      <section className="product-hero-media">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-hero-image"
        />
        <div className="hero-media-overlay" />

        {/* Floating Top Controls */}
        <div className="hero-floating-controls">
          <button
            className="floating-icon-btn"
            onClick={goBack}
            aria-label="Back to previous screen"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className={`floating-icon-btn favorite-btn ${isFavorited ? 'favorited' : ''}`}
            onClick={() => setIsFavorited(!isFavorited)}
            aria-label="Favorite this product"
          >
            <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        </div>
      </section>

      {/* Product Details Content */}
      <main className="product-detail-content">
        {/* Title and Price */}
        <div className="product-detail-header">
          <h1 className="product-detail-title">{product.name}</h1>
          <span className="product-detail-price">₹ {unitPrice}</span>
        </div>

        {/* Description */}
        <p className="product-detail-description">{product.description}</p>

        {/* Size / Variants Section */}
        {product.variants && product.variants.length > 0 && (
          <div className="customization-section">
            <h2 className="section-label">Size</h2>
            <div className="variant-options-group" role="radiogroup">
              {product.variants.map((v) => {
                const isActive = selectedVariantId === v.id;
                return (
                  <button
                    key={v.id}
                    role="radio"
                    aria-checked={isActive}
                    className={`variant-pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedVariantId(v.id)}
                  >
                    <span>{v.name}</span>
                    {v.priceDelta > 0 && (
                      <span className="variant-price-delta">+ ₹ {v.priceDelta}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-ons Checklist Section */}
        {product.addons && product.addons.length > 0 && (
          <div className="customization-section">
            <h2 className="section-label">Add-ons</h2>
            <div className="addons-checklist">
              {product.addons.map((addon) => {
                const isSelected = selectedAddonIds.includes(addon.id);
                return (
                  <div
                    key={addon.id}
                    className={`addon-checkbox-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleAddon(addon.id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                  >
                    <div className="addon-left">
                      <div className="addon-check-box">
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                      <span className="addon-name">{addon.name}</span>
                    </div>
                    <span className="addon-price">+ ₹ {addon.price}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity Stepper Section */}
        <div className="quantity-stepper-row">
          <span className="section-label">Quantity</span>
          <div className="stepper-pill">
            <button
              className="stepper-btn"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus size={18} />
            </button>
            <span className="stepper-count">{quantity}</span>
            <button
              className="stepper-btn"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="detail-sticky-bar">
        <button
          className="add-to-cart-submit-btn"
          onClick={handleAddToCart}
        >
          Add to Cart • ₹ {totalPrice}
        </button>
      </div>
    </div>
  );
};
