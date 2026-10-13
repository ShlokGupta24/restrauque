import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Image as ImageIcon } from 'lucide-react';
import { mockProducts, mockCategories } from '../../services/productData';
import './EditProductPage.css';

interface VariantFormItem {
  id: string;
  name: string;
  price: number | string;
  isActive: boolean;
  isAvailable: boolean;
}

interface AddonFormItem {
  id: string;
  name: string;
  price: number | string;
  isActive: boolean;
  isAvailable: boolean;
}

export const EditProductPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isInitialCreateMode = location.pathname.includes('/create');
  const [isCreateMode, setIsCreateMode] = useState(isInitialCreateMode);

  // Find product if editing
  const existingProduct = mockProducts.find((p) => p.id === productId) || mockProducts[0];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [categoryId, setCategoryId] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number | string>('1');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  const [variants, setVariants] = useState<VariantFormItem[]>([
    {
      id: 'v1',
      name: 'Regular - DEMO',
      price: '220 - DEMO',
      isActive: true,
      isAvailable: true,
    },
  ]);

  const [addons, setAddons] = useState<AddonFormItem[]>([
    {
      id: 'a1',
      name: 'Extra topping - DEMO',
      price: '20 - DEMO',
      isActive: true,
      isAvailable: true,
    },
  ]);

  useEffect(() => {
    if (isCreateMode) {
      setName('');
      setDescription('');
      setPrice('');
      setCategoryId(mockCategories[0]?.id || '');
      setDisplayOrder('1');
      setImageUrl('');
      setIsActive(true);
      setIsAvailable(true);
      setVariants([]);
      setAddons([]);
    } else {
      setName(existingProduct.name);
      setDescription(existingProduct.description);
      setPrice(existingProduct.price);
      setCategoryId(existingProduct.categoryId);
      setDisplayOrder(existingProduct.displayOrder);
      setImageUrl(existingProduct.imageUrl || '');
      setIsActive(existingProduct.isActive);
      setIsAvailable(existingProduct.isAvailable);
      setVariants([
        {
          id: 'v1',
          name: 'Regular - DEMO',
          price: '220 - DEMO',
          isActive: true,
          isAvailable: true,
        },
      ]);
      setAddons([
        {
          id: 'a1',
          name: 'Extra topping - DEMO',
          price: '20 - DEMO',
          isActive: true,
          isAvailable: true,
        },
      ]);
    }
  }, [isCreateMode, existingProduct]);

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `v_${Date.now()}`,
        name: 'New Variant - DEMO',
        price: '240 - DEMO',
        isActive: true,
        isAvailable: true,
      },
    ]);
  };

  const handleAddAddon = () => {
    setAddons((prev) => [
      ...prev,
      {
        id: `a_${Date.now()}`,
        name: 'New Add-on - DEMO',
        price: '30 - DEMO',
        isActive: true,
        isAvailable: true,
      },
    ]);
  };

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
            Products / Create & Edit / Demo · Shared form, edit example shown. Prices use configurable demo INR.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline mode-toggle-btn"
          onClick={() => setIsCreateMode(!isCreateMode)}
        >
          {isCreateMode ? 'Edit mode' : 'Create mode'}
        </button>
      </div>

      {/* Main Title & Subtitle */}
      <div className="edit-product-header">
        <h2 className="edit-product-heading">
          {isCreateMode ? 'Create product - DEMO' : `Edit product - DEMO`}
        </h2>
        <p className="edit-product-desc">
          {isCreateMode
            ? 'Create mode: blank fields, no existing membership, action "Create product". Same field structure, defaults and validation are backend-owned.'
            : 'Create mode: blank fields, no existing membership, action "Create product". Edit mode: prefilled record, action "Save changes". Same field structure, defaults and validation are backend-owned.'}
        </p>
      </div>

      {/* 2-Column Form Layout */}
      <div className="edit-product-layout">
        {/* Left Column (2/3 width) */}
        <div className="edit-product-left-col">
          {/* PRODUCT DETAILS Card */}
          <div className="card form-section-card">
            <h3 className="form-card-title">PRODUCT DETAILS</h3>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Product description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Price</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="220"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <span className="form-field-hint">INR - DEMO / configurable</span>
              </div>

              <div className="form-group">
                <label className="form-label">Category - category_id</label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {mockCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - DEMO
                    </option>
                  ))}
                </select>
                <span className="form-field-hint">
                  Persist the selected category reference, not its label.
                </span>
              </div>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Display order</label>
                <input
                  type="number"
                  className="form-input"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Image URL - image_url</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Not available"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <span className="form-field-hint">
                  {imageUrl ? 'Preview loaded below' : 'No URL supplied. Image remains empty.'}
                </span>
              </div>
            </div>
          </div>

          {/* VARIANTS Card */}
          <div className="card form-section-card">
            <h3 className="form-card-title">VARIANTS</h3>
            <p className="form-card-subtitle">
              Independent active and availability flags for every variant.
            </p>

            <div className="nested-items-list">
              {variants.map((v, index) => (
                <div key={v.id} className="nested-item-card">
                  <div className="form-row-two">
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={v.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariants((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, name: val } : item))
                          );
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price</label>
                      <input
                        type="text"
                        className="form-input"
                        value={v.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariants((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, price: val } : item))
                          );
                        }}
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
            >
              <Plus size={14} />
              <span>Add variant</span>
            </button>
          </div>

          {/* ADD-ONS Card */}
          <div className="card form-section-card">
            <h3 className="form-card-title">ADD-ONS</h3>

            <div className="nested-items-list">
              {addons.map((a, index) => (
                <div key={a.id} className="nested-item-card">
                  <div className="form-row-two">
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={a.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddons((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, name: val } : item))
                          );
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price</label>
                      <input
                        type="text"
                        className="form-input"
                        value={a.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddons((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, price: val } : item))
                          );
                        }}
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

            <p className="publishing-note">Availability is not an inventory or stock quantity.</p>
          </div>

          {/* IMAGE PREVIEW Card */}
          <div className="card form-section-card">
            <h3 className="form-card-title">IMAGE PREVIEW</h3>

            <div className="image-preview-box">
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" className="product-media-preview-img" />
              ) : (
                <div className="empty-media-box">
                  <ImageIcon size={24} className="empty-media-icon" />
                  <div className="empty-media-title">No image supplied</div>
                  <div className="empty-media-sub">Add an image URL to preview product media.</div>
                </div>
              )}
            </div>
          </div>

          {/* MENU MEMBERSHIP Card */}
          <div className="card form-section-card">
            <h3 className="form-card-title">MENU MEMBERSHIP</h3>

            <div className="form-group">
              <label className="form-label">Menu - menus</label>
              <select className="form-select" disabled>
                <option>Not available</option>
              </select>
              <span className="form-field-hint">Options need a scoped backend response.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Memberships - menu_products</label>
              <div className="empty-membership-text">No data yet</div>
            </div>

            <button
              type="button"
              className="btn btn-outline assign-menu-btn"
              onClick={() => alert('Assign to menu modal.')}
            >
              Assign to menu
            </button>

            <p className="membership-footer-note">
              Category context: Main course - DEMO. Membership persistence and category options require a confirmed backend contract.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="edit-product-footer-bar">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/dashboard/menu')}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary-red"
          onClick={() => {
            alert(isCreateMode ? 'Product created successfully!' : 'Changes saved successfully!');
            navigate('/dashboard/menu');
          }}
        >
          {isCreateMode ? 'Create product' : 'Save changes'}
        </button>
      </div>
    </div>
  );
};
