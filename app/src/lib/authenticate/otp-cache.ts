/**
 * OTP Cache Management
 * Handles OTP generation, storage, and verification
 */

import { cache } from '@lib/cache/cache';
import { logger } from '@lib/logger/logger';
import { authConfig } from '@lib/config/env';
import { randomInt } from 'crypto';

/**
 * Check if the provided OTP is the admin/master OTP
 * Admin OTP grants super_admin access when used during signup
 */
export function isMasterOtp(otp: string): boolean {
  return otp === authConfig.adminOtp;
}

/**
 * Check if the provided OTP is the fast OTP (for development/testing)
 * Fast OTP bypasses normal OTP generation
 */
export function isFastOtp(otp: string): boolean {
  if (!authConfig.fastOtpEnabled) {
    return false;
  }
  return otp === authConfig.fastOtp;
}

/**
 * Generate numeric OTP of given length (default: 6)
 */
export function generateOtp(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[randomInt(0, digits.length)];
  }
  return otp;
}

/**
 * Normalize user ID for consistent cache key generation
 */
function normalizeUserId(userId: string): string {
  if (!userId) return userId;
  // Trim whitespace
  let normalized = userId.trim();
  // Lowercase emails (emails are case-insensitive)
  if (normalized.includes('@')) {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Generate OTP, store in cache, and return it
 * @param userId - User ID (email or phone)
 * @param ttl - Time to live in seconds (default: 600 = 10 minutes)
 * @returns Generated OTP
 */
export async function setOtp(userId: string, ttl: number = 600): Promise<string | null> {
  // Normalize userId: trim whitespace and lowercase emails
  const normalizedUserId = normalizeUserId(userId);
  const otp = generateOtp();
  const cacheKey = `otp:${normalizedUserId}`;
  
  try {
    await cache.set(cacheKey, otp, ttl);
    logger.info('OTP stored in cache', {
      module: 'OTP',
      extraData: {
        userId: normalizedUserId,
        cacheKey,
        otpLength: otp.length,
      },
    });
    return otp;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to store OTP in cache', {
      module: 'OTP',
      extraData: {
        userId: normalizedUserId,
        cacheKey,
        error: errorMessage,
      },
    });
    return null;
  }
}

/**
 * Verify OTP for given user_id
 * @param userId - User ID (email or phone)
 * @param otp - OTP to verify
 * @param deleteAfterVerify - Delete OTP after verification (default: true)
 * @returns True if valid, False otherwise
 */
export async function verifyOtp(
  userId: string,
  otp: string,
  deleteAfterVerify: boolean = true
): Promise<boolean> {
  // Normalize userId for consistent cache key lookup
  const normalizedUserId = normalizeUserId(userId);
  const cacheKey = `otp:${normalizedUserId}`;
  
  // Ensure OTP is a string for comparison
  const otpString = String(otp).trim();
  
  // 1. Admin/Master OTP check (grants super_admin access)
  if (isMasterOtp(otpString)) {
    logger.info('Admin OTP verified - will grant super_admin access', {
      module: 'OTP',
      extraData: { userId: normalizedUserId },
    });
    return true;
  }
  
  // 2. Fast OTP check (for development/testing - bypasses normal OTP)
  if (isFastOtp(otpString)) {
    logger.info('Fast OTP verified (development mode)', {
      module: 'OTP',
      extraData: { userId: normalizedUserId },
    });
    return true;
  }
  
  // 3. Get stored OTP from cache
  const storedOtp = await cache.get<string>(cacheKey);
  
  // Log for debugging
  if (!storedOtp) {
    logger.warning('OTP not found in cache', {
      module: 'OTP',
      extraData: {
        userId: normalizedUserId,
        cacheKey,
        providedOtp: otpString,
      },
    });
    return false;
  }
  
  // Ensure stored OTP is a string for comparison
  const storedOtpString = String(storedOtp).trim();
  
  // 4. Normal OTP check (compare as strings)
  if (storedOtpString === otpString) {
    logger.info('OTP verified successfully', {
      module: 'OTP',
      extraData: { userId: normalizedUserId },
    });
    if (deleteAfterVerify) {
      await cache.delete(cacheKey);
    }
    return true;
  }
  
  logger.warning('OTP mismatch', {
    module: 'OTP',
    extraData: {
      userId: normalizedUserId,
      cacheKey,
      providedOtp: otpString,
      storedOtp: storedOtpString,
    },
  });
  
  return false;
}

/**
 * Verify OTP without deleting (for multi-step verification)
 */
export async function verifyOtpKeep(
  userId: string,
  otp: string,
  deleteAfterVerify: boolean = true
): Promise<boolean> {
  const normalizedUserId = normalizeUserId(userId);
  const stored = await cache.get<string>(`otp:${normalizedUserId}`);
  
  if (!stored || String(stored).trim() !== String(otp).trim()) {
    return false;
  }
  
  if (deleteAfterVerify) {
    await cache.delete(`otp:${normalizedUserId}`);
  }
  
  return true;
}

/**
 * Delete OTP from cache
 */
export async function deleteOtp(userId: string): Promise<boolean> {
  const normalizedUserId = normalizeUserId(userId);
  await cache.delete(`otp:${normalizedUserId}`);
  return true;
}

