import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Image as ImageIcon, Trash2, AlertCircle, Check } from 'lucide-react';
import {
  menuService,
  SafeCategory,
} from '../../services/menuService';
import { ApiClientError } from '../../services/apiClient';
import './EditProductPage.css';

interface VariantItem {
  id: string; // Real UUID or temp ID
  name: string;
  price: number | string;
  isActive: boolean;
  isAvailable: boolean;
  isDeleted?: boolean;
}

interface AddonItem {
  id: string; // Real UUID or temp ID
  name: string;
  price: number | string;
  isActive: boolean;
  isAvailable: boolean;
  isDeleted?: boolean;
}

export const EditProductPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isInitialCreateMode = location.pathname.includes('/create') || !productId;
  const [isCreateMode, setIsCreateMode] = useState<boolean>(isInitialCreateMode);

  // Categories list
  const [categories, setCategories] = useState<SafeCategory[]>([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [categoryId, setCategoryId] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number | string>('0');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  // Nested collections
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
  const [deletedAddonIds, setDeletedAddonIds] = useState<string[]>([]);

  // Load categories from backend
  const loadCategories = useCallback(async () => {
    try {
      const res = await menuService.getCategories({ limit: 100 });
      setCategories(res.categories);
      return res.categories;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories';
      setPageError(msg);
      return [];
    }
  }, []);

  // Load product if editing
  const loadProduct = useCallback(async (id: string) => {
    setIsLoadingProduct(true);
    setPageError(null);
    try {
      const res = await menuService.getProduct(id);
      const prod = res.product;

      setName(prod.name);
      setDescription(prod.description || '');
      setPrice(prod.price);
      setCategoryId(prod.categoryId);
      setDisplayOrder(prod.displayOrder);
      setImageUrl(prod.imageUrl || '');
      setIsActive(prod.isActive);
      setIsAvailable(prod.isAvailable);

      if (prod.variants && Array.isArray(prod.variants)) {
        setVariants(
          prod.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price,
            isActive: v.isActive,
            isAvailable: v.isAvailable,
          }))
        );
      } else {
        setVariants([]);
      }

      if (prod.addons && Array.isArray(prod.addons)) {
        setAddons(
          prod.addons.map((a) => ({
            id: a.id,
            name: a.name,
            price: a.price,
            isActive: a.isActive,
            isAvailable: a.isAvailable,
          }))
        );
      } else {
        setAddons([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Product not found';
      setPageError(msg);
    } finally {
      setIsLoadingProduct(false);
    }
  }, []);

  useEffect(() => {
    loadCategories().then((loadedCats) => {
      if (isCreateMode) {
        setName('');
        setDescription('');
        setPrice('');
        if (loadedCats.length > 0) {
          setCategoryId(loadedCats[0].id);
        }
        setDisplayOrder('0');
        setImageUrl('');
        setIsActive(true);
        setIsAvailable(true);
        setVariants([]);
        setAddons([]);
      } else if (productId) {
        loadProduct(productId);
      }
    });
  }, [isCreateMode, productId, loadCategories, loadProduct]);

  // Variant Actions
  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `temp_${Date.now()}`,
        name: '',
        price: '',
        isActive: true,
        isAvailable: true,
      },
    ]);
  };

  const handleRemoveVariant = (variantId: string) => {
    if (!variantId.startsWith('temp_')) {
      setDeletedVariantIds((prev) => [...prev, variantId]);
    }
    setVariants((prev) => prev.filter((v) => v.id !== variantId));
  };

  // Addon Actions
  const handleAddAddon = () => {
    setAddons((prev) => [
      ...prev,
      {
        id: `temp_${Date.now()}`,
        name: '',
        price: '0',
        isActive: true,
        isAvailable: true,
      },
    ]);
  };

  const handleRemoveAddon = (addonId: string) => {
    if (!addonId.startsWith('temp_')) {
      setDeletedAddonIds((prev) => [...prev, addonId]);
    }
    setAddons((prev) => prev.filter((a) => a.id !== addonId));
  };

  // Delete product action
  const handleDeleteProduct = async () => {
    if (!productId || isCreateMode) return;
    const confirmed = window.confirm(
      `Are you sure you want to remove "${name}"? If past orders reference this product, it will be safely deactivated and archived.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await menuService.deleteProduct(productId);
      alert(res.message);
      navigate('/dashboard/menu');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete product';
      setPageError(msg);
      setIsSubmitting(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPageError(null);

    // Validation
    if (!name.trim()) {
      setPageError('Product name is required');
      return;
    }

    if (!categoryId) {
      setPageError('Please select a valid category');
      return;
    }

    const numericPrice = parseFloat(String(price));
    if (isNaN(numericPrice) || numericPrice < 0) {
      setPageError('Price must be a valid non-negative number');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetProductId = productId;

      if (isCreateMode) {
        // 1. Create product
        const createRes = await menuService.createProduct({
          name: name.trim(),
          description: description.trim() || null,
          price: Math.round(numericPrice * 100) / 100,
          categoryId,
          displayOrder: parseInt(String(displayOrder), 10) || 0,
          imageUrl: imageUrl.trim() || null,
          isActive,
          isAvailable,
        });

        targetProductId = createRes.product.id;

        // 2. Create initial variants
        for (const v of variants) {
          if (v.name.trim()) {
            const vPrice = parseFloat(String(v.price));
            await menuService.createVariant(targetProductId, {
              name: v.name.trim(),
              price: isNaN(vPrice) ? numericPrice : Math.round(vPrice * 100) / 100,
              isActive: v.isActive,
              isAvailable: v.isAvailable,
            });
          }
        }

        // 3. Create initial add-ons
        for (const a of addons) {
          if (a.name.trim()) {
            const aPrice = parseFloat(String(a.price));
            await menuService.createAddon(targetProductId, {
              name: a.name.trim(),
              price: isNaN(aPrice) ? 0 : Math.round(aPrice * 100) / 100,
              isActive: a.isActive,
              isAvailable: a.isAvailable,
            });
          }
        }

        setSuccessToast('Product created successfully!');
      } else if (targetProductId) {
        // 1. Update product
        await menuService.updateProduct(targetProductId, {
          name: name.trim(),
          description: description.trim() || null,
          price: Math.round(numericPrice * 100) / 100,
          categoryId,
          displayOrder: parseInt(String(displayOrder), 10) || 0,
          imageUrl: imageUrl.trim() || null,
          isActive,
          isAvailable,
        });

        // 2. Handle deleted variants
        for (const vid of deletedVariantIds) {
          try {
            await menuService.deleteVariant(targetProductId, vid);
          } catch {
            // Ignore if already deleted
          }
        }

        // 3. Handle created / updated variants
        for (const v of variants) {
          if (!v.name.trim()) continue;
          const vPrice = parseFloat(String(v.price));
          const safePrice = isNaN(vPrice) ? numericPrice : Math.round(vPrice * 100) / 100;

          if (v.id.startsWith('temp_')) {
            await menuService.createVariant(targetProductId, {
              name: v.name.trim(),
              price: safePrice,
              isActive: v.isActive,
              isAvailable: v.isAvailable,
            });
          } else {
            await menuService.updateVariant(targetProductId, v.id, {
              name: v.name.trim(),
              price: safePrice,
              isActive: v.isActive,
              isAvailable: v.isAvailable,
            });
          }
        }

        // 4. Handle deleted add-ons
        for (const aid of deletedAddonIds) {
          try {
            await menuService.deleteAddon(targetProductId, aid);
          } catch {
            // Ignore if already deleted
          }
        }

        // 5. Handle created / updated add-ons
        for (const a of addons) {
          if (!a.name.trim()) continue;
          const aPrice = parseFloat(String(a.price));
          const safePrice = isNaN(aPrice) ? 0 : Math.round(aPrice * 100) / 100;

          if (a.id.startsWith('temp_')) {
            await menuService.createAddon(targetProductId, {
              name: a.name.trim(),
              price: safePrice,
              isActive: a.isActive,
              isAvailable: a.isAvailable,
            });
          } else {
            await menuService.updateAddon(targetProductId, a.id, {
              name: a.name.trim(),
              price: safePrice,
              isActive: a.isActive,
              isAvailable: a.isAvailable,
            });
          }
        }

        setSuccessToast('Changes saved successfully!');
      }

      setTimeout(() => {
        navigate('/dashboard/menu');
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.details && Array.isArray(err.details)) {
          const detailMsg = (err.details as Array<{ field?: string; message: string }>)
            .map((d) => d.message)
            .join('. ');
          setPageError(detailMsg || err.message);
        } else {
          setPageError(err.message);
        }
      } else if (err instanceof Error) {
        setPageError(err.message);
      } else {
        setPageError('Failed to save product. Please check your inputs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingProduct) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
        Loading product details from backend...
      </div>
    );
  }

  return (
    <div className="edit-product-container">
      {/* Top Breadcrumb Header & Create Mode Switcher */}
      <div className="edit-product-top-row">
        <div className="breadcrumb-sub-info">
          <button
            type="button"
            className="back-to-menu-btn"
            onClick={() => navigate('/dashboard/menu')}
          >
            <ArrowLeft size={14} />
            <span>Back to products</span>
          </button>
          <span className="breadcrumb-path-note">
            Products / {isCreateMode ? 'Create New' : 'Edit Product'} · Backend-verified catalog
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline mode-toggle-btn"
          onClick={() => {
            if (isCreateMode && productId) {
              setIsCreateMode(false);
            } else if (!isCreateMode) {
              setIsCreateMode(true);
            } else {
              navigate('/dashboard/menu');
            }
          }}
        >
          {isCreateMode ? (productId ? 'Edit mode' : 'Exit') : 'Create mode'}
        </button>
      </div>

      {/* Main Title & Subtitle */}
      <div className="edit-product-header">
        <h2 className="edit-product-heading">
          {isCreateMode ? 'Create product' : `Edit: ${name || 'Product'}`}
        </h2>
        <p className="edit-product-desc">
          {isCreateMode
            ? 'Add a new product with absolute variant prices and optional per-unit add-on surcharges.'
            : 'Update product configuration, toggle availability, or manage variants and add-ons.'}
        </p>
      </div>

      {successToast && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#059669',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <Check size={16} /> {successToast}
        </div>
      )}

      {pageError && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(229, 57, 53, 0.12)',
            border: '1px solid rgba(229, 57, 53, 0.35)',
            color: '#ff6c64',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{pageError}</span>
        </div>
      )}

      {/* 2-Column Form Layout */}
      <form onSubmit={handleSubmit}>
        <div className="edit-product-layout">
          {/* Left Column (2/3 width) */}
          <div className="edit-product-left-col">
            {/* PRODUCT DETAILS Card */}
            <div className="card form-section-card">
              <h3 className="form-card-title">PRODUCT DETAILS</h3>

              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Paneer Tikka Wrap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Product description and ingredients"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-row-two">
                <div className="form-group">
                  <label className="form-label">Base Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="form-input"
                    placeholder="e.g. 220"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <span className="form-field-hint">Absolute price in INR</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isSubmitting || categories.length === 0}
                  >
                    {categories.length === 0 ? (
                      <option value="">No categories available</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="form-field-hint">
                    {categories.length === 0
                      ? 'Create a category in Menu Management before adding products'
                      : 'Scoped to active restaurant'}
                  </span>
                </div>
              </div>

              <div className="form-row-two">
                <div className="form-group">
                  <label className="form-label">Display order</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Image URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://images.example.com/item.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <span className="form-field-hint">
                    {imageUrl ? 'Preview loaded on the right' : 'Optional HTTP or HTTPS URL'}
                  </span>
                </div>
              </div>
            </div>

            {/* VARIANTS Card */}
            <div className="card form-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 className="form-card-title" style={{ margin: 0 }}>
                  VARIANTS ({variants.length})
                </h3>
              </div>
              <p className="form-card-subtitle">
                Variants represent alternate portions or sizes. Variant price is the absolute price for that portion.
              </p>

              <div className="nested-items-list">
                {variants.map((v, index) => (
                  <div key={v.id} className="nested-item-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#e5e7eb' }}>
                        Variant #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(v.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff6c64',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    <div className="form-row-two">
                      <div className="form-group">
                        <label className="form-label">Variant Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Regular, Large"
                          className="form-input"
                          value={v.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, name: val } : item))
                            );
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Absolute Price (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="e.g. 240"
                          className="form-input"
                          value={v.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, price: val } : item))
                            );
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="toggles-row">
                      <div className="toggle-item-pair">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={v.isActive}
                          className={`toggle-switch ${v.isActive ? 'switch-on-red' : 'switch-off'}`}
                          onClick={() => {
                            setVariants((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, isActive: !item.isActive } : item
                              )
                            );
                          }}
                          disabled={isSubmitting}
                        >
                          <span className="toggle-thumb" />
                        </button>
                        <div className="toggle-labels">
                          <span className="toggle-main-label">
                            Active · {v.isActive ? 'On' : 'Off'}
                          </span>
                          <span className="toggle-sub-label">Variant enabled</span>
                        </div>
                      </div>

                      <div className="toggle-item-pair">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={v.isAvailable}
                          className={`toggle-switch ${v.isAvailable ? 'switch-on-red' : 'switch-off'}`}
                          onClick={() => {
                            setVariants((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, isAvailable: !item.isAvailable } : item
                              )
                            );
                          }}
                          disabled={isSubmitting}
                        >
                          <span className="toggle-thumb" />
                        </button>
                        <div className="toggle-labels">
                          <span className="toggle-main-label">
                            Available now · {v.isAvailable ? 'On' : 'Off'}
                          </span>
                          <span className="toggle-sub-label">Currently orderable</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-outline add-nested-btn"
                onClick={handleAddVariant}
                disabled={isSubmitting}
              >
                <Plus size={14} />
                <span>Add variant</span>
              </button>
            </div>

            {/* ADD-ONS Card */}
            <div className="card form-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 className="form-card-title" style={{ margin: 0 }}>
                  ADD-ONS ({addons.length})
                </h3>
              </div>
              <p className="form-card-subtitle">
                Add-ons represent optional extras or customizations. Add-on price is the per-unit surcharge added to the order.
              </p>

              <div className="nested-items-list">
                {addons.map((a, index) => (
                  <div key={a.id} className="nested-item-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#e5e7eb' }}>
                        Add-on #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddon(a.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff6c64',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    <div className="form-row-two">
                      <div className="form-group">
                        <label className="form-label">Add-on Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Extra Cheese, Dip"
                          className="form-input"
                          value={a.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddons((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, name: val } : item))
                            );
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Surcharge Price (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 30"
                          className="form-input"
                          value={a.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddons((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, price: val } : item))
                            );
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="toggles-row">
                      <div className="toggle-item-pair">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={a.isActive}
                          className={`toggle-switch ${a.isActive ? 'switch-on-red' : 'switch-off'}`}
                          onClick={() => {
                            setAddons((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, isActive: !item.isActive } : item
                              )
                            );
                          }}
                          disabled={isSubmitting}
                        >
                          <span className="toggle-thumb" />
                        </button>
                        <div className="toggle-labels">
                          <span className="toggle-main-label">
                            Active · {a.isActive ? 'On' : 'Off'}
                          </span>
                          <span className="toggle-sub-label">Add-on enabled</span>
                        </div>
                      </div>

                      <div className="toggle-item-pair">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={a.isAvailable}
                          className={`toggle-switch ${a.isAvailable ? 'switch-on-red' : 'switch-off'}`}
                          onClick={() => {
                            setAddons((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, isAvailable: !item.isAvailable } : item
                              )
                            );
                          }}
                          disabled={isSubmitting}
                        >
                          <span className="toggle-thumb" />
                        </button>
                        <div className="toggle-labels">
                          <span className="toggle-main-label">
                            Available now · {a.isAvailable ? 'On' : 'Off'}
                          </span>
                          <span className="toggle-sub-label">Currently orderable</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-outline add-nested-btn"
                onClick={handleAddAddon}
                disabled={isSubmitting}
              >
                <Plus size={14} />
                <span>Add add-on</span>
              </button>
            </div>
          </div>

          {/* Right Column (1/3 width) */}
          <div className="edit-product-right-col">
            {/* PUBLISHING Card */}
            <div className="card form-section-card">
              <h3 className="form-card-title">PUBLISHING</h3>

              <div className="publishing-toggles-col">
                <div className="toggle-item-pair">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    className={`toggle-switch ${isActive ? 'switch-on-red' : 'switch-off'}`}
                    onClick={() => setIsActive(!isActive)}
                    disabled={isSubmitting}
                  >
                    <span className="toggle-thumb" />
                  </button>
                  <div className="toggle-labels">
                    <span className="toggle-main-label">Active · {isActive ? 'On' : 'Off'}</span>
                    <span className="toggle-sub-label">Product enabled · is_active</span>
                  </div>
                </div>

                <div className="toggle-item-pair">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAvailable}
                    className={`toggle-switch ${isAvailable ? 'switch-on-red' : 'switch-off'}`}
                    onClick={() => setIsAvailable(!isAvailable)}
                    disabled={isSubmitting}
                  >
                    <span className="toggle-thumb" />
                  </button>
                  <div className="toggle-labels">
                    <span className="toggle-main-label">
                      Available now · {isAvailable ? 'On' : 'Off'}
                    </span>
                    <span className="toggle-sub-label">Currently orderable · is_available</span>
                  </div>
                </div>
              </div>

              <p className="publishing-note">
                Availability is a live toggle, not an inventory or stock quantity.
              </p>
            </div>

            {/* IMAGE PREVIEW Card */}
            <div className="card form-section-card">
              <h3 className="form-card-title">IMAGE PREVIEW</h3>

              <div className="image-preview-box">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="product-media-preview-img"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="empty-media-box">
                    <ImageIcon size={24} className="empty-media-icon" />
                    <div className="empty-media-title">No image supplied</div>
                    <div className="empty-media-sub">Enter an image URL above to preview product media.</div>
                  </div>
                )}
              </div>
            </div>

            {/* MENU MEMBERSHIP Card (Marked as Concept/Disabled) */}
            <div className="card form-section-card">
              <h3 className="form-card-title">MENU MEMBERSHIP</h3>

              <div className="form-group">
                <label className="form-label">Menu Entity</label>
                <select className="form-select" disabled>
                  <option>Primary Restaurant Menu</option>
                </select>
                <span className="form-field-hint">
                  Multi-menu partitioning is not exposed in the current owner API. Products are scoped to categories.
                </span>
              </div>
            </div>

            {/* Danger Zone for Existing Product */}
            {!isCreateMode && productId && (
              <div
                className="card form-section-card"
                style={{ borderColor: 'rgba(229, 57, 53, 0.3)' }}
              >
                <h3 className="form-card-title" style={{ color: '#ff6c64' }}>
                  ARCHIVE / DELETE
                </h3>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 14px' }}>
                  Deleting this product will remove it if it has no prior orders, or archive it if order history exists.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteProduct}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid rgba(229, 57, 53, 0.4)',
                    backgroundColor: 'rgba(229, 57, 53, 0.1)',
                    color: '#ff6c64',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={14} /> Remove Product
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="edit-product-footer-bar">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/dashboard/menu')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary-red"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isCreateMode
                ? 'Creating product...'
                : 'Saving changes...'
              : isCreateMode
              ? 'Create product'
              : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
