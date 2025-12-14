import { ApiService } from '@lib/api/ApiService';

export interface LogFile {
  filename: string;
  size: number;
  sizeFormatted: string;
  totalLines: number;
  modified: string;
  created: string;
}

export interface LogEntry {
  line: number;
  timestamp: string;
  level: string;
  message: string;
  module?: string;
  filename?: string;
}

export interface LogFileContent {
  filename: string;
  entries: LogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  statistics: {
    total: number;
    byLevel: Record<string, number>;
    byModule: Record<string, number>;
  };
}

export interface SystemInfo {
  platform: {
    type: string;
    platform: string;
    arch: string;
    hostname: string;
    release: string;
  };
  cpu: {
    model: string;
    cores: number;
    speed: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: string;
    formatted: {
      total: string;
      free: string;
      used: string;
    };
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  node: {
    version: string;
    versions: Record<string, string>;
  };
  environment: Record<string, unknown>;
  network: {
    interfaces: Array<{
      name: string;
      addresses: Array<{
        address: string;
        netmask: string;
        family: string;
        mac: string;
        internal: boolean;
      }>;
    }>;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: string;
    formatted: {
      total: string;
      free: string;
      used: string;
    };
  };
}

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
  containers: Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
  }>;
  images: Array<{
    id: string;
    repository: string;
    tag: string;
    size: string;
  }>;
  error: string | null;
}

export interface Process {
  pid: number;
  cpu: string;
  memory: string;
  command: string;
}

export interface RedisKey {
  key: string;
  type: string;
  ttl: number | null;
  size: number;
  sizeFormatted: string;
  valuePreview?: string;
  privacy?: "private" | "public";
}

export interface RedisKeyDetails {
  key: string;
  type: string;
  ttl: number | null;
  size: number;
  value: string | object | null;
}

export interface RedisCacheStats {
  totalKeys: number;
  totalMemory: number;
  totalMemoryFormatted: string;
  keysByType: Record<string, number>;
  memoryByType: Record<string, number>;
  keys: RedisKey[];
  available: boolean;
  cacheType?: "redis" | "local";
}

class SystemAnalyticsService {
  private authApi: ApiService | null = null;

  setAuthApi(authApi: ApiService) {
    this.authApi = authApi;
  }

  /**
   * Get list of log files
   */
  async getLogFiles(): Promise<LogFile[]> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data?: { files?: LogFile[] } }>('/api/system-analytics/logs?action=list');
    return response.data?.files || [];
  }

  /**
   * Read log file content
   */
  async readLogFile(
    filename: string,
    options?: {
      level?: string;
      module?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<LogFileContent> {
    if (!this.authApi) throw new Error('Auth API not set');
    const params = new URLSearchParams({
      action: 'read',
      filename,
      ...(options?.level && { level: options.level }),
      ...(options?.module && { module: options.module }),
      ...(options?.search && { search: options.search }),
      limit: String(options?.limit || 1000),
      offset: String(options?.offset || 0),
    });
    const response = await this.authApi.get<{ data: LogFileContent }>(`/api/system-analytics/logs?${params}`);
    return response.data;
  }

  /**
   * Clear log file
   */
  async clearLogFile(filename: string): Promise<void> {
    if (!this.authApi) throw new Error('Auth API not set');
    await this.authApi.delete<unknown>(`/api/system-analytics/logs?filename=${encodeURIComponent(filename)}&action=clear`);
  }

  /**
   * Delete log file
   */
  async deleteLogFile(filename: string): Promise<void> {
    if (!this.authApi) throw new Error('Auth API not set');
    await this.authApi.delete<unknown>(`/api/system-analytics/logs?filename=${encodeURIComponent(filename)}&action=delete`);
  }

  /**
   * Get recent errors (caching handled by API middleware)
   */
  async getRecentErrors(limit: number = 5): Promise<{ errors: LogEntry[]; count: number; total: number }> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data: { errors: LogEntry[]; count: number; total: number } }>(`/api/system-analytics/errors?limit=${limit}`);
    return response.data;
  }

  /**
   * Refresh recent errors (force API call, bypassing cache)
   */
  async refreshRecentErrors(limit: number = 5): Promise<{ errors: LogEntry[]; count: number; total: number }> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data: { errors: LogEntry[]; count: number; total: number } }>(`/api/system-analytics/errors?limit=${limit}&_refresh=${Date.now()}`);
    return response.data;
  }

  /**
   * Get log statistics (caching handled by API middleware)
   */
  async getLogStatistics(): Promise<{
    files: LogFile[];
    totalFiles: number;
    totalSize: number;
    totalSizeFormatted: string;
    totalLines: number;
    byLevel: Record<string, number>;
    byModule: Record<string, number>;
  }> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data: {
      files: LogFile[];
      totalFiles: number;
      totalSize: number;
      totalSizeFormatted: string;
      totalLines: number;
      byLevel: Record<string, number>;
      byModule: Record<string, number>;
    } }>('/api/system-analytics/log-statistics');
    return response.data;
  }

  /**
   * Refresh log statistics (force API call, bypassing cache)
   */
  async refreshLogStatistics(): Promise<{
    files: LogFile[];
    totalFiles: number;
    totalSize: number;
    totalSizeFormatted: string;
    totalLines: number;
    byLevel: Record<string, number>;
    byModule: Record<string, number>;
  }> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data: {
      files: LogFile[];
      totalFiles: number;
      totalSize: number;
      totalSizeFormatted: string;
      totalLines: number;
      byLevel: Record<string, number>;
      byModule: Record<string, number>;
    } }>('/api/system-analytics/log-statistics?_refresh=' + Date.now());
    return response.data;
  }

  /**
   * Get system information (caching handled by API middleware)
   */
  async getSystemInfo(): Promise<SystemInfo> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data?: { system_info?: SystemInfo } }>('/api/system-analytics/system-info');
    return response.data?.system_info || {} as SystemInfo;
  }

  /**
   * Refresh system information (force API call, bypassing cache)
   */
  async refreshSystemInfo(): Promise<SystemInfo> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data?: { system_info?: SystemInfo } }>('/api/system-analytics/system-info?_refresh=' + Date.now());
    return response.data?.system_info || {} as SystemInfo;
  }

  /**
   * Get top processes (caching handled by API middleware)
   */
  async getTopProcesses(limit: number = 10): Promise<{ processes: Process[] }> {
    if (!this.authApi) throw new Error('Auth API not set');
    // ApiService.get() returns axios response.data which is the full API response
    // API returns { success: true, message: string, data: { processes: Process[], ... } }
    // So response is { success: true, message: string, data: { processes: Process[], ... } }
    const response = await this.authApi.get<{ 
      success: boolean;
      message: string;
      data: { processes: Process[]; limit: number; error?: string | null; timestamp: string };
    }>(`/api/system-analytics/top-processes?limit=${limit}`);
    // response is the full API response, so response.data contains the processes
    return { processes: (response.data?.processes || []) as Process[] };
  }

  /**
   * Refresh top processes (force API call, bypassing cache)
   */
  async refreshTopProcesses(limit: number = 10): Promise<{ processes: Process[] }> {
    if (!this.authApi) throw new Error('Auth API not set');
    // ApiService.get() returns axios response.data which is the full API response
    // API returns { success: true, message: string, data: { processes: Process[], ... } }
    // So response is { success: true, message: string, data: { processes: Process[], ... } }
    const response = await this.authApi.get<{ 
      success: boolean;
      message: string;
      data: { processes: Process[]; limit: number; error?: string | null; timestamp: string };
    }>(`/api/system-analytics/top-processes?limit=${limit}&_refresh=${Date.now()}`);
    // response is the full API response, so response.data contains the processes
    return { processes: (response.data?.processes || []) as Process[] };
  }

  /**
   * Get Docker status (caching handled by API middleware)
   */
  async getDockerStatus(): Promise<DockerStatus> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data?: { docker_status?: DockerStatus } }>('/api/system-analytics/docker-status');
    return response.data?.docker_status || {} as DockerStatus;
  }

  /**
   * Refresh Docker status (force API call, bypassing cache)
   */
  async refreshDockerStatus(): Promise<DockerStatus> {
    if (!this.authApi) throw new Error('Auth API not set');
    const response = await this.authApi.get<{ data?: { docker_status?: DockerStatus } }>('/api/system-analytics/docker-status?_refresh=' + Date.now());
    return response.data?.docker_status || {} as DockerStatus;
  }


  /**
   * Get cache statistics (caching handled by API middleware)
   */
  async getCacheStats(filterOwn: boolean = false): Promise<RedisCacheStats> {
    if (!this.authApi) throw new Error('Auth API not set');
    const url = filterOwn 
      ? '/api/system-analytics/cache?filter_own=true'
      : '/api/system-analytics/cache';
    const response = await this.authApi.get<{ 
      success: boolean;
      data: RedisCacheStats;
      available: boolean;
      cacheType?: "redis" | "local";
    }>(url);
    
    if (!response.success || !response.available) {
      return {
        totalKeys: 0,
        totalMemory: 0,
        totalMemoryFormatted: "0 B",
        keysByType: {},
        memoryByType: {},
        keys: [],
        available: false,
        cacheType: response.cacheType || "redis",
      };
    }
    
    return {
      ...response.data,
      available: true,
      cacheType: response.cacheType || "redis",
    };
  }

  /**
   * Refresh cache statistics (force API call, bypassing cache)
   */
  async refreshCacheStats(filterOwn: boolean = false): Promise<RedisCacheStats> {
    if (!this.authApi) throw new Error('Auth API not set');
    const params = new URLSearchParams({ _refresh: String(Date.now()) });
    if (filterOwn) {
      params.append('filter_own', 'true');
    }
    const url = `/api/system-analytics/cache?${params.toString()}`;
    const response = await this.authApi.get<{ 
      success: boolean;
      data: RedisCacheStats;
      available: boolean;
      cacheType?: "redis" | "local";
    }>(url);
    
    if (!response.success || !response.available) {
      return {
        totalKeys: 0,
        totalMemory: 0,
        totalMemoryFormatted: "0 B",
        keysByType: {},
        memoryByType: {},
        keys: [],
        available: false,
        cacheType: response.cacheType || "redis",
      };
    }
    
    return {
      ...response.data,
      available: true,
      cacheType: response.cacheType || "redis",
    };
  }

  /**
   * Get Redis key details
   */
  async getKeyDetails(key: string): Promise<RedisKeyDetails> {
    if (!this.authApi) throw new Error('Auth API not set');
    // ApiService.get() returns axios response.data
    // API returns { success: true, data: RedisKeyDetails }
    // So response is { success: true, data: RedisKeyDetails }
    const response = await this.authApi.get<{ 
      success: boolean;
      data: RedisKeyDetails;
    }>(`/api/system-analytics/cache/${encodeURIComponent(key)}`);
    // Extract the nested data property - response is { success, data }, so response.data is RedisKeyDetails
    return (response as unknown as { success: boolean; data: RedisKeyDetails }).data;
  }

  /**
   * Delete Redis key
   */
  async deleteKey(key: string): Promise<void> {
    if (!this.authApi) throw new Error('Auth API not set');
    await this.authApi.delete<unknown>(`/api/system-analytics/cache/${encodeURIComponent(key)}`);
  }

  /**
   * Flush all cache (delete all keys)
   */
  async flushCache(): Promise<void> {
    if (!this.authApi) throw new Error('Auth API not set');
    await this.authApi.delete<unknown>('/api/system-analytics/cache');
  }
}

export const systemAnalyticsService = new SystemAnalyticsService();

