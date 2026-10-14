import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Image as ImageIcon, RefreshCw, AlertCircle, X, Edit2, Trash2, Check } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  menuService,
  SafeProduct,
  SafeCategory,
  MenuSummaryResponse,
} from '../../services/menuService';
import { ApiClientError } from '../../services/apiClient';
import './MenuProductsPage.css';

export const MenuProductsPage: React.FC = () => {
  const { formatCurrency } = useRestaurant();
  const navigate = useNavigate();

  // Data states
  const [products, setProducts] = useState<SafeProduct[]>([]);
  const [categories, setCategories] = useState<SafeCategory[]>([]);
  const [summary, setSummary] = useState<MenuSummaryResponse | null>(null);

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAvailability, setSelectedAvailability] = useState('all');
  const [selectedActive, setSelectedActive] = useState('all');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Category Manager Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryOrder, setNewCategoryOrder] = useState<number>(0);
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDesc, setEditCategoryDesc] = useState('');

  // Toast auto-clear
  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Load menu summary
  const loadSummary = useCallback(async () => {
    try {
      const sum = await menuService.getMenuSummary();
      setSummary(sum);
    } catch {
      // Summary error does not block the entire menu view
    }
  }, []);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await menuService.getCategories({ limit: 100 });
      setCategories(res.categories);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories';
      setCategoryModalError(msg);
    }
  }, []);

  // Load products
  const loadProducts = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const res = await menuService.getProducts({
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
          isActive: selectedActive !== 'all' ? selectedActive === 'active' : undefined,
          isAvailable:
            selectedAvailability !== 'all' ? selectedAvailability === 'available' : undefined,
          search: searchQuery.trim() || undefined,
          page: pageNum,
          limit: 50,
        });

        if (append) {
          setProducts((prev) => [...prev, ...res.products]);
        } else {
          setProducts(res.products);
        }
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load products from server';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedCategory, selectedActive, selectedAvailability, searchQuery]
  );

  // Initial load
  useEffect(() => {
    loadSummary();
    loadCategories();
  }, [loadSummary, loadCategories]);

  // Trigger product fetch whenever filters change
  useEffect(() => {
    loadProducts(1, false);
  }, [loadProducts]);

  // Toggle availability
  const handleToggleAvailability = async (product: SafeProduct) => {
    if (updatingProductId) return; // Prevent duplicate concurrent toggles
    setUpdatingProductId(product.id);

    const nextAvailable = !product.isAvailable;
    try {
      const res = await menuService.updateProduct(product.id, {
        isAvailable: nextAvailable,
      });

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isAvailable: res.product.isAvailable } : p))
      );
      showToast(`"${product.name}" marked as ${nextAvailable ? 'Available' : 'Unavailable'}`);
      loadSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update availability';
      setError(msg);
    } finally {
      setUpdatingProductId(null);
    }
  };

  // Delete / Archive product
  const handleDeleteProduct = async (product: SafeProduct) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${product.name}"? If the product has past order history, it will be safely deactivated and archived.`
    );
    if (!confirmed) return;

    try {
      const res = await menuService.deleteProduct(product.id);
      if (res.deleted) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        showToast(`Product "${product.name}" deleted.`);
      } else {
        // Archived
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, isActive: false, isAvailable: false } : p))
        );
        showToast(res.message || `Product "${product.name}" archived.`);
      }
      loadSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove product';
      alert(msg);
    }
  };

  // Category Management Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryModalError(null);

    if (!newCategoryName.trim()) {
      setCategoryModalError('Category name is required');
      return;
    }

    setIsSavingCategory(true);
    try {
      await menuService.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
        displayOrder: Number(newCategoryOrder) || 0,
        isActive: true,
      });

      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryOrder(0);
      showToast('Category created successfully!');
      await loadCategories();
      await loadSummary();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setCategoryModalError(err.message);
      } else if (err instanceof Error) {
        setCategoryModalError(err.message);
      } else {
        setCategoryModalError('Failed to create category');
      }
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleStartEditCategory = (c: SafeCategory) => {
    setEditingCategoryId(c.id);
    setEditCategoryName(c.name);
    setEditCategoryDesc(c.description || '');
  };

  const handleSaveEditCategory = async (categoryId: string) => {
    if (!editCategoryName.trim()) {
      setCategoryModalError('Category name cannot be empty');
      return;
    }

    setIsSavingCategory(true);
    setCategoryModalError(null);
    try {
      await menuService.updateCategory(categoryId, {
        name: editCategoryName.trim(),
        description: editCategoryDesc.trim() || null,
      });

      setEditingCategoryId(null);
      showToast('Category updated successfully!');
      await loadCategories();
      await loadProducts(1, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update category';
      setCategoryModalError(msg);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (c: SafeCategory) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete category "${c.name}"? If it contains products, it will be deactivated and archived.`
    );
    if (!confirmed) return;

    try {
      const res = await menuService.deleteCategory(c.id);
      showToast(res.message);
      await loadCategories();
      await loadSummary();
      await loadProducts(1, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete category';
      setCategoryModalError(msg);
    }
  };

  // Summary counts
  const activeCount = summary ? summary.activeProducts : products.filter((p) => p.isActive).length;
  const availableCount = summary
    ? summary.availableProducts
    : products.filter((p) => p.isAvailable).length;
  const unavailableCount = summary
    ? summary.unavailableProducts
    : products.filter((p) => !p.isAvailable).length;

  return (
    <div className="menu-products-container">
      {/* Sub-banner Notice */}
      <div className="menu-subbanner">
        Verified menu management · source of truth loaded from backend.
      </div>

      {successToast && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: '#059669',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
          }}
        >
          <Check size={16} /> {successToast}
        </div>
      )}

      {/* Top Header Row with Add Product Action */}
      <div className="menu-top-action-row">
        <div />
        <button
          type="button"
          className="btn btn-primary-red add-product-btn"
          id="btn-add-product"
          onClick={() => navigate('/dashboard/menu/products/create')}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add product</span>
        </button>
      </div>

      {/* 3 Summary KPI Cards */}
      <div className="menu-kpi-grid">
        <div className="card menu-kpi-card">
          <span className="menu-kpi-label">Active products</span>
          <div className="menu-kpi-value">{activeCount}</div>
        </div>

        <div className="card menu-kpi-card">
          <span className="menu-kpi-label">Available now</span>
          <div className="menu-kpi-value">{availableCount}</div>
        </div>

        <div className="card menu-kpi-card">
          <span className="menu-kpi-label">Unavailable now</span>
          <div className="menu-kpi-value">{unavailableCount}</div>
        </div>
      </div>

      {/* Products List Card */}
      <div className="card menu-table-card">
        <div className="card-header-clean">
          <div>
            <h3 className="card-title">Products / Menu Catalog</h3>
            <div className="card-subtitle">
              Active = enabled in menu. Available now = currently orderable.
            </div>
          </div>
          <button
            type="button"
            className="filter-chip-btn"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => {
              loadSummary();
              loadProducts(1, false);
            }}
            disabled={isLoading}
          >
            <RefreshCw size={13} className={isLoading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(229, 57, 53, 0.1)',
              border: '1px solid rgba(229, 57, 53, 0.3)',
              color: '#ff6c64',
              fontSize: '13px',
              margin: '14px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadProducts(1, false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff6c64',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="menu-filter-bar">
          <div className="filter-group-left">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                id="input-search-products"
                placeholder="Search products (name, description)"
                className="search-input search-input-wide"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <select
              className="filter-select"
              id="select-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.productCount !== undefined ? `(${c.productCount})` : ''}
                </option>
              ))}
            </select>

            {/* Availability Filter */}
            <select
              className="filter-select"
              id="select-availability-filter"
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
            >
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>

            {/* Active Filter */}
            <select
              className="filter-select"
              id="select-active-filter"
              value={selectedActive}
              onChange={(e) => setSelectedActive(e.target.value)}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button
            type="button"
            className="filter-chip-btn manage-categories-btn"
            id="btn-manage-categories"
            onClick={() => {
              setCategoryModalError(null);
              setIsCategoryModalOpen(true);
            }}
          >
            Manage categories ({categories.length})
          </button>
        </div>

        {/* Products Table */}
        {isLoading && products.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
            Loading products from backend...
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '13px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              margin: '16px 0',
            }}
          >
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#d1d5db' }}>
              No products found matching your current filter.
            </p>
            <button
              type="button"
              className="btn btn-primary-red"
              onClick={() => navigate('/dashboard/menu/products/create')}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              <Plus size={14} style={{ marginRight: '4px' }} /> Add product
            </button>
          </div>
        ) : (
          <div className="menu-table-wrapper">
            <table className="menu-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-product-header">
                      <ImageIcon size={13} />
                      <span>PRODUCT</span>
                    </div>
                  </th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>ACTIVE</th>
                  <th>AVAILABILITY</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => (
                  <tr key={prod.id} className="menu-table-row">
                    {/* Product Thumbnail + Name */}
                    <td className="cell-product-info">
                      <div className="product-thumb-box">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="product-thumb-img"
                            onError={(e) => {
                              // Fallback on broken image link
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="product-thumb-placeholder">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="product-table-name">{prod.name}</span>
                        {prod.description && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#9ca3af',
                              maxWidth: '300px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {prod.description}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="cell-category">
                      {prod.categoryName ||
                        categories.find((c) => c.id === prod.categoryId)?.name ||
                        'Uncategorized'}
                    </td>

                    {/* Price */}
                    <td className="cell-price">{formatCurrency(prod.price)}</td>

                    {/* Active */}
                    <td className="cell-active">
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: prod.isActive ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: prod.isActive ? '#10b981' : '#f87171',
                        }}
                      >
                        {prod.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Availability Toggle */}
                    <td className="cell-availability">
                      <div className="availability-switch-group">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={prod.isAvailable}
                          disabled={updatingProductId === prod.id}
                          className={`toggle-switch ${prod.isAvailable ? 'switch-on' : 'switch-off'}`}
                          onClick={() => handleToggleAvailability(prod)}
                          title="Click to toggle real-time availability"
                        >
                          <span className="toggle-thumb" />
                        </button>

                        <span
                          className={`pill-availability ${
                            prod.isAvailable ? 'pill-available' : 'pill-unavailable'
                          }`}
                        >
                          {prod.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </td>

                    {/* Action Links */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-action-link"
                          onClick={() => navigate(`/dashboard/menu/products/${prod.id}/edit`)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Delete or Archive Product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer & Load more */}
        <div className="menu-table-footer">
          <span className="footer-sample-note">
            Showing {products.length} products. Page {page} of {totalPages}.
          </span>
          {totalPages > page && (
            <button
              type="button"
              className="btn-load-more"
              disabled={isLoadingMore}
              onClick={() => loadProducts(page + 1, true)}
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      </div>

      {/* ================= CATEGORY MANAGEMENT MODAL ================= */}
      {isCategoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#191a1c',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              color: '#ffffff',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>
                  Manage Menu Categories
                </h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                  Categories group menu items for QR ordering and counter displays.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {categoryModalError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(229, 57, 53, 0.15)',
                  border: '1px solid rgba(229, 57, 53, 0.35)',
                  color: '#ff6c64',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                {categoryModalError}
              </div>
            )}

            {/* Create Category Form */}
            <form
              onSubmit={handleCreateCategory}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px', color: '#e5e7eb' }}>
                Add New Category
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                    CATEGORY NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Desserts, Hot Beverages"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={isSavingCategory}
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: '#111213',
                      color: '#ffffff',
                      padding: '0 12px',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                    DISPLAY ORDER
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newCategoryOrder}
                    onChange={(e) => setNewCategoryOrder(parseInt(e.target.value, 10) || 0)}
                    disabled={isSavingCategory}
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: '#111213',
                      color: '#ffffff',
                      padding: '0 12px',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                  DESCRIPTION (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Freshly brewed coffees and teas"
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  disabled={isSavingCategory}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backgroundColor: '#111213',
                    color: '#ffffff',
                    padding: '0 12px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isSavingCategory}
                style={{
                  height: '36px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--brand-red, #e53935)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '0 16px',
                  cursor: isSavingCategory ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={14} /> {isSavingCategory ? 'Saving...' : 'Add category'}
              </button>
            </form>

            {/* Existing Categories List */}
            <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 10px', color: '#e5e7eb' }}>
              Existing Categories ({categories.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                  }}
                >
                  {editingCategoryId === c.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          placeholder="Category name"
                          style={{
                            flex: 1,
                            height: '32px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            backgroundColor: '#111213',
                            color: '#ffffff',
                            padding: '0 10px',
                            fontSize: '12px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditCategory(c.id)}
                          disabled={isSavingCategory}
                          style={{
                            padding: '0 12px',
                            height: '32px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategoryId(null)}
                          style={{
                            padding: '0 10px',
                            height: '32px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            backgroundColor: 'transparent',
                            color: '#9ca3af',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editCategoryDesc}
                        onChange={(e) => setEditCategoryDesc(e.target.value)}
                        placeholder="Description (optional)"
                        style={{
                          height: '30px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          backgroundColor: '#111213',
                          color: '#ffffff',
                          padding: '0 10px',
                          fontSize: '11px',
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: '#9ca3af',
                            }}
                          >
                            Order: {c.displayOrder}
                          </span>
                          {c.productCount !== undefined && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: '#9ca3af',
                              }}
                            >
                              {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
                            {c.description}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(c)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Edit category"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff6c64',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Delete / Archive category"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
