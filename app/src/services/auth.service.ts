/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import { createApiService, createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  VerifyRequest,
  OtpRequest,
  OtpResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  AuthTokens,
} from '@models/auth.model';
import type { ApiResponse } from '@models/api.model';

class AuthService {
  private api: ApiService;

  constructor() {
    this.api = createPublicApiService();
  }

  /**
   * Send OTP to user
   */
  async sendOtp(data: OtpRequest): Promise<ApiResponse<OtpResponse>> {
    return this.api.post<ApiResponse<OtpResponse>>('/auth/send-one-time-password', data);
  }

  /**
   * Verify OTP
   */
  async verifyOtp(data: VerifyRequest): Promise<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/verify-one-time-password', data);
  }

  /**
   * Login with password
   */
  async loginWithPassword(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/login-with-password', {
      username: data.user_id,
      password: data.password,
    });
  }

  /**
   * Login with OTP
   */
  async loginWithOtp(data: VerifyRequest): Promise<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/login-with-otp', data);
  }

  /**
   * Signup/Register (send OTP)
   */
  async signup(data: SignupRequest): Promise<ApiResponse<OtpResponse>> {
    return this.api.post<ApiResponse<OtpResponse>>('/auth/send-one-time-password', data);
  }

  /**
   * Verify signup (complete registration)
   */
  async verifySignup(data: VerifyRequest): Promise<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/verify', data);
  }

  /**
   * Refresh access token
   */
  async refreshToken(data: RefreshTokenRequest): Promise<ApiResponse<RefreshTokenResponse>> {
    return this.api.post<ApiResponse<RefreshTokenResponse>>('/auth/refresh-token', data);
  }

  /**
   * Check if user exists
   */
  async checkUserAvailability(userId: string): Promise<ApiResponse<{ available: boolean }>> {
    return this.api.post<ApiResponse<{ available: boolean }>>('/auth/check-user-availability', {
      user_id: userId,
    });
  }

  /**
   * Check user status (exists and has password)
   */
  async checkUserStatus(userId: string): Promise<ApiResponse<{ exists: boolean; has_password: boolean; is_active?: boolean; is_verified?: boolean }>> {
    return this.api.post<ApiResponse<{ exists: boolean; has_password: boolean; is_active?: boolean; is_verified?: boolean }>>('/auth/check-user-status', {
      user_id: userId,
    });
  }

  /**
   * Logout
   */
  async logout(): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/logout', {});
  }

  /**
   * Get token info
   */
  async getTokenInfo(token?: string): Promise<ApiResponse<any>> {
    if (token) {
      return this.api.post<ApiResponse<any>>('/auth/token-info', { token });
    }
    return this.api.get<ApiResponse<any>>('/auth/token-info');
  }

  /**
   * Set password for authenticated user
   */
  async setPassword(password: string, confirmPassword: string): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/auth/set-password', {
      password,
      confirm_password: confirmPassword,
    });
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(
    userId: string,
    otp: string,
    password: string,
    confirmPassword: string
  ): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/auth/forget-password', {
      user_id: userId,
      otp,
      password,
      confirm_password: confirmPassword,
    });
  }

  /**
   * Verify email and phone
   */
  async verifyEmailAndPhone(data: VerifyRequest): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/auth/verify-email-and-phone', data);
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(data: { code: string; session_token?: string }): Promise<ApiResponse<LoginResponse>> {
    return this.api.post<ApiResponse<LoginResponse>>('/auth/verify-2fa', data);
  }
}

// Export singleton instance
export const authService = new AuthService();
