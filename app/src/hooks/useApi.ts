/**
 * useApi Hook
 * Custom hook for API calls with loading and error states
 */

import { useState, useCallback, useRef } from "react";
import type { ApiResponse } from "@models/api.model";

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  immediate?: boolean;
}

export const useApi = <T = any>(
  apiCall: () => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      if (response?.success) {
        const responseData = response.data ?? null;
        setData(responseData);
        options.onSuccess?.(responseData);
        return response;
      } else {
        const errorMessage = response?.message || "Request failed";
        const apiError = new Error(errorMessage);
        setError(apiError);
        options.onError?.(apiError);
        throw apiError;
      }
    } catch (err) {
      const apiError = err instanceof Error ? err : new Error("Unknown error");
      setError(apiError);
      options.onError?.(apiError);
      throw apiError;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [apiCall, options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
};

