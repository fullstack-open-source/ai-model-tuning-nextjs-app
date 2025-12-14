/**
 * Onboarding Utility
 * Checks if user needs to complete onboarding steps
 */

import type { User } from '@models/user.model';

/**
 * Check if user needs to set password
 * For OTP signups, password might be the OTP itself, so we check if it's a temporary password
 */
export function needsPasswordSet(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // If user signed up with OTP, password might be the OTP code
  // We can check if password is too short (OTP is usually 6 digits) or matches OTP pattern
  // For now, we'll check if user has a proper password by checking if it's been updated
  // This is a simple check - in production, you might want to add a flag like `password_set` or `needs_password_set`
  
  // For OTP signups, the password is set to the OTP during signup
  // We'll assume if password length is 6 or less, it might be an OTP and needs to be changed
  // This is a heuristic - you might want to add a database flag instead
  return false; // We'll check this differently - via API or user metadata
}

/**
 * Check if user profile is complete
 * Profile is complete if is_profile_completed is true in database
 * Falls back to checking essential fields if is_profile_completed is not set
 */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // First check the database field is_profile_completed
  if ('is_profile_completed' in user && user.is_profile_completed === true) {
    return true;
  }
  
  // Fallback: Check essential fields if is_profile_completed is not set or false
  const hasFirstName = !!user.first_name && user.first_name.trim().length > 0;
  const hasLastName = !!user.last_name && user.last_name.trim().length > 0;
  
  // Profile is complete if both first and last name are set
  return hasFirstName && hasLastName;
}

/**
 * Get next onboarding step
 * Returns the path user should be redirected to based on onboarding status
 */
export function getNextOnboardingStep(user: User | null | undefined): string | null {
  // Check if profile is complete first (most important)
  if (!isProfileComplete(user)) {
    return '/complete-profile';
  }
  
  // Check if password needs to be set
  if (needsPasswordSet(user)) {
    return '/set-password';
  }
  
  // Onboarding complete
  return null;
}

