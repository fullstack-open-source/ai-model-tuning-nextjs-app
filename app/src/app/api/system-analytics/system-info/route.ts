import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getSystemAnalyticsCacheKey } from '@lib/cache/keys';
import { appConfig, loggingConfig } from '@lib/config/env';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get system information
 * GET /api/system-analytics/system-info
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_system_info');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchSystemInfoData = async () => {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Get disk usage
        let diskInfo = {
          total: 0,
          free: 0,
          used: 0,
          usagePercent: '0',
          formatted: {
            total: 'N/A',
            free: 'N/A',
            used: 'N/A',
          },
        };

        try {
          // Try to get disk usage using df command (works on Linux/Mac)
          const { stdout } = await execAsync("df -k / | tail -n 1 | awk '{print $2,$3,$4}'");
          const [totalKb, usedKb, freeKb] = stdout.trim().split(/\s+/).map(Number);
          
          if (totalKb && usedKb && freeKb) {
            const totalBytes = totalKb * 1024;
            const usedBytes = usedKb * 1024;
            const freeBytes = freeKb * 1024;
            const usagePercent = ((usedBytes / totalBytes) * 100).toFixed(2);

            diskInfo = {
              total: totalBytes,
              free: freeBytes,
              used: usedBytes,
              usagePercent,
              formatted: {
                total: formatBytes(totalBytes),
                free: formatBytes(freeBytes),
                used: formatBytes(usedBytes),
              },
            };
          }
        } catch (error) {
          // If df command fails, try alternative method or leave as N/A
          logger.info('Could not get disk usage', { 
            module: 'SystemAnalytics', 
            label: 'GET_DISK_USAGE',
            extraData: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
        }

        return {
          platform: {
            type: os.type(),
            platform: process.platform,
            arch: os.arch(),
            hostname: os.hostname(),
            release: os.release(),
          },
          cpu: {
            model: cpus[0]?.model || 'Unknown',
            cores: cpus.length,
            speed: cpus[0]?.speed || 0,
            loadAverage: os.loadavg(),
          },
          memory: {
            total: totalMem,
            free: freeMem,
            used: usedMem,
            usagePercent: ((usedMem / totalMem) * 100).toFixed(2),
            formatted: {
              total: formatBytes(totalMem),
              free: formatBytes(freeMem),
              used: formatBytes(usedMem),
            },
          },
          uptime: {
            seconds: os.uptime(),
            formatted: formatUptime(os.uptime()),
          },
          node: {
            version: process.version,
            versions: process.versions,
          },
          environment: {
            mode: appConfig.mode,
            apiVersion: process.env.API_VERSION || 'N/A',
            apiUrl: appConfig.internalUrl,
            debugMode: loggingConfig.debugMode,
            logLevel: loggingConfig.level,
            nodeEnv: process.env.NODE_ENV || 'development',
          },
          network: {
            interfaces: Object.keys(os.networkInterfaces()).map(name => ({
              name,
              addresses: os.networkInterfaces()[name]?.map(iface => ({
                address: iface.address,
                netmask: iface.netmask,
                family: iface.family,
                mac: iface.mac,
                internal: iface.internal,
              })) || [],
            })),
          },
          disk: diskInfo,
        };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const systemInfo = forceRefresh
      ? await reCache(fetchSystemInfoData, {
          key: getSystemAnalyticsCacheKey('system-info'),
          duration: 'short', // Cache for 5 minutes (system info changes frequently)
        })
      : await withCache(fetchSystemInfoData, {
          key: getSystemAnalyticsCacheKey('system-info'),
          duration: 'short', // Cache for 5 minutes (system info changes frequently)
        });

    return SUCCESS.json('System information retrieved', { system_info: systemInfo });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting system information', { 
      module: 'SystemAnalytics', 
      label: 'GET_SYSTEM_INFO',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes';
  const k = 1024;
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

