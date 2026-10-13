import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import { useEntitlements } from '../../context/EntitlementContext';
import { SubscriptionPlanId } from '../../types/entitlements';
import {
  INITIAL_STAFF_MEMBERS,
  INITIAL_BRANCH_SETTINGS,
  INITIAL_QR_SETTINGS,
  INITIAL_INTEGRATIONS,
  StaffMember,
  BranchSettings,
  QrMenuSettings,
  IntegrationService,
} from '../../services/settingsData';
import './SettingsPage.css';

type SettingsTab =
  | 'profile'
  | 'branches'
  | 'team'
  | 'qr_appearance'
  | 'subscription'
  | 'integrations';

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'profile';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const { restaurant, updateRestaurant } = useRestaurant();
  const { currentPlanId, setPlanId } = useEntitlements();

  // Form states for Restaurant Profile
  const [restaurantName, setRestaurantName] = useState<string>(restaurant.name || 'Basil & Brick');
  const [ownerContact, setOwnerContact] = useState<string>(restaurant.ownerEmail || 'owner@basilbrick.example');
  const [primaryBranch, setPrimaryBranch] = useState<string>('Hazratganj, Lucknow');
  const [currencyPolicy, setCurrencyPolicy] = useState<string>('INR');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // States for other tabs
  const [branches] = useState<BranchSettings[]>(INITIAL_BRANCH_SETTINGS);
  const [staff] = useState<StaffMember[]>(INITIAL_STAFF_MEMBERS);
  const [qrSettings, setQrSettings] = useState<QrMenuSettings>(INITIAL_QR_SETTINGS);
  const [integrations] = useState<IntegrationService[]>(INITIAL_INTEGRATIONS);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateRestaurant({
      name: restaurantName,
      ownerEmail: ownerContact,
    });
    setSaveSuccessMessage('Restaurant profile updated successfully!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handlePlanSelect = (plan: SubscriptionPlanId) => {
    setPlanId(plan);
  };

  return (
    <div className="settings-page">
      {/* Header section with page title & subtitle matching settings.png */}
      <div className="settings-header-section">
        <h1 className="settings-page-title">Restaurant & Branch</h1>
        <p className="settings-page-subtitle">
          Restaurant, branch and staff context · demo values · backend authorization required.
        </p>
      </div>

      {saveSuccessMessage && (
        <div className="settings-toast-banner" role="status">
          <span className="toast-icon">✓</span>
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="settings-layout-grid">
        {/* Left Side: Settings Nav Card */}
        <div className="settings-sidebar-card">
          <h2 className="settings-menu-title">Settings</h2>
          <nav className="settings-menu-nav">
            <button
              type="button"
              className={`settings-menu-item ${activeTab === 'profile' ? 'active' : ''}`}
              id="tab-restaurant-profile"
              onClick={() => handleTabChange('profile')}
            >
              Restaurant profile
            </button>

            <button
              type="button"
              className={`settings-menu-item ${activeTab === 'branches' ? 'active' : ''}`}
              id="tab-branches"
              onClick={() => handleTabChange('branches')}
            >
              Branches
            </button>

            <button
              type="button"
              className={`settings-menu-item ${activeTab === 'team' ? 'active' : ''}`}
              id="tab-team-permissions"
              onClick={() => handleTabChange('team')}
            >
              Team & permissions
            </button>

            <button
              type="button"
              className={`settings-menu-item ${activeTab === 'qr_appearance' ? 'active' : ''}`}
              id="tab-qr-appearance"
              onClick={() => handleTabChange('qr_appearance')}
            >
              QR menu appearance
            </button>

            <button
              type="button"
              className={`settings-menu-item ${activeTab === 'subscription' ? 'active' : ''}`}
              id="tab-subscription-features"
              onClick={() => handleTabChange('subscription')}
            >
              Subscription & features
            </button>

            <button
              type="button"
              className={`settings-menu-item ${activeTab === 'integrations' ? 'active' : ''}`}
              id="tab-integrations"
              onClick={() => handleTabChange('integrations')}
            >
              Integrations
            </button>
          </nav>
        </div>

        {/* Right Side: Active Settings Panel */}
        <div className="settings-content-column">
          {/* ================= TAB 1: RESTAURANT PROFILE (Default in settings.png) ================= */}
          {(activeTab === 'profile' || activeTab === 'subscription') && (
            <>
              {activeTab === 'profile' && (
                <div className="settings-card" id="card-restaurant-profile">
                  <div className="settings-card-header">
                    <h2 className="settings-card-title">Restaurant profile</h2>
                    <p className="settings-card-subtitle">
                      Authenticated restaurant context · supported profile fields only.
                    </p>
                  </div>

                  <form className="settings-profile-form" onSubmit={handleSaveProfile}>
                    <div className="form-fields-2x2-grid">
                      <div className="form-field-group">
                        <label htmlFor="input-restaurant-name" className="field-label-uppercase">
                          RESTAURANT NAME
                        </label>
                        <input
                          type="text"
                          id="input-restaurant-name"
                          className="settings-text-input"
                          value={restaurantName}
                          onChange={(e) => setRestaurantName(e.target.value)}
                          placeholder="Basil & Brick"
                          required
                        />
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="input-owner-contact" className="field-label-uppercase">
                          OWNER CONTACT
                        </label>
                        <input
                          type="email"
                          id="input-owner-contact"
                          className="settings-text-input"
                          value={ownerContact}
                          onChange={(e) => setOwnerContact(e.target.value)}
                          placeholder="owner@basilbrick.example"
                          required
                        />
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="input-primary-branch" className="field-label-uppercase">
                          PRIMARY BRANCH
                        </label>
                        <input
                          type="text"
                          id="input-primary-branch"
                          className="settings-text-input"
                          value={primaryBranch}
                          onChange={(e) => setPrimaryBranch(e.target.value)}
                          placeholder="Hazratganj, Lucknow"
                        />
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="select-currency-policy" className="field-label-uppercase">
                          CURRENCY · PRESENTATION POLICY
                        </label>
                        <select
                          id="select-currency-policy"
                          className="settings-select-input"
                          value={currencyPolicy}
                          onChange={(e) => setCurrencyPolicy(e.target.value)}
                        >
                          <option value="INR">INR — Indian Rupee ⌄ · DEMO</option>
                          <option value="USD">USD — US Dollar · DEMO</option>
                          <option value="EUR">EUR — Euro · DEMO</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-submit-row">
                      <button type="submit" className="btn-save-settings" id="btn-save-profile">
                        Save changes
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Card 2: Subscription & feature access (Present on both profile & subscription views) */}
              <div className="settings-card" id="card-subscription-access">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Subscription & feature access</h2>
                  <p className="settings-card-subtitle">
                    Concept only. Plans/entitlements are not confirmed schema fields; no agent execution is implied.
                  </p>
                </div>

                <div className="subscription-options-list">
                  {/* Option 1: Operate */}
                  <div
                    className={`subscription-plan-option ${currentPlanId === 'operate' ? 'selected' : ''}`}
                    onClick={() => handlePlanSelect('operate')}
                    id="plan-option-operate"
                  >
                    <div className="plan-radio-circle">
                      {currentPlanId === 'operate' && <div className="plan-radio-dot" />}
                    </div>
                    <div className="plan-option-content">
                      <div className="plan-option-title">Operate</div>
                      <div className="plan-option-desc">
                        Orders, menu, tables, coupons, basic daily operations
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Intelligence (Selected Default in PNG) */}
                  <div
                    className={`subscription-plan-option ${currentPlanId === 'intelligence' ? 'selected' : ''}`}
                    onClick={() => handlePlanSelect('intelligence')}
                    id="plan-option-intelligence"
                  >
                    <div className="plan-radio-circle">
                      {currentPlanId === 'intelligence' && <div className="plan-radio-dot" />}
                    </div>
                    <div className="plan-option-content">
                      <div className="plan-title-row">
                        <span className="plan-option-title">Intelligence</span>
                        <span className="badge-preview-tag">PREVIEW</span>
                      </div>
                      <div className="plan-option-desc">
                        Operate plus advanced analytics, AI insights and business copilot
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Autonomous */}
                  <div
                    className={`subscription-plan-option ${currentPlanId === 'autonomous' ? 'selected' : ''}`}
                    onClick={() => handlePlanSelect('autonomous')}
                    id="plan-option-autonomous"
                  >
                    <div className="plan-radio-circle">
                      {currentPlanId === 'autonomous' && <div className="plan-radio-dot" />}
                    </div>
                    <div className="plan-option-content">
                      <div className="plan-option-title">Autonomous</div>
                      <div className="plan-option-desc">
                        Intelligence plus AI agents and controlled actions
                      </div>
                    </div>
                  </div>
                </div>

                <p className="settings-bottom-caveat">
                  Prototype only: backend must enforce every entitlement for all endpoints and actions; hiding navigation is not access control.
                </p>
              </div>
            </>
          )}

          {/* ================= TAB 2: BRANCHES ================= */}
          {activeTab === 'branches' && (
            <div className="settings-card" id="card-branches-settings">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Branch Locations</h2>
                  <p className="settings-card-subtitle">
                    Manage branch dining capacities, GST registration, and order routing.
                  </p>
                </div>
                <button type="button" className="btn-add-secondary">
                  + Add branch
                </button>
              </div>

              <div className="branches-list-container">
                {branches.map((b) => (
                  <div key={b.id} className="branch-setting-item">
                    <div className="branch-info-header">
                      <div>
                        <h3 className="branch-item-name">{b.name}</h3>
                        <p className="branch-item-address">{b.address}, {b.city}</p>
                      </div>
                      <span className={`branch-status-pill ${b.isActive ? 'active' : 'inactive'}`}>
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="branch-meta-row">
                      <span><strong>Phone:</strong> {b.phone}</span>
                      <span><strong>GSTIN:</strong> {b.gstNumber}</span>
                      <span><strong>Tables:</strong> {b.tableCount} tables configured</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 3: TEAM & PERMISSIONS ================= */}
          {activeTab === 'team' && (
            <div className="settings-card" id="card-team-settings">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Team & Staff Roles</h2>
                  <p className="settings-card-subtitle">
                    RBAC role permissions for owner, managers, and kitchen leads.
                  </p>
                </div>
                <button type="button" className="btn-add-secondary">
                  + Invite staff
                </button>
              </div>

              <div className="staff-table-wrapper">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role</th>
                      <th>Branch Access</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="staff-name-col">
                            <span className="staff-name">{s.name}</span>
                            <span className="staff-email">{s.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className="staff-role-badge">{s.role}</span>
                        </td>
                        <td className="staff-branch-cell">{s.branch}</td>
                        <td>
                          <span className="staff-status-active">{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 4: QR MENU APPEARANCE ================= */}
          {activeTab === 'qr_appearance' && (
            <div className="settings-card" id="card-qr-appearance-settings">
              <div className="settings-card-header">
                <h2 className="settings-card-title">QR Menu Brand Customization</h2>
                <p className="settings-card-subtitle">
                  Configure the mobile web app appearance customers see when scanning table QR codes.
                </p>
              </div>

              <div className="qr-settings-grid">
                <div className="form-field-group">
                  <label className="field-label-uppercase">BRAND PRIMARY COLOR</label>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      value={qrSettings.brandPrimaryColor}
                      onChange={(e) =>
                        setQrSettings({ ...qrSettings, brandPrimaryColor: e.target.value })
                      }
                      className="color-picker-input"
                    />
                    <span className="color-hex-label">{qrSettings.brandPrimaryColor} (Restrauque Red)</span>
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="field-label-uppercase">WELCOME HEADING</label>
                  <input
                    type="text"
                    className="settings-text-input"
                    value={qrSettings.welcomeHeading}
                    onChange={(e) =>
                      setQrSettings({ ...qrSettings, welcomeHeading: e.target.value })
                    }
                  />
                </div>

                <div className="form-field-group full-width">
                  <label className="field-label-uppercase">TAGLINE</label>
                  <input
                    type="text"
                    className="settings-text-input"
                    value={qrSettings.tagline}
                    onChange={(e) =>
                      setQrSettings({ ...qrSettings, tagline: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-submit-row">
                <button
                  type="button"
                  className="btn-save-settings"
                  onClick={() => {
                    setSaveSuccessMessage('QR Menu appearance updated!');
                    setTimeout(() => setSaveSuccessMessage(null), 3000);
                  }}
                >
                  Save QR Branding
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 6: INTEGRATIONS ================= */}
          {activeTab === 'integrations' && (
            <div className="settings-card" id="card-integrations-settings">
              <div className="settings-card-header">
                <h2 className="settings-card-title">Hardware & Service Integrations</h2>
                <p className="settings-card-subtitle">
                  Connected POS thermal printers, payment gateways, and database pipelines.
                </p>
              </div>

              <div className="integrations-grid">
                {integrations.map((item) => (
                  <div key={item.id} className="integration-item-card">
                    <div className="integration-header">
                      <span className="integration-category-tag">{item.category}</span>
                      <span className={`integration-status-pill ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.status}
                      </span>
                    </div>
                    <h3 className="integration-name">{item.name}</h3>
                    <p className="integration-desc">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
