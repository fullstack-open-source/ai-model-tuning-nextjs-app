import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

/**
 * Get log statistics
 * GET /api/system-analytics/log-statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_system_logs');
    if (permissionError) return permissionError;

    if (!fs.existsSync(LOGS_DIR)) {
      return SUCCESS.json('Log statistics retrieved', { 
        files: [],
        totalFiles: 0,
        totalSize: 0,
        totalLines: 0,
        byLevel: {},
        byModule: {},
      });
    }

    const files = fs.readdirSync(LOGS_DIR)
      .filter(file => file.endsWith('.log'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(LOGS_DIR, a));
        const statB = fs.statSync(path.join(LOGS_DIR, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    let totalSize = 0;
    let totalLines = 0;
    const byLevel: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    const fileStats: any[] = [];

    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      totalSize += stats.size;
      totalLines += lines.length;

      // Count by level and module
      lines.forEach(line => {
        const levelMatch = line.match(/\[(\w+)\]/);
        if (levelMatch) {
          const level = levelMatch[1];
          byLevel[level] = (byLevel[level] || 0) + 1;
        }

        const moduleMatch = line.match(/\[Module:([^\]]+)\]/);
        if (moduleMatch) {
          const module = moduleMatch[1];
          byModule[module] = (byModule[module] || 0) + 1;
        }
      });

      fileStats.push({
        filename: file,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        totalLines: lines.length,
        modified: stats.mtime.toISOString(),
      });
    }

    return SUCCESS.json('Log statistics retrieved', {
      files: fileStats,
      totalFiles: files.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      totalLines,
      byLevel,
      byModule,
    });
  } catch (error: any) {
    logger.error('Error getting log statistics', { 
      module: 'SystemAnalytics', 
      label: 'GET_LOG_STATISTICS',
      extraData: { error: error.message }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes';
  const k = 1024;
  const sizes = ['bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

