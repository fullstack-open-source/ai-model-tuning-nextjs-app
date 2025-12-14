"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { ApiService } from "@lib/api/ApiService";
import { createPublicApiService } from "@lib/api/ApiServiceFactory";
import { getApiEndpoint } from "@lib/api/getApiUrl";
import { authService } from "@services/auth.service";
import { permissionService } from "@services/permission.service";
import { profileService } from "@services/profile.service";
import type { ApiResponse } from "@models/api.model";
import type { Group } from "@models/user.model";

type Tokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  session_id?: string | null;
  session_token?: string | null;
  token_type?: string | null;
};

interface AuthUser {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_name?: string | null;
  profile_picture_url?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  tokens: Tokens;
  loading: boolean;
  groups: Group[];
  permissions: string[];
  login: (
    userData: AuthUser,
    tokens: Tokens,
    groups?: Group[],
    permissions?: string[]
  ) => void;
  logout: (redirectPath?: string) => void;
  updatePermissions: (groups: Group[], permissions: string[]) => void;
  fetchWithAuth: (
    url: string,
    options?: AxiosRequestConfig
  ) => Promise<AxiosResponse>;
  apiService: ApiService;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<Tokens>({});
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  
  // Track if component is mounted
  const isMountedRef = useRef(false);

  // Helper: read cookie by name (client-side only)
  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()!.split(";").shift() || "");
    }
    return null;
  };

  // Helper: set/clear refresh token cookie (30 days)
  const setRefreshTokenCookie = (refreshToken: string | null | undefined) => {
    if (typeof document === "undefined") return;
    const maxAge = 60 * 60 * 24 * 30;
    if (!refreshToken) {
      document.cookie = "refresh_token=; Max-Age=0; Path=/; SameSite=Lax";
      return;
    }
    document.cookie = `refresh_token=${encodeURIComponent(
      refreshToken
    )}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  };

  // Create ApiService instance with auth headers
  const apiService = useMemo((): ApiService => {
    const headers: Record<string, string> = {};
    if (tokens.session_token) {
      headers["X-Session-Token"] = tokens.session_token;
    } else if (tokens.access_token && tokens.token_type) {
      headers["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
    }
    return createPublicApiService(headers);
  }, [tokens.session_token, tokens.access_token, tokens.token_type]);

  // Load from localStorage on first render
  useEffect(() => {
    isMountedRef.current = true;

    const initAuth = async () => {
      try {
        if (typeof window === 'undefined') return;

        const storedUser = localStorage.getItem("auth_user");
        const storedTokens = localStorage.getItem("auth_tokens");
        const storedGroups = localStorage.getItem("auth_groups");
        const storedPermissions = localStorage.getItem("auth_permissions");

        if (!isMountedRef.current) return;

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedTokens) {
          const parsedTokens: Tokens = JSON.parse(storedTokens);
          setTokens(parsedTokens);
          setRefreshTokenCookie(parsedTokens.refresh_token ?? null);
        }
        if (storedGroups) {
          try {
            const parsedGroups = JSON.parse(storedGroups);
            if (isMountedRef.current) {
              setGroups(Array.isArray(parsedGroups) ? parsedGroups : []);
            }
          } catch {
            if (isMountedRef.current) setGroups([]);
          }
        }
        if (storedPermissions) {
          try {
            const parsedPermissions = JSON.parse(storedPermissions);
            if (isMountedRef.current) {
              setPermissions(Array.isArray(parsedPermissions) ? parsedPermissions : []);
            }
          } catch {
            if (isMountedRef.current) setPermissions([]);
          }
        }

        // Auto-refresh from cookie if no stored tokens
        if (!storedTokens) {
          const cookieRefreshToken = getCookie("refresh_token");
          if (cookieRefreshToken) {
            try {
              const refreshResponse: ApiResponse<{
                access_token: string;
                refresh_token: string;
                session_token?: string;
                session_id?: string;
                token_type: string;
              }> = await authService.refreshToken({
                refresh_token: cookieRefreshToken,
              });

              if (!isMountedRef.current) return;

              if (refreshResponse?.success && refreshResponse.data) {
                const {
                  access_token,
                  refresh_token,
                  session_token,
                  session_id,
                  token_type,
                } = refreshResponse.data;

                const newTokens: Tokens = {
                  access_token,
                  refresh_token,
                  session_token,
                  session_id,
                  token_type,
                };

                setTokens(newTokens);
                setRefreshTokenCookie(newTokens.refresh_token ?? null);
                localStorage.setItem("auth_tokens", JSON.stringify(newTokens));

                // Fetch user profile
                try {
                  const infoToken = session_token || access_token;
                  if (infoToken) {
                    const tokenInfo: ApiResponse<{ user?: AuthUser }> =
                      await authService.getTokenInfo(infoToken);
                    
                    if (!isMountedRef.current) return;
                    
                    const userData = tokenInfo?.data?.user;
                    if (userData) {
                      setUser(userData);
                      localStorage.setItem("auth_user", JSON.stringify(userData));

                      // Fetch permissions/groups
                      try {
                        const authHeaders: Record<string, string> = {};
                        if (session_token) {
                          authHeaders["X-Session-Token"] = session_token;
                        } else if (access_token && token_type) {
                          authHeaders["Authorization"] = `${token_type} ${access_token}`;
                        }
                        const authedApi = createPublicApiService(authHeaders);
                        permissionService.setAuthApi(authedApi);

                        const [groupsResponse, permissionsResponse] = await Promise.all([
                          permissionService.getMyGroups(),
                          permissionService.getMyPermissions(),
                        ]);

                        if (!isMountedRef.current) return;

                        const groupsData: Group[] = Array.isArray(groupsResponse?.data) ? groupsResponse.data : [];
                        const permissionsData: string[] = Array.isArray(permissionsResponse?.data) ? permissionsResponse.data : [];

                        setGroups(groupsData);
                        setPermissions(permissionsData);
                        localStorage.setItem("auth_groups", JSON.stringify(groupsData));
                        localStorage.setItem("auth_permissions", JSON.stringify(permissionsData));
                      } catch (permError) {
                        console.error("Failed to restore permissions/groups", permError);
                      }
                    }
                  }
                } catch (userError) {
                  console.error("Failed to restore user from token info", userError);
                }
              }
            } catch (refreshError) {
              console.error("Auto refresh from cookie failed", refreshError);
              setRefreshTokenCookie(null);
            }
          }
        }
      } catch (e) {
        console.error("Error loading auth state", e);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Delay init to ensure component is mounted
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        void initAuth();
      }
    }, 0);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Save to localStorage
  const saveAuthState = (userData: AuthUser, tokenData: Tokens, groupsData: Group[] = [], permissionsData: string[] = []) => {
    localStorage.setItem("auth_user", JSON.stringify(userData));
    localStorage.setItem("auth_tokens", JSON.stringify(tokenData));
    localStorage.setItem("auth_groups", JSON.stringify(groupsData));
    localStorage.setItem("auth_permissions", JSON.stringify(permissionsData));
    setRefreshTokenCookie(tokenData.refresh_token ?? null);
  };

  // LOGIN
  const login = (userData: AuthUser, tokenData: Tokens, groupsData: Group[] = [], permissionsData: string[] = []) => {
    if (!isMountedRef.current) return;
    
    // Normalize and validate groups
    const safeGroups = Array.isArray(groupsData) ? groupsData.map(g => ({
      ...g,
      codename: g?.codename || g?.name?.toLowerCase().replace(/\s+/g, '_') || g?.name || '',
    })) : [];
    
    // Normalize permissions - handle both string[] and object[] formats
    const safePermissions: string[] = Array.isArray(permissionsData) 
      ? permissionsData.map(p => {
          if (typeof p === 'string') return p;
          if (typeof p === 'object' && p !== null) {
            return (p as any).codename || (p as any).permission_codename || String(p);
          }
          return String(p);
        }).filter(Boolean)
      : [];
    
    // Debug logging
    console.log('🔐 AuthContext.login called:', {
      userId: userData.user_id,
      groups: safeGroups.map(g => g.codename),
      permissionCount: safePermissions.length,
      samplePermissions: safePermissions.slice(0, 5),
    });
    
    setUser(userData);
    setTokens(tokenData);
    setGroups(safeGroups);
    setPermissions(safePermissions);
    saveAuthState(userData, tokenData, safeGroups, safePermissions);
  };

  // Update permissions and groups
  const updatePermissions = (groupsData: Group[], permissionsData: string[]) => {
    if (!isMountedRef.current) return;
    const safeGroups = Array.isArray(groupsData) ? groupsData : [];
    const safePermissions = Array.isArray(permissionsData) ? permissionsData : [];
    setGroups(safeGroups);
    setPermissions(safePermissions);
    if (user) {
      localStorage.setItem("auth_groups", JSON.stringify(safeGroups));
      localStorage.setItem("auth_permissions", JSON.stringify(safePermissions));
    }
  };

  // LOGOUT
  const logout = (redirectPath?: string) => {
    if (isMountedRef.current) {
      setUser(null);
      setTokens({});
      setGroups([]);
      setPermissions([]);
    }
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_tokens");
    localStorage.removeItem("auth_groups");
    localStorage.removeItem("auth_permissions");
    setRefreshTokenCookie(null);
    profileService.clearProfileCache();

    if (typeof window !== 'undefined' && redirectPath) {
      import('@utils/auth-redirect').then(({ buildLoginUrl }) => {
        const loginUrl = buildLoginUrl(redirectPath);
        window.location.href = loginUrl;
      }).catch(() => {
        window.location.href = `/login?next=${encodeURIComponent(redirectPath)}`;
      });
    }
  };

  // PROTECTED API REQUESTS
  const fetchWithAuth = async (url: string, options: AxiosRequestConfig = {}): Promise<AxiosResponse> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const applyAuthHeaders = (tokenState: Tokens) => {
      const h: Record<string, string> = { ...headers };
      if (tokenState.session_token) {
        h["X-Session-Token"] = tokenState.session_token;
      } else if (tokenState.access_token && tokenState.token_type) {
        h["Authorization"] = `${tokenState.token_type} ${tokenState.access_token}`;
      }
      return h;
    };

    const fullUrl = getApiEndpoint(url, false);

    try {
      return await axios({
        url: fullUrl,
        ...options,
        headers: applyAuthHeaders(tokens),
      });
    } catch (error: unknown) {
      const status =
        typeof (error as { response?: { status?: number } }).response?.status === "number"
          ? (error as { response?: { status?: number } }).response!.status
          : undefined;

      if (status === 401 && tokens.refresh_token) {
        try {
          const refreshResponse: ApiResponse<{
            access_token: string;
            refresh_token: string;
            session_token?: string;
            session_id?: string;
            token_type: string;
          }> = await authService.refreshToken({
            refresh_token: tokens.refresh_token,
          });

          if (refreshResponse?.success && refreshResponse.data) {
            const { access_token, refresh_token, session_token, session_id, token_type } = refreshResponse.data;
            const newTokens: Tokens = {
              access_token,
              refresh_token,
              session_token,
              session_id,
              token_type,
            };

            if (user && isMountedRef.current) {
              setTokens(newTokens);
              saveAuthState(user, newTokens);
            }

            return await axios({
              url: fullUrl,
              ...options,
              headers: applyAuthHeaders(newTokens),
            });
          }
        } catch (refreshError) {
          console.error("Token refresh failed", refreshError);
        }
      }

      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        loading,
        groups,
        permissions,
        login,
        logout,
        updatePermissions,
        fetchWithAuth,
        apiService,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
