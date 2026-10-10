import type { SafeUser } from './auth';

export interface SafeRestaurantSummary {
  id: string;
  name: string;
  legalName: string | null;
  status: string;
  timezone: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafeBranchSummary {
  id: string;
  restaurantId: string;
  name: string;
  status: string;
  timezone: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerRestaurantContext {
  owner: SafeUser;
  restaurant: SafeRestaurantSummary | null;
  branches: SafeBranchSummary[];
}

export interface AuthorizedRestaurantContext {
  owner: SafeUser;
  restaurant: SafeRestaurantSummary;
  branches: SafeBranchSummary[];
}

export interface AuthorizedBranchContext extends AuthorizedRestaurantContext {
  branch: SafeBranchSummary;
}
