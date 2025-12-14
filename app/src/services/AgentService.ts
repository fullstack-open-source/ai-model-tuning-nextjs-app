/**
 * AgentService
 * Service for fetching and managing support agents
 */

import { prisma } from '@lib/db/prisma';
import { logger } from '@lib/logger/logger';

export interface Agent {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  user_name: string | null;
  is_active: boolean;
}

export class AgentService {
  /**
   * Fetch all users who belong to the 'agent' group
   * Filters by:
   * - group.codename = 'agent'
   * - group.is_active = true
   * - user.is_active = true
   * - user.status != 'DELETED'
   */
  async getEligibleAgents(): Promise<Agent[]> {
    try {
      const agents = await prisma.user.findMany({
        where: {
          is_active: true,
          status: {
            not: 'DELETED',
          },
          userGroups: {
            some: {
              group: {
                codename: 'agent',
                is_active: true,
              },
            },
          },
        },
        select: {
          user_id: true,
          email: true,
          first_name: true,
          last_name: true,
          user_name: true,
          is_active: true,
        },
        orderBy: {
          created_at: 'asc',
        },
      });

      logger.info('Fetched eligible agents', {
        module: 'AgentService',
        extraData: {
          count: agents.length,
          label: 'GET_ELIGIBLE_AGENTS',
        },
      });

      return agents as Agent[];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching eligible agents', {
        module: 'AgentService',
        extraData: {
          error: errorMessage,
          label: 'GET_ELIGIBLE_AGENTS',
        },
      });
      return [];
    }
  }

  /**
   * Get agent by user_id
   */
  async getAgentById(userId: string): Promise<Agent | null> {
    try {
      const agent = await prisma.user.findFirst({
        where: {
          user_id: userId,
          is_active: true,
          status: {
            not: 'DELETED',
          },
          userGroups: {
            some: {
              group: {
                codename: 'agent',
                is_active: true,
              },
            },
          },
        },
        select: {
          user_id: true,
          email: true,
          first_name: true,
          last_name: true,
          user_name: true,
          is_active: true,
        },
      });

      return agent as Agent | null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching agent by ID', {
        module: 'AgentService',
        extraData: {
          error: errorMessage,
          userId,
          label: 'GET_AGENT_BY_ID',
        },
      });
      return null;
    }
  }
}

// Export singleton instance
export const agentService = new AgentService();

