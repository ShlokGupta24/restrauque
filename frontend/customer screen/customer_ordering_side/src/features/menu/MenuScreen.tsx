import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, Plus, ShoppingBag, ArrowRight, Menu, Utensils } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { Category, Product } from '../../services/contracts/types';
import './MenuScreen.css';

/**
 * Screen 02: Menu & Category Browsing
 * Visual reference: UIUX/02-menu-categories.png
 */
export const MenuScreen: React.FC = () => {
  const {
    goBack,
    navigateTo,
    selectedCategory,
    setSelectedCategory,
    addToCart,
    cart,
    bill,
    openNav,
  } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Load categories and initial products
  useEffect(() => {
    async function loadMenuData() {
      try {
        setLoading(true);
        const [cats, prods] = await Promise.all([
          customerDataService.getCategories(),
          customerDataService.getProducts(),
        ]);
        setCategories(cats);
        setProducts(prods);
      } catch (err) {
        console.error('Failed to load menu data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMenuData();
  }, []);

  // Filter products based on selected category & search query
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      const matchesCategory =
        !selectedCategory ||
        selectedCategory === 'cat-all' ||
        prod.categoryId === selectedCategory;

      // Search filter
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        prod.name.toLowerCase().includes(query) ||
        prod.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleProductClick = (product: Product) => {
    // Open product details modal/page (Screen 03)
    navigateTo('product-detail', { productId: product.id });
  };

  const handleAddButtonClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    // If product has custom variants or add-ons, open details for user selection
    if ((product.variants && product.variants.length > 1) || (product.addons && product.addons.length > 0)) {
      navigateTo('product-detail', { productId: product.id });
    } else {
      // Direct quick-add for simple products
      addToCart(product, 1);
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="menu-page">
      {/* Top Header */}
      <header className="menu-header">
        <button
          className="back-button"
          onClick={goBack}
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="menu-title">Menu</h1>
        <button
          className="back-button hamburger-btn"
          onClick={openNav}
          aria-label="Navigation menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Live Search Bar */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search for dishes, beverages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Search size={18} className="search-icon" />
      </div>

      {/* Horizontal Category Filter Pills */}
      <div className="category-tabs-wrapper">
        <div className="category-tabs" role="tablist">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                className={`category-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Vertical List */}
      <section className="product-list" aria-label="Menu Products">
        {loading ? (
          <div className="empty-menu-state">
            <p>Loading menu...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-menu-state">
            <p>No dishes found matching your search.</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <article
              key={product.id}
              className="product-card"
              onClick={() => handleProductClick(product)}
            >
              <div className="product-image-container">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="product-image"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="product-image-fallback" aria-hidden="true">
                    <Utensils size={24} />
                  </div>
                )}
              </div>

              <div className="product-info">
                <h2 className="product-name">{product.name}</h2>
                <p className="product-description">{product.description}</p>
                <span className="product-price">₹ {product.price}</span>
              </div>

              <div className="product-add-action">
                <button
                  className="add-circle-btn"
                  onClick={(e) => handleAddButtonClick(e, product)}
                  aria-label={`Add ${product.name} to cart`}
                >
                  <Plus size={20} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Sticky Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div
          className="cart-floating-bar"
          onClick={() => navigateTo('cart')}
          role="button"
          tabIndex={0}
        >
          <div className="cart-bar-left">
            <ShoppingBag size={18} />
            <span>
              {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="cart-bar-right">
            <span>₹ {bill.totalAmount}</span>
            <ArrowRight size={16} />
          </div>
        </div>
      )}
    </div>
  );
};
