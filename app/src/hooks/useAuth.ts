/**
 * useAuth Hook
 * Custom hook for authentication operations
 */

import { useCallback } from "react";
import { useAuth } from "@context/AuthContext";
import { authService } from "@services/auth.service";
import { permissionService } from "@services/permission.service";
import { createPublicApiService } from "@lib/api/ApiServiceFactory";
import type { LoginRequest, VerifyRequest, SignupRequest } from "@models/auth.model";
import type { ApiResponse } from "@models/api.model";
import type { Group } from "@models/user.model";

export const useAuthHook = () => {
  const { user, tokens, login, logout, fetchWithAuth, loading, updatePermissions } = useAuth();
  
  // Helper: Fetch and store permissions/groups after authentication (with caching)
  const fetchUserPermissions = useCallback(async (tokenData: { session_token?: string; access_token?: string; token_type?: string }) => {
    try {
      // Check localStorage cache first (fastest)
      if (typeof window !== 'undefined') {
        const cachedGroups = localStorage.getItem('auth_groups');
        const cachedPermissions = localStorage.getItem('auth_permissions');
        
        if (cachedGroups && cachedPermissions) {
          try {
            const groups: Group[] = JSON.parse(cachedGroups);
            const permissions: string[] = JSON.parse(cachedPermissions);
            
            // If we have valid cached data and tokens, return immediately
            if (groups.length > 0 || permissions.length > 0) {
              // Still fetch in background to refresh cache, but don't wait
              const headers: Record<string, string> = {};
              if (tokenData.session_token) {
                headers["X-Session-Token"] = tokenData.session_token;
              } else if (tokenData.access_token && tokenData.token_type) {
                headers["Authorization"] = `${tokenData.token_type} ${tokenData.access_token}`;
              }
              
              const authedApi = createPublicApiService(headers);
              permissionService.setAuthApi(authedApi);
              
              // Refresh in background (don't await)
              Promise.all([
                permissionService.getMyGroups(),
                permissionService.getMyPermissions(),
              ]).catch(() => {
                // Silently fail background refresh
              });
              
              return { groups, permissions };
            }
          } catch (e) {
            // Invalid cache, continue to API fetch
          }
        }
      }
      
      // Fetch from API (with cache support in service)
      const headers: Record<string, string> = {};
      if (tokenData.session_token) {
        headers["X-Session-Token"] = tokenData.session_token;
      } else if (tokenData.access_token && tokenData.token_type) {
        headers["Authorization"] = `${tokenData.token_type} ${tokenData.access_token}`;
      }
      
      const authedApi = createPublicApiService(headers);
      permissionService.setAuthApi(authedApi);
      
      const [groupsResponse, permissionsResponse] = await Promise.all([
        permissionService.getMyGroups(),
        permissionService.getMyPermissions(),
      ]);
      
      const groups: Group[] = groupsResponse?.data || [];
      const permissions: string[] = permissionsResponse?.data || [];
      
      return { groups, permissions };
    } catch (error) {
      console.error("Failed to fetch user permissions:", error);
      // Try to return cached data even if API fails
      if (typeof window !== 'undefined') {
        try {
          const cachedGroups = localStorage.getItem('auth_groups');
          const cachedPermissions = localStorage.getItem('auth_permissions');
          if (cachedGroups && cachedPermissions) {
            return {
              groups: JSON.parse(cachedGroups),
              permissions: JSON.parse(cachedPermissions),
            };
          }
        } catch (e) {
          // Fall through to empty arrays
        }
      }
      return { groups: [], permissions: [] };
    }
  }, []);

  const signup = useCallback(async (data: SignupRequest) => {
    const response = await authService.signup(data);
    if (response?.success) {
      return response;
    }
    throw new Error(response?.message || "Signup failed");
  }, []);

  const verifySignup = useCallback(async (data: VerifyRequest) => {
    const response = await authService.verifySignup(data);
    if (response?.success && response.data) {
      const { user: userData, groups: responseGroups, permissions: responsePermissions, ...tokenData } = response.data;
      
      // Use groups/permissions from response if available (avoids extra API calls)
      // Otherwise fetch from API
      let groups: Group[] = responseGroups || [];
      let permissions: string[] = responsePermissions || [];
      
      if (!responseGroups?.length && !responsePermissions?.length) {
        const fetched = await fetchUserPermissions(tokenData);
        groups = fetched.groups;
        permissions = fetched.permissions;
      }
      
      login(userData, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        session_token: tokenData.session_token,
        session_id: tokenData.session_id,
        token_type: tokenData.token_type,
      }, groups, permissions);
      return response;
    }
    throw new Error(response?.message || "Verification failed");
  }, [login, fetchUserPermissions]);

  const loginWithPassword = useCallback(async (data: LoginRequest) => {
    const response = await authService.loginWithPassword(data);
    
    // Debug: Log raw response
    console.log('🔑 loginWithPassword raw response:', {
      success: response?.success,
      hasData: !!response?.data,
      dataKeys: response?.data ? Object.keys(response.data) : [],
    });
    
    if (response?.success && response.data) {
      const { user: userData, groups: responseGroups, permissions: responsePermissions, ...tokenData } = response.data;
      
      // Debug: Log extracted data
      console.log('🔑 loginWithPassword extracted:', {
        userId: userData?.user_id,
        groupCount: responseGroups?.length || 0,
        permissionCount: responsePermissions?.length || 0,
        sampleGroups: responseGroups?.slice(0, 2)?.map((g: any) => g?.codename),
        samplePermissions: responsePermissions?.slice(0, 5),
      });
      
      // Use groups/permissions from response if available (avoids extra API calls)
      // Otherwise fetch from API
      let groups: Group[] = responseGroups || [];
      let permissions: string[] = responsePermissions || [];
      
      if (!responseGroups?.length && !responsePermissions?.length) {
        console.log('🔑 No groups/permissions in response, fetching from API...');
        const fetched = await fetchUserPermissions(tokenData);
        groups = fetched.groups;
        permissions = fetched.permissions;
        console.log('🔑 Fetched from API:', {
          groupCount: groups.length,
          permissionCount: permissions.length,
        });
      }
      
      login(userData, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        session_token: tokenData.session_token,
        session_id: tokenData.session_id,
        token_type: tokenData.token_type,
      }, groups, permissions);
      return response;
    }
    throw new Error(response?.message || "Login failed");
  }, [login, fetchUserPermissions]);

  const loginWithOtp = useCallback(async (data: VerifyRequest) => {
    const response = await authService.loginWithOtp(data);
    if (response?.success && response.data) {
      const { user: userData, groups: responseGroups, permissions: responsePermissions, ...tokenData } = response.data;
      
      // Use groups/permissions from response if available (avoids extra API calls)
      // Otherwise fetch from API
      let groups: Group[] = responseGroups || [];
      let permissions: string[] = responsePermissions || [];
      
      if (!responseGroups?.length && !responsePermissions?.length) {
        const fetched = await fetchUserPermissions(tokenData);
        groups = fetched.groups;
        permissions = fetched.permissions;
      }
      
      login(userData, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        session_token: tokenData.session_token,
        session_id: tokenData.session_id,
        token_type: tokenData.token_type,
      }, groups, permissions);
      return response;
    }
    throw new Error(response?.message || "Login failed");
  }, [login, fetchUserPermissions]);

  const sendOtp = useCallback(async (userId: string, channel: "email" | "sms" | "whatsapp") => {
    const response = await authService.sendOtp({ user_id: userId, channel });
    if (response?.success) {
      return response;
    }
    throw new Error(response?.message || "Failed to send OTP");
  }, []);

  const handleLogout = useCallback(async (redirectPath?: string) => {
    try {
      // Build auth headers from current tokens so /api/logout can validate and revoke
      const headers: Record<string, string> = {};
      if (tokens.session_token) {
        headers["X-Session-Token"] = tokens.session_token;
      } else if (tokens.access_token && tokens.token_type) {
        headers["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
      }

      const authedApi = createPublicApiService(headers);
      await authedApi.post("/logout", {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always clear local auth state and redirect if path provided
      logout(redirectPath);
    }
  }, [logout, tokens]);

  /**
   * Set password for the currently authenticated user using auth headers
   */
  const setPassword = useCallback(
    async (password: string, confirmPassword: string): Promise<ApiResponse<void>> => {
      const headers: Record<string, string> = {};

      if (tokens.session_token) {
        headers["X-Session-Token"] = tokens.session_token;
      } else if (tokens.access_token && tokens.token_type) {
        headers["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
      }

      const authedApi = createPublicApiService(headers);
      return authedApi.post<ApiResponse<void>>("/auth/set-password", {
        password,
        confirm_password: confirmPassword,
      });
    },
    [tokens]
  );

  /**
   * Change password for the currently authenticated user using auth headers
   */
  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<ApiResponse<void>> => {
      const headers: Record<string, string> = {};

      if (tokens.session_token) {
        headers["X-Session-Token"] = tokens.session_token;
      } else if (tokens.access_token && tokens.token_type) {
        headers["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
      }

      const authedApi = createPublicApiService(headers);
      return authedApi.post<ApiResponse<void>>("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
    },
    [tokens]
  );

  const isAuthenticated = !!user && !!tokens.access_token;

  return {
    user,
    tokens,
    isAuthenticated,
    loading,
    signup,
    verifySignup,
    loginWithPassword,
    loginWithOtp,
    sendOtp,
    setPassword,
    changePassword,
    logout: handleLogout,
    fetchWithAuth,
  };
};

// Re-export useAuth from context for convenience
export { useAuth } from "@context/AuthContext";

