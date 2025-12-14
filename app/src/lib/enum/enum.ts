/**
 * Enum Constants
 * Matches NodeJS backend enum structure
 */

export const ProfileAccessibilityEnum = {
  public: 'public',
  private: 'private',
} as const;

export const UserTypeEnum = {
  admin: 'admin',
  customer: 'customer',
  business: 'business',
} as const;

export const ThemeEnum = {
  light: 'light',
  dark: 'dark',
  dynamic: 'dynamic',
} as const;

export const AuthTypeEnum = {
  phone: 'phone',
  google: 'google',
  apple: 'apple',
  anonymous: 'anonymous',
  email: 'email',
} as const;

export const LanguageStatusEnum = {
  en: 'en',
  ar: 'ar',
  ind: 'ind',
  fr: 'fr',
  es: 'es',
  de: 'de',
} as const;

export const UserStatusAuthEnum = {
  INACTIVE: 'Inactive',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DELETED: 'Deleted',
} as const;

