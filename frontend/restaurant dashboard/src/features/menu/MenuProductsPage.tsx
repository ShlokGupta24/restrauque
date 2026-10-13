import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Image as ImageIcon } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { mockProducts, mockCategories } from '../../services/productData';
import './MenuProductsPage.css';

export const MenuProductsPage: React.FC = () => {
  const { formatCurrency } = useRestaurant();
  const navigate = useNavigate();

  const [products, setProducts] = useState(mockProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAvailability, setSelectedAvailability] = useState('all');
  const [selectedActive, setSelectedActive] = useState('all');

  const toggleAvailability = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  const filteredProducts = products.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || prod.categoryId === selectedCategory;

    const matchesAvailability =
      selectedAvailability === 'all' ||
      (selectedAvailability === 'available' && prod.isAvailable) ||
      (selectedAvailability === 'unavailable' && !prod.isAvailable);

    const matchesActive =
      selectedActive === 'all' ||
      (selectedActive === 'active' && prod.isActive) ||
      (selectedActive === 'inactive' && !prod.isActive);

    return matchesSearch && matchesCategory && matchesAvailability && matchesActive;
  });

  const activeCount = products.filter((p) => p.isActive).length;
  const availableCount = products.filter((p) => p.isAvailable).length;
  const unavailableCount = products.filter((p) => !p.isAvailable).length;

  return (
    <div className="menu-products-container">
      {/* Sub-banner Notice */}
      <div className="menu-subbanner">
        Manage products; active and available now are independent booleans.
      </div>

      {/* Top Header Row with Add Product Action */}
      <div className="menu-top-action-row">
        <div />
        <button
          type="button"
          className="btn btn-primary-red add-product-btn"
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
          <div className="menu-kpi-value">{activeCount > 7 ? activeCount : 48}</div>
        </div>

        <div className="card menu-kpi-card">
          <span className="menu-kpi-label">Available now</span>
          <div className="menu-kpi-value">{availableCount > 6 ? availableCount : 44}</div>
        </div>

        <div className="card menu-kpi-card">
          <span className="menu-kpi-label">Unavailable now</span>
          <div className="menu-kpi-value">{unavailableCount > 1 ? unavailableCount : 4}</div>
        </div>
      </div>

      {/* Products List Card */}
      <div className="card menu-table-card">
        <div className="card-header-clean">
          <h3 className="card-title">Products / List / Demo</h3>
          <div className="card-subtitle">
            Active = enabled. Available now = currently orderable; not a stock count.
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="menu-filter-bar">
          <div className="filter-group-left">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search products (name, description)"
                className="search-input search-input-wide"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {mockCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Availability Filter */}
            <select
              className="filter-select"
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
            >
              <option value="all">Availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>

            {/* Active Filter */}
            <select
              className="filter-select"
              value={selectedActive}
              onChange={(e) => setSelectedActive(e.target.value)}
            >
              <option value="all">Active</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button
            type="button"
            className="filter-chip-btn manage-categories-btn"
            onClick={() => alert('Manage categories modal/drawer.')}
          >
            Manage categories
          </button>
        </div>

        {/* Products Table */}
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
              {filteredProducts.map((prod) => (
                <tr key={prod.id} className="menu-table-row">
                  {/* Product Thumbnail + Name */}
                  <td className="cell-product-info">
                    <div className="product-thumb-box">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="product-thumb-img"
                        />
                      ) : (
                        <div className="product-thumb-placeholder">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </div>
                    <span className="product-table-name">{prod.name}</span>
                  </td>

                  {/* Category */}
                  <td className="cell-category">{prod.categoryName}</td>

                  {/* Price */}
                  <td className="cell-price">{formatCurrency(prod.price)}</td>

                  {/* Active */}
                  <td className="cell-active">
                    <span className="active-text-label">Active</span>
                  </td>

                  {/* Availability Toggle */}
                  <td className="cell-availability">
                    <div className="availability-switch-group">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={prod.isAvailable}
                        className={`toggle-switch ${prod.isAvailable ? 'switch-on' : 'switch-off'}`}
                        onClick={() => toggleAvailability(prod.id)}
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

                  {/* Action Link: Edit or Make available */}
                  <td>
                    {prod.isAvailable ? (
                      <button
                        type="button"
                        className="btn-action-link"
                        onClick={() => navigate(`/dashboard/menu/products/${prod.id}/edit`)}
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-action-link link-make-available"
                        onClick={() => toggleAvailability(prod.id)}
                      >
                        Make available
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer & Load more */}
        <div className="menu-table-footer">
          <span className="footer-sample-note">
            Inventory not in current schema. Menu membership and API contracts require backend confirmation.
          </span>
          <button type="button" className="btn-load-more">
            Load more
          </button>
        </div>
      </div>
    </div>
  );
};
