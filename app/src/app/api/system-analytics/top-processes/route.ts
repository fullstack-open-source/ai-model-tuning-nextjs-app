import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get top processes
 * GET /api/system-analytics/top-processes?limit=10
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_system_processes');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let processes: any[] = [];
    let error: string | null = null;

    try {
      // Use ps command to get process information
      // Format: PID, CPU%, MEM%, COMMAND
      const { stdout } = await execAsync(
        `ps aux --sort=-%cpu | head -n ${limit + 1} | tail -n ${limit} | awk '{print $2"|"$3"|"$4"|"$11"|"$12"|"$13"|"$14"|"$15"|"$16"|"$17"|"$18"|"$19"|"$20"|"$21}'`
      );

      processes = stdout
        .trim()
        .split('\n')
        .filter(line => line.trim() && !line.includes('PID'))
        .map(line => {
          const parts = line.split('|');
          const pid = parts[0];
          const cpu = parseFloat(parts[1]) || 0;
          const mem = parseFloat(parts[2]) || 0;
          const command = parts.slice(3).filter(p => p).join(' ');

          return {
            pid: parseInt(pid),
            cpu: cpu.toFixed(2),
            memory: mem.toFixed(2),
            command: command.substring(0, 100), // Limit command length
          };
        })
        .sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu));

    } catch (err: any) {
      error = err.message;
      logger.error('Error getting top processes', { extraData: { error: err.message } });
      
      // Fallback: try alternative command
      try {
        const { stdout } = await execAsync(`ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -n ${limit + 1} | tail -n ${limit}`);
        processes = stdout
          .trim()
          .split('\n')
          .filter(line => line.trim() && !line.includes('PID'))
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parseInt(parts[0]),
              cpu: parseFloat(parts[1])?.toFixed(2) || '0.00',
              memory: parseFloat(parts[2])?.toFixed(2) || '0.00',
              command: parts.slice(3).join(' ').substring(0, 100),
            };
          });
        error = null;
      } catch (fallbackErr: any) {
        error = fallbackErr.message;
      }
    }

    return SUCCESS.json('Top processes retrieved', { 
      processes,
      limit,
      error,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error getting top processes', { 
      module: 'SystemAnalytics', 
      label: 'GET_TOP_PROCESSES',
      extraData: { error: error.message }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

