import React, { createContext, useContext, useState } from 'react';
import {
  SubscriptionPlanId,
  FeatureId,
  PLAN_DEFINITIONS,
  FEATURE_REGISTRY,
  PlanDefinition,
} from '../types/entitlements';

interface FeatureAccessResult {
  isEnabled: boolean;
  requiredPlan: SubscriptionPlanId;
  currentPlan: SubscriptionPlanId;
  isPreview: boolean;
}

interface EntitlementContextValue {
  currentPlanId: SubscriptionPlanId;
  currentPlan: PlanDefinition;
  setPlanId: (planId: SubscriptionPlanId) => void;
  hasAccess: (featureId: FeatureId) => boolean;
  getFeatureAccess: (featureId: FeatureId) => FeatureAccessResult;
}

const EntitlementContext = createContext<EntitlementContextValue | undefined>(undefined);

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // In the design references (Overview, Settings), Intelligence tier is the active preview tier
  const [currentPlanId, setCurrentPlanId] = useState<SubscriptionPlanId>('intelligence');

  const currentPlan = PLAN_DEFINITIONS[currentPlanId];

  const hasAccess = (featureId: FeatureId): boolean => {
    return currentPlan.features.includes(featureId);
  };

  const getFeatureAccess = (featureId: FeatureId): FeatureAccessResult => {
    const feature = FEATURE_REGISTRY[featureId];
    const isEnabled = hasAccess(featureId);
    return {
      isEnabled,
      requiredPlan: feature?.requiredPlan || 'operate',
      currentPlan: currentPlanId,
      isPreview: currentPlanId === 'intelligence' && (featureId === 'analytics' || featureId === 'ai_insights'),
    };
  };

  return (
    <EntitlementContext.Provider
      value={{
        currentPlanId,
        currentPlan,
        setPlanId: setCurrentPlanId,
        hasAccess,
        getFeatureAccess,
      }}
    >
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlements = (): EntitlementContextValue => {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementProvider');
  }
  return context;
};

export const useFeatureAccess = (featureId: FeatureId): FeatureAccessResult => {
  const { getFeatureAccess } = useEntitlements();
  return getFeatureAccess(featureId);
};
