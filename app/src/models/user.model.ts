/**
 * User Model
 * Defines user-related data structures
 */

export interface User {
  user_id: string;
  created_at: string | Date | null;
  last_updated: string | Date | null;

  // Basic Information
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string; // Computed field
  country?: string | null;
  gender?: string | null;
  dob?: string | Date | null;
  email?: string | null;
  profile_picture_url?: string | null;
  phone_number?: PhoneNumber | null;

  // Authentication
  auth_type?: string | null;
  is_email_verified?: boolean | null;
  is_phone_verified?: boolean | null;
  email_verified_at?: string | Date | null;
  phone_number_verified_at?: string | Date | null;
  last_sign_in_at?: string | Date | null;

  // Preferences
  bio?: string | null;
  theme?: string | null;
  profile_accessibility?: string | null;
  user_type?: string | null;
  user_name?: string | null;
  language?: string | null;

  // Status
  status?: string | null;
  timezone?: string | null;
  invited_by_user_id?: string | null;

  // Protection & Trash
  is_protected?: boolean | null;
  is_trashed?: boolean | null;

  // Status Model
  is_active?: boolean | null;
  is_verified?: boolean | null;
  is_profile_completed?: boolean | null;

  // Relations
  groups?: Group[];
  permissions?: string[];
}

export interface PhoneNumber {
  phone: string;
  country_code?: string;
}

import type { Permission } from './permission.model';

export interface UserProfile extends Omit<User, 'permissions'> {
  groups?: Group[];
  permissions?: Permission[];
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  verified_users: number;
  unverified_users: number;
}

export interface Group {
  group_id: string;
  name: string;
  codename: string;
  description?: string | null;
  is_system?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | Date | null;
  last_updated?: string | Date | null;
}

// Permission interface is exported from permission.model.ts

