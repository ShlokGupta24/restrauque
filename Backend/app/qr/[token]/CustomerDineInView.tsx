'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { THEME, formatCurrency, generateCartItemId } from './constants';
import {
  Category,
  Product,
  ProductVariant,
  ProductAddon,
  CartItem,
  RestaurantContext,
  BranchContext,
  TableContext,
  DineInViewMode,
  CustomerUser,
  ConfirmedOrder,
} from './types';
import RestaurantHeader from './components/RestaurantHeader';
import RestaurantWelcome from './components/RestaurantWelcome';
import MenuCategoryNav from './components/MenuCategoryNav';
import MenuSearch from './components/MenuSearch';
import MenuProductCard from './components/MenuProductCard';
import ProductCustomizationModal from './components/ProductCustomizationModal';
import CartSummaryView from './components/CartSummaryView';
import CheckoutView from './components/CheckoutView';
import OrderConfirmationView from './components/OrderConfirmationView';
import FeedbackView from './components/FeedbackView';
import CustomerAuthModal from './components/CustomerAuthModal';

export interface DineInViewProps {
  token: string;
  restaurant: RestaurantContext;
  branch: BranchContext;
  table: TableContext;
  categories: Category[];
  initialOrderId?: string;
  initialView?: DineInViewMode;
}

export default function CustomerDineInView({
  token,
  restaurant,
  branch,
  table,
  categories,
  initialOrderId,
  initialView,
}: DineInViewProps) {
  // Navigation View State
  const [currentView, setCurrentView] = useState<DineInViewMode>(
    initialView || (initialOrderId ? 'feedback' : 'welcome')
  );
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(initialOrderId || null);

  // Customer Auth State
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Search & Category Filtering
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State (Preserved between all views)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Item Customization Modal State
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

  // Placed / Confirmed Order State
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  // Verify initial auth status on mount via GET /api/v1/auth/me
  useEffect(() => {
    let isCancelled = false;

    async function checkAuthSession() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data?.user && json.data.user.role === 'CUSTOMER') {
            setCurrentUser({
              id: json.data.user.id,
              name: json.data.user.name,
              phone: json.data.user.phone,
              role: json.data.user.role,
            });
          }
        }
      } catch {
        // Unauthenticated session - perfectly normal for public QR browsing
      }
    }

    checkAuthSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Derived metrics
  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart]
  );

  const totalProductsCount = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.products.length, 0),
    [categories]
  );

  // Filter products by active category and search query
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .filter((cat) => {
        if (!activeCategoryId) return true;
        return cat.id === activeCategoryId;
      })
      .map((cat) => {
        const filteredProducts = cat.products.filter((p) => {
          if (!query) return true;
          const nameMatch = p.name.toLowerCase().includes(query);
          const descMatch = p.description?.toLowerCase().includes(query) ?? false;
          return nameMatch || descMatch;
        });

        return {
          ...cat,
          products: filteredProducts,
        };
      })
      .filter((cat) => cat.products.length > 0);
  }, [categories, activeCategoryId, searchQuery]);

  const totalSearchResultsCount = useMemo(
    () => filteredCategories.reduce((sum, cat) => sum + cat.products.length, 0),
    [filteredCategories]
  );

  // Cart Handlers
  const handleQuickAddSimpleProduct = (product: Product) => {
    const lineItemId = generateCartItemId(product.id, null, []);
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === lineItemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + 1;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal: existing.unitPrice * newQty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: lineItemId,
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl,
          variantId: null,
          variantName: null,
          unitPrice: product.price,
          addons: [],
          quantity: 1,
          lineTotal: product.price,
        },
      ];
    });
  };

  const handleQuickUpdateQty = (product: Product, delta: number) => {
    const lineItemId = generateCartItemId(product.id, null, []);
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === lineItemId);
      if (existingIndex < 0) return prev;

      const existing = prev[existingIndex];
      const newQty = existing.quantity + delta;

      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== existingIndex);
      }

      const updated = [...prev];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        lineTotal: existing.unitPrice * newQty,
      };
      return updated;
    });
  };

  const handleConfirmAddToCart = (customizedItem: {
    product: Product;
    selectedVariant: ProductVariant | null;
    selectedAddons: ProductAddon[];
    quantity: number;
    specialInstructions?: string;
    lineTotal: number;
  }) => {
    const {
      product,
      selectedVariant,
      selectedAddons,
      quantity,
      specialInstructions,
    } = customizedItem;

    const addonIds = selectedAddons.map((a) => a.id);
    const lineItemId = generateCartItemId(product.id, selectedVariant?.id, addonIds);

    const effectiveUnitPrice =
      (selectedVariant ? selectedVariant.price : product.price) +
      selectedAddons.reduce((sum, a) => sum + a.price, 0);

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === lineItemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal: existing.unitPrice * newQty,
          specialInstructions: specialInstructions || existing.specialInstructions,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: lineItemId,
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl,
          variantId: selectedVariant?.id || null,
          variantName: selectedVariant?.name || null,
          unitPrice: effectiveUnitPrice,
          addons: selectedAddons.map((a) => ({
            id: a.id,
            name: a.name,
            price: a.price,
          })),
          quantity,
          specialInstructions,
          lineTotal: effectiveUnitPrice * quantity,
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      const itemIndex = prev.findIndex((i) => i.id === cartItemId);
      if (itemIndex < 0) return prev;

      const item = prev[itemIndex];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== itemIndex);
      }

      const updated = [...prev];
      updated[itemIndex] = {
        ...item,
        quantity: newQty,
        lineTotal: item.unitPrice * newQty,
      };
      return updated;
    });
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleExploreMenu = (categoryId?: string) => {
    if (categoryId) {
      setActiveCategoryId(categoryId);
    }
    setCurrentView('menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderConfirmed = (order: ConfirmedOrder) => {
    // 1. Clear cart only after confirmed successful order creation
    setCart([]);
    // 2. Set confirmed order data
    setConfirmedOrder(order);
    // 3. Transition to confirmation view
    setCurrentView('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to get total count in cart for a product
  const getProductCartQuantity = (productId: string) => {
    return cart
      .filter((i) => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: THEME.colors.bgPage,
        color: THEME.colors.textMain,
        fontFamily: THEME.typography.fontFamily,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Persistent App Header */}
      <RestaurantHeader
        restaurant={restaurant}
        branch={branch}
        table={table}
        totalCartItems={totalCartItems}
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main View Router */}
      <main style={{ flex: 1, paddingBottom: totalCartItems > 0 && currentView === 'menu' ? '80px' : '24px' }}>
        {/* VIEW A: Welcome / Landing */}
        {currentView === 'welcome' && (
          <RestaurantWelcome
            restaurant={restaurant}
            branch={branch}
            table={table}
            categories={categories}
            totalProductsCount={totalProductsCount}
            onExploreMenu={handleExploreMenu}
          />
        )}

        {/* VIEW B: Restaurant Menu */}
        {currentView === 'menu' && (
          <div
            style={{
              maxWidth: '640px',
              margin: '0 auto',
              padding: '16px 16px 32px',
            }}
          >
            {/* Search Input */}
            <MenuSearch
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultCount={searchQuery ? totalSearchResultsCount : undefined}
            />

            {/* Horizontal Category Tabs */}
            <MenuCategoryNav
              categories={categories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={setActiveCategoryId}
              totalProductsCount={totalProductsCount}
            />

            {/* Product List Content */}
            {filteredCategories.length === 0 ? (
              <div
                style={{
                  backgroundColor: THEME.colors.bgCard,
                  borderRadius: THEME.radius.lg,
                  border: `1px solid ${THEME.colors.borderSubtle}`,
                  padding: '40px 20px',
                  textAlign: 'center',
                  marginTop: '16px',
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: THEME.colors.navyPrimary,
                    margin: '0 0 6px',
                  }}
                >
                  No dishes found
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: THEME.colors.textMuted,
                    margin: '0 0 16px',
                  }}
                >
                  {searchQuery
                    ? `We couldn't find anything matching "${searchQuery}".`
                    : 'No menu items are currently available in this category.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: THEME.radius.pill,
                      backgroundColor: THEME.colors.navyPrimary,
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <section
                  key={cat.id}
                  style={{
                    marginBottom: '28px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      padding: '0 2px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: THEME.colors.navyPrimary,
                        margin: 0,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {cat.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '12px',
                        color: THEME.colors.textMuted,
                      }}
                    >
                      {cat.products.length} {cat.products.length === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {cat.products.map((product) => (
                      <MenuProductCard
                        key={product.id}
                        product={product}
                        quantityInCart={getProductCartQuantity(product.id)}
                        onOpenCustomization={setCustomizingProduct}
                        onQuickAdd={handleQuickAddSimpleProduct}
                        onQuickUpdateQty={handleQuickUpdateQty}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* VIEW D: Cart Summary */}
        {currentView === 'cart' && (
          <CartSummaryView
            token={token}
            restaurant={restaurant}
            table={table}
            cart={cart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={handleClearCart}
            onContinueBrowsing={() => {
              setCurrentView('menu');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onProceedToCheckout={() => {
              setCurrentView('checkout');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW E: Checkout Screen */}
        {currentView === 'checkout' && (
          <CheckoutView
            token={token}
            restaurant={restaurant}
            branch={branch}
            table={table}
            cart={cart}
            currentUser={currentUser}
            onRequestAuth={() => setIsAuthModalOpen(true)}
            onOrderSuccess={handleOrderConfirmed}
            onBackToCart={() => {
              setCurrentView('cart');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW F: Order Confirmation Screen */}
        {currentView === 'confirmation' && confirmedOrder && (
          <OrderConfirmationView
            order={confirmedOrder}
            restaurant={restaurant}
            table={table}
            onBackToMenu={() => {
              setConfirmedOrder(null);
              setCurrentView('menu');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onProceedToFeedback={(order) => {
              setFeedbackOrderId(order.id);
              setCurrentView('feedback');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW G: Feedback & Loyalty Rewards Screen */}
        {currentView === 'feedback' && feedbackOrderId && (
          <FeedbackView
            orderId={feedbackOrderId}
            restaurant={restaurant}
            table={table}
            currentUser={currentUser}
            onRequestAuth={() => setIsAuthModalOpen(true)}
            onBackToMenu={() => {
              setFeedbackOrderId(null);
              setCurrentView('menu');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            initialOrder={confirmedOrder}
          />
        )}
      </main>

      {/* Floating Bottom Cart Bar for Menu View */}
      {currentView === 'menu' && totalCartItems > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 45,
            padding: '12px 16px',
            backgroundColor: 'rgba(251, 249, 245, 0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: `1px solid ${THEME.colors.borderSubtle}`,
            boxShadow: '0 -4px 16px rgba(23, 63, 112, 0.08)',
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
            <div>
              <div style={{ fontSize: '11px', color: THEME.colors.textMuted }}>
                {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'} for Table {table.tableNumber}
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                }}
              >
                {formatCurrency(cartSubtotal)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCurrentView('cart');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                backgroundColor: THEME.colors.navyPrimary,
                color: '#ffffff',
                border: 'none',
                padding: '12px 22px',
                borderRadius: THEME.radius.md,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(23, 63, 112, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>View Cart</span>
              <span style={{ fontSize: '16px' }}>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Item Customization Modal / Drawer */}
      <ProductCustomizationModal
        product={customizingProduct}
        isOpen={Boolean(customizingProduct)}
        onClose={() => setCustomizingProduct(null)}
        onConfirmAddToCart={handleConfirmAddToCart}
      />

      {/* Customer Mobile OTP Verification Modal */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        table={table}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(verifiedUser) => {
          setCurrentUser(verifiedUser);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}
