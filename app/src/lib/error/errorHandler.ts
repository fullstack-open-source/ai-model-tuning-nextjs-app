/**
 * Centralized Error Handler
 * Handles all API errors and provides user-friendly messages
 * Client-safe version (no server-only dependencies)
 */

import type { ApiError } from '@models/api.model';

export interface ErrorMessage {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  code?: string;
}

/**
 * Error codes mapping to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Authentication Errors
  AUTH_INVALID_PAYLOAD: {
    title: 'Invalid Request',
    message: 'Please check your input and try again.',
    type: 'error',
  },
  AUTH_USER_ALREADY_EXISTS: {
    title: 'Account Already Exists',
    message: 'An account with this email or phone number already exists. Please log in instead.',
    type: 'warning',
  },
  AUTH_USER_NOT_FOUND: {
    title: 'Account Not Found',
    message: 'No account found with this email or phone number. Please sign up to create a new account.',
    type: 'error',
  },
  USER_NOT_FOUND: {
    title: 'Account Not Found',
    message: 'No account found with this email or phone number. Please sign up to create a new account.',
    type: 'error',
  },
  '1501': {
    title: 'Account Not Found',
    message: 'No account found with this email or phone number. Please sign up to create a new account.',
    type: 'error',
  },
  AUTH_INVALID_CREDENTIALS: {
    title: 'Incorrect Password',
    message: 'The password you entered is incorrect. Please check your password and try again, or use OTP to log in.',
    type: 'error',
  },
  '1201': {
    title: 'Incorrect Password',
    message: 'The password you entered is incorrect. Please check your password and try again, or use OTP to log in.',
    type: 'error',
  },
  AUTH_PASSWORD_INVALID_OLD: {
    title: 'Incorrect Current Password',
    message: 'The current password you entered is incorrect. Please try again.',
    type: 'error',
  },
  AUTH_OTP_INVALID: {
    title: 'Invalid Verification Code',
    message: 'The verification code you entered is incorrect or has expired. Please request a new code and try again.',
    type: 'error',
  },
  '1205': {
    title: 'Invalid Verification Code',
    message: 'The verification code you entered is incorrect or has expired. Please request a new code and try again.',
    type: 'error',
  },
  AUTH_OTP_EXPIRED: {
    title: 'Verification Code Expired',
    message: 'The verification code has expired. Please request a new code.',
    type: 'error',
  },
  AUTH_SIGNUP_FAILED: {
    title: 'Signup Failed',
    message: 'Unable to create your account. Please try again or contact support.',
    type: 'error',
  },
  AUTH_LOGIN_FAILED: {
    title: 'Login Failed',
    message: 'Unable to login. Please check your credentials and try again.',
    type: 'error',
  },
  AUTH_TOKEN_EXPIRED: {
    title: 'Session Expired',
    message: 'Your session has expired. Please login again.',
    type: 'warning',
  },
  AUTH_UNAUTHORIZED: {
    title: 'Unauthorized',
    message: 'You need to be logged in to access this resource.',
    type: 'error',
  },
  AUTH_FORBIDDEN: {
    title: 'Access Denied',
    message: 'You do not have permission to perform this action.',
    type: 'error',
  },

  // Network Errors
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    type: 'error',
  },
  TIMEOUT_ERROR: {
    title: 'Request Timeout',
    message: 'The request took too long. Please try again.',
    type: 'error',
  },

  // Validation Errors
  VALIDATION_ERROR: {
    title: 'Validation Error',
    message: 'Please check your input and try again.',
    type: 'error',
  },

  // Server Errors
  SERVER_ERROR: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    type: 'error',
  },
};

/**
 * Extract error message from API response
 */
export function extractErrorMessage(error: any): ErrorMessage {
  // Check if it's an API error response from Next.js API routes
  // Format: { success: false, error: { code: 1201, message: "...", reason: "..." } }
  if (error?.error) {
    const errorObj = error.error
    const errorCode = errorObj.code || errorObj.id
    const errorMessage = errorObj.message || errorObj.reason

    // Check if we have a custom message for this error code (by numeric code)
    if (errorCode) {
      const codeStr = String(errorCode)
      if (ERROR_MESSAGES[codeStr]) {
        return {
          ...ERROR_MESSAGES[codeStr],
          code: codeStr,
        };
      }
    }

    // Use error message from API if available
    if (errorMessage) {
      return {
        title: 'Error',
        message: errorMessage,
        type: 'error',
        code: String(errorCode || ''),
      };
    }
  }

  // Check if it's an API error with code (from axios response)
  if (error?.response?.data?.error) {
    const errorObj = error.response.data.error
    const errorCode = typeof errorObj === 'string' ? errorObj : (errorObj.code || errorObj.id)
    const errorData = error.response.data

    // Check if we have a custom message for this error code
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      return {
        ...ERROR_MESSAGES[errorCode],
        code: String(errorCode),
      };
    }

    // Use error message from API if available
    const apiMessage = typeof errorObj === 'object' 
      ? (errorObj.message || errorObj.reason)
      : (errorData.message || errorData.reason)
    if (apiMessage) {
      return {
        title: 'Error',
        message: apiMessage,
        type: 'error',
        code: String(errorCode || ''),
      };
    }
  }
  
  // Check if error has error code directly (from response.error.code)
  if (error?.error?.code) {
    const errorCode = error.error.code
    if (ERROR_MESSAGES[errorCode]) {
      return {
        ...ERROR_MESSAGES[errorCode],
        code: String(errorCode),
      };
    }
    if (error.error.message) {
      return {
        title: 'Error',
        message: error.error.message,
        type: 'error',
        code: String(errorCode),
      };
    }
  }

  // Check if it's a network error
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return ERROR_MESSAGES.TIMEOUT_ERROR;
  }

  if (error?.code === 'ERR_NETWORK' || !error?.response) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Check HTTP status codes
  if (error?.response?.status) {
    const status = error.response.status;
    if (status === 401) {
      return ERROR_MESSAGES.AUTH_UNAUTHORIZED;
    }
    if (status === 403) {
      return ERROR_MESSAGES.AUTH_FORBIDDEN;
    }
    if (status === 500 || status >= 500) {
      return ERROR_MESSAGES.SERVER_ERROR;
    }
  }

  // Default error message
  const message = error?.message || error?.response?.data?.message || 'An unexpected error occurred';
  return {
    title: 'Error',
    message,
    type: 'error',
  };
}

/**
 * Log error for debugging (client-safe)
 */
export function logError(error: any, context?: string): void {
  const errorMessage = extractErrorMessage(error);
  
  // Only log on server side, use console on client side
  if (typeof window === 'undefined') {
    // Server-side: dynamically import logger
    import('@lib/logger/logger').then(({ logger }) => {
      logger.error(`Error in ${context || 'API call'}`, {
        module: 'ErrorHandler',
        extraData: {
          error: errorMessage,
          originalError: error,
          code: errorMessage.code,
        },
      });
    }).catch(() => {
      // Fallback if logger fails to load
      console.error(`[ErrorHandler] Error in ${context || 'API call'}:`, errorMessage, error);
    });
  } else {
    // Client-side: use console
    console.error(`[ErrorHandler] Error in ${context || 'API call'}:`, errorMessage, error);
  }
}

/**
 * Handle error and return user-friendly message
 */
export function handleError(error: any, context?: string): ErrorMessage {
  logError(error, context);
  return extractErrorMessage(error);
}
