import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import { useEntitlements } from '../../context/EntitlementContext';
import { SubscriptionPlanId } from '../../types/entitlements';
import { restaurantService, SafeBranchProfile } from '../../services/restaurantService';
import { ApiClientError } from '../../services/apiClient';
import {
  INITIAL_STAFF_MEMBERS,
  INITIAL_QR_SETTINGS,
  INITIAL_INTEGRATIONS,
  StaffMember,
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

  const { restaurant, reloadContext } = useRestaurant();
  const { currentPlanId, setPlanId } = useEntitlements();

  // Form states for Restaurant Profile
  const [restaurantName, setRestaurantName] = useState<string>(restaurant?.name || '');
  const [ownerContact, setOwnerContact] = useState<string>(restaurant?.ownerEmail || '');
  const [restaurantPhone, setRestaurantPhone] = useState<string>('');
  const [restaurantAddress, setRestaurantAddress] = useState<string>('');
  const [restaurantCity, setRestaurantCity] = useState<string>('Lucknow');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // States for real branches
  const [branches, setBranches] = useState<SafeBranchProfile[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState<boolean>(false);
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [newBranchCity, setNewBranchCity] = useState<string>('Lucknow');
  const [newBranchAddress, setNewBranchAddress] = useState<string>('');
  const [newBranchPhone, setNewBranchPhone] = useState<string>('');
  const [isSavingBranch, setIsSavingBranch] = useState<boolean>(false);

  // States for preview tabs
  const [staff] = useState<StaffMember[]>(INITIAL_STAFF_MEMBERS);
  const [qrSettings, setQrSettings] = useState<QrMenuSettings>(INITIAL_QR_SETTINGS);
  const [integrations] = useState<IntegrationService[]>(INITIAL_INTEGRATIONS);

  // Load backend restaurant profile
  const loadProfile = useCallback(async () => {
    try {
      const res = await restaurantService.getRestaurantProfile();
      if (res.restaurant) {
        setRestaurantName(res.restaurant.name);
        if (restaurant?.ownerEmail) setOwnerContact(restaurant.ownerEmail);
      }
    } catch {
      // Keep existing context state if fetch fails
    }
  }, [restaurant]);

  // Load backend branches
  const loadBranches = useCallback(async () => {
    setIsLoadingBranches(true);
    setBranchError(null);
    try {
      const res = await restaurantService.getBranches();
      setBranches(res.branches);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load branches';
      setBranchError(msg);
    } finally {
      setIsLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab === 'branches') {
      loadBranches();
    }
  }, [activeTab, loadBranches]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSaveSuccessMessage(null);
    setIsSavingProfile(true);

    try {
      await restaurantService.updateRestaurantProfile({
        name: restaurantName.trim(),
        email: ownerContact.trim() ? ownerContact.trim() : undefined,
        phone: restaurantPhone.trim() ? restaurantPhone.trim() : undefined,
        address: restaurantAddress.trim() ? restaurantAddress.trim() : undefined,
        city: restaurantCity.trim() ? restaurantCity.trim() : undefined,
      });

      await reloadContext();
      setSaveSuccessMessage('Restaurant profile updated successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setProfileError(err.message);
      } else if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError('Failed to update restaurant profile');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchError(null);

    if (!newBranchName.trim()) {
      setBranchError('Branch name is required');
      return;
    }

    setIsSavingBranch(true);
    try {
      await restaurantService.createBranch({
        name: newBranchName.trim(),
        city: newBranchCity.trim() ? newBranchCity.trim() : undefined,
        address: newBranchAddress.trim() ? newBranchAddress.trim() : undefined,
        phone: newBranchPhone.trim() ? newBranchPhone.trim() : undefined,
      });

      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchPhone('');
      setIsAddBranchOpen(false);
      await loadBranches();
      await reloadContext();
      setSaveSuccessMessage('Branch created successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setBranchError(err.message);
      } else if (err instanceof Error) {
        setBranchError(err.message);
      } else {
        setBranchError('Failed to create branch');
      }
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleToggleBranchStatus = async (branchId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await restaurantService.updateBranch(branchId, { status: nextStatus });
      await loadBranches();
      await reloadContext();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update branch status';
      setBranchError(msg);
    }
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
          Manage your verified restaurant profile, branch locations, and system configuration.
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
          {/* ================= TAB 1: RESTAURANT PROFILE ================= */}
          {(activeTab === 'profile' || activeTab === 'subscription') && (
            <>
              {activeTab === 'profile' && (
                <div className="settings-card" id="card-restaurant-profile">
                  <div className="settings-card-header">
                    <h2 className="settings-card-title">Restaurant profile</h2>
                    <p className="settings-card-subtitle">
                      Authenticated restaurant context · ID: {restaurant?.id || 'Loaded from backend'}
                    </p>
                  </div>

                  {profileError && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'rgba(229, 57, 53, 0.1)',
                        border: '1px solid rgba(229, 57, 53, 0.3)',
                        color: '#ff6c64',
                        fontSize: '13px',
                        marginBottom: '16px',
                      }}
                    >
                      {profileError}
                    </div>
                  )}

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
                          placeholder="e.g. Basil & Brick"
                          required
                          disabled={isSavingProfile}
                        />
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="input-owner-contact" className="field-label-uppercase">
                          OWNER CONTACT EMAIL
                        </label>
                        <input
                          type="email"
                          id="input-owner-contact"
                          className="settings-text-input"
                          value={ownerContact}
                          onChange={(e) => setOwnerContact(e.target.value)}
                          placeholder="owner@restaurant.com"
                          disabled={isSavingProfile}
                        />
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="input-restaurant-phone" className="field-label-uppercase">
                          PHONE
                        </label>
                        <input
                          type="tel"
                          id="input-restaurant-phone"
                          className="settings-text-input"
                          value={restaurantPhone}
                          onChange={(e) => setRestaurantPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          disabled={isSavingProfile}
                        />
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="input-restaurant-city" className="field-label-uppercase">
                          CITY
                        </label>
                        <input
                          type="text"
                          id="input-restaurant-city"
                          className="settings-text-input"
                          value={restaurantCity}
                          onChange={(e) => setRestaurantCity(e.target.value)}
                          placeholder="Lucknow"
                          disabled={isSavingProfile}
                        />
                      </div>

                      <div className="form-field-group full-width">
                        <label htmlFor="input-restaurant-address" className="field-label-uppercase">
                          ADDRESS
                        </label>
                        <input
                          type="text"
                          id="input-restaurant-address"
                          className="settings-text-input"
                          value={restaurantAddress}
                          onChange={(e) => setRestaurantAddress(e.target.value)}
                          placeholder="e.g. M.G. Marg, Hazratganj"
                          disabled={isSavingProfile}
                        />
                      </div>
                    </div>

                    <div className="form-submit-row">
                      <button
                        type="submit"
                        className="btn-save-settings"
                        id="btn-save-profile"
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Card 2: Subscription & feature access */}
              <div className="settings-card" id="card-subscription-access">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Subscription & feature access</h2>
                  <p className="settings-card-subtitle">
                    Concept only. Plans and entitlements are preview indicators in this build.
                  </p>
                </div>

                <div className="subscription-options-list">
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
                        Operate plus advanced analytics, AI insights and business intelligence
                      </div>
                    </div>
                  </div>

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
                        Intelligence plus AI agents and automated workflows
                      </div>
                    </div>
                  </div>
                </div>
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
                    Live branch locations scoped to restaurant: {restaurant?.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-add-secondary"
                  onClick={() => setIsAddBranchOpen(!isAddBranchOpen)}
                >
                  {isAddBranchOpen ? 'Cancel' : '+ Add branch'}
                </button>
              </div>

              {branchError && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(229, 57, 53, 0.1)',
                    border: '1px solid rgba(229, 57, 53, 0.3)',
                    color: '#ff6c64',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {branchError}
                </div>
              )}

              {/* Inline Add Branch Form */}
              {isAddBranchOpen && (
                <form
                  onSubmit={handleCreateBranch}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '24px',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 14px' }}>
                    New Branch Configuration
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                        BRANCH NAME *
                      </label>
                      <input
                        type="text"
                        required
                        className="settings-text-input"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        placeholder="e.g. Gomti Nagar Branch"
                        disabled={isSavingBranch}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                        PHONE
                      </label>
                      <input
                        type="tel"
                        className="settings-text-input"
                        value={newBranchPhone}
                        onChange={(e) => setNewBranchPhone(e.target.value)}
                        placeholder="10-digit phone"
                        disabled={isSavingBranch}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                        ADDRESS
                      </label>
                      <input
                        type="text"
                        className="settings-text-input"
                        value={newBranchAddress}
                        onChange={(e) => setNewBranchAddress(e.target.value)}
                        placeholder="Street or Mall"
                        disabled={isSavingBranch}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                        CITY
                      </label>
                      <input
                        type="text"
                        className="settings-text-input"
                        value={newBranchCity}
                        onChange={(e) => setNewBranchCity(e.target.value)}
                        placeholder="Lucknow"
                        disabled={isSavingBranch}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-save-settings"
                    disabled={isSavingBranch}
                  >
                    {isSavingBranch ? 'Creating branch...' : 'Create Branch'}
                  </button>
                </form>
              )}

              {isLoadingBranches ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                  Loading branches from backend...
                </div>
              ) : branches.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                  No branches found for this restaurant.
                </div>
              ) : (
                <div className="branches-list-container">
                  {branches.map((b) => (
                    <div key={b.id} className="branch-setting-item">
                      <div className="branch-info-header">
                        <div>
                          <h3 className="branch-item-name">{b.name}</h3>
                          <p className="branch-item-address">
                            {b.address ? `${b.address}, ` : ''}{b.city || 'Lucknow'} · <small style={{ color: '#6b7280' }}>ID: {b.id}</small>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleBranchStatus(b.id, b.status)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="Click to toggle active/inactive status"
                        >
                          <span className={`branch-status-pill ${b.status === 'active' ? 'active' : 'inactive'}`}>
                            {b.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      </div>

                      <div className="branch-meta-row">
                        <span><strong>Phone:</strong> {b.phone || 'Not configured'}</span>
                        <span><strong>Timezone:</strong> {b.timezone}</span>
                        <span><strong>Status:</strong> {b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: TEAM & PERMISSIONS (Preview) ================= */}
          {activeTab === 'team' && (
            <div className="settings-card" id="card-team-settings">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Team & Staff Roles</h2>
                  <p className="settings-card-subtitle">
                    Staff management preview · role permissions for managers and kitchen leads.
                  </p>
                </div>
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

          {/* ================= TAB 4: QR MENU APPEARANCE (Preview) ================= */}
          {activeTab === 'qr_appearance' && (
            <div className="settings-card" id="card-qr-appearance-settings">
              <div className="settings-card-header">
                <h2 className="settings-card-title">QR Menu Brand Customization</h2>
                <p className="settings-card-subtitle">
                  Configure brand styling displayed on table menus.
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
            </div>
          )}

          {/* ================= TAB 5: INTEGRATIONS (Preview) ================= */}
          {activeTab === 'integrations' && (
            <div className="settings-card" id="card-integrations-settings">
              <div className="settings-card-header">
                <h2 className="settings-card-title">Hardware & Integration Connectors</h2>
                <p className="settings-card-subtitle">
                  External services, thermal printers, and payment providers.
                </p>
              </div>

              <div className="integrations-list">
                {integrations.map((item) => (
                  <div key={item.id} className="integration-item-card">
                    <div className="integration-item-header">
                      <div>
                        <h3 className="integration-name">{item.name}</h3>
                        <p className="integration-desc">{item.description}</p>
                      </div>
                      <span className={`integration-status-tag ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.status}
                      </span>
                    </div>
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
