import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { emitUserCreated } from '@lib/websocket/emitter';
import { activityLogService } from '@services/ActivityLogService';
import { getUsersListCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get All Users
 * GET /api/users
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_users');
    if (permissionError) return permissionError;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;
    const forceRefresh = searchParams.has('_refresh');

    // Build where clause for search and filters
    const where: Record<string, unknown> = {};
    
    // Search across multiple fields including phone number
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        // Search in phone_number JSONB field
        { phone_number: { path: ['phone'], string_contains: search } },
      ];
    }

    // Apply filters
    const auth_type = searchParams.get('auth_type');
    const status = searchParams.get('status');
    const gender = searchParams.get('gender');
    const is_active = searchParams.get('is_active');
    const is_verified = searchParams.get('is_verified');

    if (auth_type) where.auth_type = auth_type;
    if (status) where.account_status = status;
    if (gender) where.gender = gender;
    if (is_active !== null && is_active !== '') where.is_active = is_active === 'true';
    if (is_verified !== null && is_verified !== '') where.is_verified = is_verified === 'true';

    // Generate cache key based on filters and pagination
    const cacheKey = getUsersListCacheKey({
      page,
      limit,
      search,
      auth_type: auth_type || undefined,
      status: status || undefined,
      gender: gender || undefined,
      is_active: is_active || undefined,
      is_verified: is_verified || undefined,
    });

    // Define the data fetcher function
    const fetchUsersData = async () => {
      try {
        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { created_at: 'desc' },
            select: {
              user_id: true,
              email: true,
              first_name: true,
              last_name: true,
              phone_number: true,
              account_status: true,
              is_active: true,
              is_verified: true,
              email_verified: true,
              phone_verified: true,
              created_at: true,
              last_updated: true,
              last_login: true,
              auth_type: true,
              gender: true,
              country: true,
              profile_picture_url: true,
              // Optional fields (may not exist if migrations not run)
              is_email_verified: true,
              is_phone_verified: true,
            } as any, // Type assertion for fields that may not be in generated types yet
          }),
          prisma.user.count({ where }),
        ]);

        return {
          users,
          total,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
          },
        };
      } catch (dbError: unknown) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        logger.error('Database error in fetchUsersData', {
          module: 'Users',
          extraData: { error: errorMessage, where, skip, take: limit },
        });
        throw dbError;
      }
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const result = forceRefresh
      ? await reCache(fetchUsersData, {
          key: cacheKey,
          duration: 'medium', // 15 minutes cache
        })
      : await withCache(fetchUsersData, {
          key: cacheKey,
          duration: 'medium', // 15 minutes cache
        });

    return SUCCESS.json(
      'Users retrieved successfully',
      result.users,
      {
        pagination: result.pagination,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting users', {
      module: 'Users',
      extraData: {
        error: errorMessage,
        label: 'GET_USERS',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Create New User
 * POST /api/users
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'add_user');
    if (permissionError) return permissionError;

    const body = await req.json();
    const { 
      email, 
      phone_number, 
      password, 
      first_name, 
      last_name, 
      auth_type, 
      status, 
      gender, 
      country, 
      email_verified, 
      phone_verified,
      master_opt,  // Master option: if true, assign all groups
      master_option,  // Alias for master_opt
      groups  // Optional: specific groups to assign (overrides default)
    } = body;

    if (!password) {
      return ERROR.json('INVALID_REQUEST', { message: 'Password is required' });
    }

    if (!email && !phone_number) {
      return ERROR.json('INVALID_REQUEST', { message: 'Email or phone number is required' });
    }

    // Hash password
    const { hashPassword } = await import('@lib/authenticate/helpers');
    const hashedPassword = hashPassword(password);

    const userData: Record<string, unknown> = {
      password: hashedPassword,
      is_active: status === 'ACTIVE' || true,
      is_verified: email_verified || phone_verified || false,
    };

    if (email) userData.email = email;
    if (phone_number) userData.phone_number = typeof phone_number === 'string' ? { phone: phone_number } : phone_number;
    if (first_name) userData.first_name = first_name;
    if (last_name) userData.last_name = last_name;
    if (auth_type) userData.auth_type = auth_type;
    if (status) userData.account_status = status;
    if (gender) userData.gender = gender;
    if (country) userData.country = country;
    if (email_verified !== undefined) userData.email_verified = email_verified;
    if (phone_verified !== undefined) userData.phone_verified = phone_verified;

    const newUser = await prisma.user.create({
      data: userData as any,
    });

    // Assign groups to user
    try {
      const assignerUserId = user?.uid || user?.user_id || null;
      const useMasterOpt = master_opt === true || master_option === true;
      
      if (useMasterOpt) {
        // Master option: assign all groups
        const { assignGroupsToUser } = await import('@lib/middleware/permissions');
        const allGroups = await prisma.group.findMany({
          where: { is_active: true },
          select: { codename: true },
        });
        const allGroupCodenames = allGroups
          .map(g => g.codename)
          .filter((codename): codename is string => codename !== null);
        
        if (allGroupCodenames.length > 0) {
          await assignGroupsToUser(newUser.user_id, allGroupCodenames, assignerUserId);
          logger.info(`Master option used - assigned all groups to user ${newUser.user_id}`, {
            module: 'Users',
            label: 'CREATE_USER',
            extraData: { 
              userId: newUser.user_id,
              groups: allGroupCodenames,
              assignedBy: assignerUserId
            },
          });
        }
      } else if (groups && Array.isArray(groups) && groups.length > 0) {
        // Specific groups provided
        const { assignGroupsToUser } = await import('@lib/middleware/permissions');
        await assignGroupsToUser(newUser.user_id, groups, assignerUserId);
        logger.info(`Assigned specific groups to user ${newUser.user_id}`, {
          module: 'Users',
          label: 'CREATE_USER',
          extraData: { 
            userId: newUser.user_id,
            groups: groups,
            assignedBy: assignerUserId
          },
        });
      } else {
        // Default: assign "user" group
        const { assignGroupsToUser } = await import('@lib/middleware/permissions');
        await assignGroupsToUser(newUser.user_id, ['user'], assignerUserId);
        logger.info(`Assigned default "user" group to user ${newUser.user_id}`, {
          module: 'Users',
          label: 'CREATE_USER',
          extraData: { 
            userId: newUser.user_id,
            groups: ['user'],
            assignedBy: assignerUserId
          },
        });
      }
    } catch (groupError: unknown) {
      const errorMessage = groupError instanceof Error ? groupError.message : 'Unknown error';
      logger.error(`Failed to assign groups to user ${newUser.user_id}`, {
        module: 'Users',
        label: 'CREATE_USER',
        extraData: { 
          error: errorMessage,
          userId: newUser.user_id
        },
      });
      // Don't fail user creation if group assignment fails, but log it
    }

    // Invalidate cache: Delete related cache keys so data updates in real time
    await invalidateAllUserRelatedCache(newUser.user_id);

    // Create activity log
    const userId = user?.uid || user?.user_id;
    await activityLogService.logCreate(
      userId,
      'users',
      'user',
      newUser.user_id,
      {
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        account_status: newUser.account_status,
      },
      { headers: req.headers, url: req.url, method: 'POST' }
    );

    // Emit WebSocket event for real-time updates
    try {
      emitUserCreated(newUser);
    } catch (wsError) {
      logger.warning('Failed to emit user created WebSocket event', {
        module: 'Users',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    return SUCCESS.json('User created successfully', userWithoutPassword);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating user', {
      module: 'Users',
      extraData: {
        error: errorMessage,
        label: 'CREATE_USER',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

