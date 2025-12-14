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
 * Get Docker status
 * GET /api/system-analytics/docker-status
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_docker_status');
    if (permissionError) return permissionError;

    let dockerStatus = {
      installed: false,
      running: false,
      version: null as string | null,
      containers: [] as any[],
      images: [] as any[],
      error: null as string | null,
    };

    try {
      // Check if Docker is installed
      try {
        const { stdout: versionOutput } = await execAsync('docker --version');
        dockerStatus.installed = true;
        dockerStatus.version = versionOutput.trim();
      } catch (error) {
        dockerStatus.installed = false;
        dockerStatus.error = 'Docker is not installed or not accessible';
        return SUCCESS.json('Docker status retrieved', { docker_status: dockerStatus });
      }

      // Check if Docker daemon is running
      try {
        await execAsync('docker ps');
        dockerStatus.running = true;
      } catch (error) {
        dockerStatus.running = false;
        dockerStatus.error = 'Docker daemon is not running';
        return SUCCESS.json('Docker status retrieved', { docker_status: dockerStatus });
      }

      // Get running containers
      try {
        const { stdout: containersOutput } = await execAsync('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"');
        dockerStatus.containers = containersOutput
          .trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [id, name, image, status, ports] = line.split('|');
            return {
              id: id.substring(0, 12),
              name,
              image,
              status,
              ports: ports || 'N/A',
            };
          });
      } catch (error: any) {
        logger.error('Error getting Docker containers', { extraData: { error: error.message } });
      }

      // Get Docker images
      try {
        const { stdout: imagesOutput } = await execAsync('docker images --format "{{.Repository}}|{{.Tag}}|{{.Size}}|{{.ID}}"');
        dockerStatus.images = imagesOutput
          .trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [repository, tag, size, id] = line.split('|');
            return {
              id: id.substring(0, 12),
              repository,
              tag,
              size,
            };
          });
      } catch (error: any) {
        logger.error('Error getting Docker images', { extraData: { error: error.message } });
      }

    } catch (error: any) {
      dockerStatus.error = error.message;
      logger.error('Error checking Docker status', { 
        module: 'SystemAnalytics', 
        label: 'GET_DOCKER_STATUS',
        extraData: { error: error.message }
      });
    }

    return SUCCESS.json('Docker status retrieved', { docker_status: dockerStatus });
  } catch (error: any) {
    logger.error('Error in Docker status check', { 
      module: 'SystemAnalytics', 
      label: 'GET_DOCKER_STATUS',
      extraData: { error: error.message }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

