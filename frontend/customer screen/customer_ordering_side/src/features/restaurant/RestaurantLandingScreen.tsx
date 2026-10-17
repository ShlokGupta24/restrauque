import React, { useState, useEffect } from 'react';
import { Menu, ArrowRight, ShoppingBag, UtensilsCrossed, Bell, ShieldCheck } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { Category } from '../../services/contracts/types';
import { RestrauqueLogo } from '../../components/RestrauqueLogo';
import './RestaurantLandingScreen.css';

interface RestaurantLandingScreenProps {
  onOpenNav?: () => void;
}

/**
 * Screen 01: Restaurant Landing / QR Entry
 * Visual reference: UIUX/01-restaurant-landing.png & Approved Upgrade Brief
 * Displays resolved venue info, table number, 3-line hamburger, hero CTA, and feature badges.
 */
export const RestaurantLandingScreen: React.FC<RestaurantLandingScreenProps> = ({ onOpenNav }) => {
  const { restaurant, navigateTo, setSelectedCategory, cart, bill, openNav } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const list = await customerDataService.getCategories();
        // Exclude the synthetic 'cat-all' for the circular landing shortcuts
        setCategories(list.filter((c) => c.id !== 'cat-all'));
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    navigateTo('menu');
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="landing-page">
      {/* Top Navigation Header */}
      <header className="landing-header">
        <div className="restaurant-info-group">
          {/* Logo or monogram badge */}
          {restaurant?.logoUrl ? (
            <img src={restaurant.logoUrl} alt={restaurant.name} className="restaurant-custom-logo" />
          ) : (
            <RestrauqueLogo size="sm" showText={false} />
          )}

          <div className="restaurant-meta">
            <h1 className="restaurant-name">
              {restaurant?.name || 'Restrauque'}
            </h1>
            <span className="table-label-text">
              {restaurant?.tableLabel || 'Table F18'}
            </span>
          </div>
        </div>

        {/* 3-horizontal-line hamburger menu icon on authenticated customer screens */}
        <button
          className="header-action-btn hamburger-btn"
          aria-label="Navigation menu"
          onClick={() => {
            if (onOpenNav) {
              onOpenNav();
            } else {
              openNav();
            }
          }}
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
      </header>

      {/* Hero Showcase Section */}
      <section className="landing-hero-section" aria-label="Restaurant Welcome">
        <div className="hero-text-block">
          <h2 className="hero-main-title">
            <span className="hero-highlight">Good Food</span>
            <span className="hero-title-break">Brings People Together</span>
          </h2>
          <p className="hero-tagline">Fresh flavours. Happier moments.</p>
        </div>

        {/* Hero Food Platter Presentation */}
        <div className="hero-visual-card">
          <img
            src={restaurant?.heroImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
            alt="Freshly prepared chef specialties"
            className="hero-food-img"
            loading="eager"
          />
        </div>

        {/* Primary Call to Action */}
        <button
          className="hero-view-menu-btn"
          onClick={() => {
            setSelectedCategory('cat-all');
            navigateTo('menu');
          }}
        >
          <span>View Menu</span>
          <ArrowRight size={18} />
        </button>
      </section>

      {/* Feature Badges Row matching reference layout */}
      <section className="landing-features-row" aria-label="Dining Experience Highlights">
        <div className="feature-badge-card">
          <div className="feature-icon-bubble">
            <UtensilsCrossed size={18} className="feature-icon" />
          </div>
          <strong className="feature-title">Dine-in</strong>
          <span className="feature-desc">at your table</span>
        </div>

        <div className="feature-badge-card">
          <div className="feature-icon-bubble">
            <Bell size={18} className="feature-icon" />
          </div>
          <strong className="feature-title">Real-time</strong>
          <span className="feature-desc">order updates</span>
        </div>

        <div className="feature-badge-card">
          <div className="feature-icon-bubble">
            <ShieldCheck size={18} className="feature-icon" />
          </div>
          <strong className="feature-title">Secure</strong>
          <span className="feature-desc">payments</span>
        </div>
      </section>

      {/* Categories Preview Section */}
      <section className="landing-categories-section" aria-label="Browse Menu Categories">
        <div className="categories-header-row">
          <h3 className="categories-section-title">Explore Categories</h3>
          <button
            className="see-all-btn"
            onClick={() => {
              setSelectedCategory('cat-all');
              navigateTo('menu');
            }}
          >
            All Items
          </button>
        </div>

        {loading ? (
          <div className="categories-loading-state">
            <p>Loading categories...</p>
          </div>
        ) : (
          <div className="categories-circles-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className="category-circle-item"
                onClick={() => handleCategoryClick(cat.id)}
                aria-label={`View ${cat.name}`}
              >
                <div className="category-image-circle">
                  <img
                    src={cat.iconUrl || 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=200&q=80'}
                    alt={cat.name}
                    loading="lazy"
                  />
                </div>
                <span className="category-name-label">{cat.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Sticky Floating Cart Bar if active items exist */}
      {totalCartCount > 0 && (
        <div
          className="cart-floating-bar"
          onClick={() => navigateTo('cart')}
          role="button"
          tabIndex={0}
          aria-label={`View cart with ${totalCartCount} items`}
        >
          <div className="cart-bar-left">
            <div className="cart-badge-icon">
              <ShoppingBag size={18} />
            </div>
            <span className="cart-count-text">
              {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="cart-bar-right">
            <span className="cart-total-amount">₹ {bill.totalAmount}</span>
            <ArrowRight size={16} />
          </div>
        </div>
      )}
    </div>
  );
};
