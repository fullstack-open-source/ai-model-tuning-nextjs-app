/**
 * Authentication Model
 * Defines authentication-related data structures
 */

export interface AuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  session_token?: string | null;
  session_id?: string | null;
  token_type?: string | null;
  expires_in?: number | null;
}

import type { Group } from '@models/user.model';

export interface AuthUser {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_name?: string | null;
  profile_picture_url?: string | null;
  groups?: Group[];
  permissions?: string[];
}

export interface LoginRequest {
  user_id: string; // email or phone
  password?: string;
  otp?: string;
  channel?: 'email' | 'sms' | 'whatsapp';
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  session_token: string;
  session_id: string;
  token_type: string;
  user: AuthUser;
  groups?: Group[];
  permissions?: string[];
}

export interface SignupRequest {
  user_id: string; // email or phone
  channel: 'email' | 'sms' | 'whatsapp';
}

export interface VerifyRequest {
  user_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  otp: string;
}

export interface OtpRequest {
  user_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
}

export interface OtpResponse {
  message: string;
  user_id: string;
  channel: string;
  expires_in?: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

