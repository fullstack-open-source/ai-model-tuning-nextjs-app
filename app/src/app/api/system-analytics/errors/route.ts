import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

interface LogEntry {
  line: number;
  timestamp: string;
  level: string;
  message: string;
  module?: string;
  filename: string;
}

/**
 * Parse log line into structured format
 */
function parseLogLine(line: string, lineNumber: number): LogEntry | null {
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \[(\w+)\](?: \[Module:([^\]]+)\])? (.+)$/);
  
  if (!match) {
    const simpleMatch = line.match(/\[(\w+)\](?: \[Module:([^\]]+)\])? (.+)$/);
    if (simpleMatch) {
      return {
        line: lineNumber,
        timestamp: 'Unknown',
        level: simpleMatch[1] || 'UNKNOWN',
        message: simpleMatch[3] || line,
        module: simpleMatch[2],
        filename: '',
      };
    }
    return null;
  }

  return {
    line: lineNumber,
    timestamp: match[1],
    level: match[2] || 'UNKNOWN',
    message: match[4] || '',
    module: match[3],
    filename: '',
  };
}

/**
 * Get recent errors from all log files
 * GET /api/system-analytics/errors?limit=5
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_system_errors');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '5');

    if (!fs.existsSync(LOGS_DIR)) {
      return SUCCESS.json('Recent errors retrieved', { errors: [], count: 0 });
    }

    const files = fs.readdirSync(LOGS_DIR)
      .filter(file => file.endsWith('.log'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(LOGS_DIR, a));
        const statB = fs.statSync(path.join(LOGS_DIR, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    const allErrors: LogEntry[] = [];

    // Read from most recent files first
    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim()) {
          const entry = parseLogLine(line, index + 1);
          if (entry && (entry.level === 'error' || entry.level === 'ERROR' || entry.level === 'Error')) {
            entry.filename = file;
            allErrors.push(entry);
          }
        }
      });

      // Stop if we have enough errors
      if (allErrors.length >= limit * 2) break;
    }

    // Sort by timestamp (most recent first) and limit
    const sortedErrors = allErrors
      .sort((a, b) => {
        if (a.timestamp === 'Unknown' && b.timestamp === 'Unknown') return 0;
        if (a.timestamp === 'Unknown') return 1;
        if (b.timestamp === 'Unknown') return -1;
        return b.timestamp.localeCompare(a.timestamp);
      })
      .slice(0, limit);

    return SUCCESS.json('Recent errors retrieved', {
      errors: sortedErrors,
      count: sortedErrors.length,
      total: allErrors.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting recent errors', { 
      module: 'SystemAnalytics', 
      label: 'GET_RECENT_ERRORS',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

