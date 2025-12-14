import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { RequestOptions } from "../../types/axios";
import { getApiUrl, getInternalApiUrl, getPublicApiUrl } from "./getApiUrl";
import { getMode } from "./mode";

export class ApiService {
  private client: AxiosInstance;
  private mode: string;
  private useMode: boolean;

  constructor(
    baseURL: string, 
    defaultHeaders?: Record<string, string>, 
    timeout: number = 10000, 
    mode?: string,
    useMode: boolean = true
  ) {
    // Use provided mode or get cached mode (already normalized)
    this.mode = mode ? (mode.startsWith('/') ? mode : `/${mode}`) : getMode();
    this.useMode = useMode;
    
    // Ensure baseURL doesn't have trailing slash
    const normalizedBaseUrl = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    
    // For internal Next.js routes, don't prepend MODE (they use /api/... directly)
    // For external APIs, prepend MODE (e.g., http://localhost:3000/dev/v1/api)
    const fullBaseURL = useMode 
      ? `${normalizedBaseUrl}${this.mode}`
      : normalizedBaseUrl;
    
    this.client = axios.create({
      baseURL: fullBaseURL,
      headers: defaultHeaders,
      timeout,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (config.url) {
          if (this.useMode) {
            // For external APIs with MODE: Remove /api prefix (MODE already includes it)
            config.url = config.url.replace(/^\/api/, '').replace(/^api/, '');
          } else {
            // For internal Next.js APIs: Ensure /api prefix is present
            if (!config.url.startsWith('/api/') && !config.url.startsWith('api/')) {
              // Add /api prefix if not present
              config.url = config.url.startsWith('/') ? `/api${config.url}` : `/api/${config.url}`;
            }
          }
          // Ensure URL starts with /
          if (!config.url.startsWith('/')) {
            config.url = `/${config.url}`;
          }
        }
        // Log requests only in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log responses only in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API RESPONSE] ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error) => {
        // Global error handling - log in all environments for debugging
        const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
        const status = error?.response?.status || 'N/A';
        const url = error?.config?.url || 'N/A';
        
        if (process.env.NODE_ENV === 'development') {
          console.error(`[API ERROR] ${status} ${url}`, errorMessage);
        }
        
        // Reject with enhanced error information
        return Promise.reject(error);
      }
    );
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      url,
      method,
      headers: options?.headers,
      params: options?.params,
      data,
      timeout: options?.timeout,
    };

    const response: AxiosResponse<T> = await this.client.request<T>(config);
    
    // Return the actual API response data directly
    // The API returns { success, message, data, ... } format
    return response.data;
  }

  // Public methods
  public get<T>(url: string, options?: RequestOptions) {
    return this.request<T>("GET", url, undefined, options);
  }

  public post<T>(url: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>("POST", url, data, options);
  }

  public put<T>(url: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>("PUT", url, data, options);
  }

  public delete<T>(url: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>("DELETE", url, data, options);
  }

  public patch<T>(url: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>("PATCH", url, data, options);
  }

  /**
   * Upload files using FormData
   */
  public async upload<T>(url: string, formData: FormData, options?: RequestOptions): Promise<T> {
    const config: AxiosRequestConfig = {
      url,
      method: 'POST',
      headers: {
        ...options?.headers,
        'Content-Type': 'multipart/form-data',
      },
      params: options?.params,
      data: formData,
      timeout: options?.timeout || 60000, // Default 60s for uploads
    };

    const response: AxiosResponse<T> = await this.client.request<T>(config);
    return response.data;
  }

  /**
   * Create an ApiService instance with automatic URL detection
   * Uses internal URL for server-side, public URL for client-side
   * Automatically prepends mode (e.g., dev/v1/api) to baseURL
   */
  static create(
    defaultHeaders?: Record<string, string>,
    timeout?: number,
    mode?: string
  ): ApiService {
    return new ApiService(getApiUrl(), defaultHeaders, timeout, mode);
  }

  /**
   * Create an ApiService instance for server-side usage (internal URL)
   * Automatically prepends mode (e.g., dev/v1/api) to baseURL
   */
  static createInternal(
    defaultHeaders?: Record<string, string>,
    timeout?: number,
    mode?: string
  ): ApiService {
    return new ApiService(getInternalApiUrl(), defaultHeaders, timeout, mode);
  }

  /**
   * Create an ApiService instance for client-side usage (public URL)
   * Automatically prepends mode (e.g., dev/v1/api) to baseURL
   */
  static createPublic(
    defaultHeaders?: Record<string, string>,
    timeout?: number,
    mode?: string
  ): ApiService {
    return new ApiService(getPublicApiUrl(), defaultHeaders, timeout, mode);
  }
}
