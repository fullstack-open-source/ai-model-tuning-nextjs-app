import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getProjectInformationCacheKey } from '@lib/cache/keys';
import { cache } from '@lib/cache/cache';
import { prisma } from '@lib/db/prisma';

// Helper function to map DB data to API response format
function mapProjectToResponse(projectData: any) {
  return {
    id: projectData.id,
    project_id: projectData.project_id,
    name: projectData.name,
    title: projectData.title,
    baseURL: projectData.base_url,
    support_mail: projectData.support_email,
    support_contact: projectData.support_contact,
    company_address: projectData.company_address,
    logo: projectData.logo,
    hlogo: projectData.hlogo,
    flogo: projectData.flogo,
    facebook: projectData.facebook,
    twitter: projectData.twitter,
    instagram: projectData.instagram,
    linkedin: projectData.linkedin,
    youtube: projectData.youtube,
    tiktok: projectData.tiktok,
    whatsapp: projectData.whatsapp,
    vimeo: projectData.vimeo,
    pintrest: projectData.pinterest,
    meta_title: projectData.meta_title,
    meta_description: projectData.meta_description,
    meta_keywords: projectData.meta_keywords,
    head_meta_data: projectData.head_meta_data,
    body_meta_data: projectData.body_meta_data,
    extra_meta_data: projectData.extra_meta_data,
    created_at: projectData.created_at,
    last_updated: projectData.updated_at,
  };
}

// Helper function to invalidate project cache
async function invalidateProjectCache() {
  try {
    const cacheKey = getProjectInformationCacheKey();
    await cache.delete(cacheKey);
    logger.debug('Project cache invalidated', {
      module: 'Project',
      extraData: { key: cacheKey },
    });
  } catch (error) {
    logger.warning('Failed to invalidate project cache', {
      module: 'Project',
      extraData: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

/**
 * Get project information
 * GET /api/project/information
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');
    
    const cacheKey = getProjectInformationCacheKey();
    
    const fetchProjectInfo = async () => {
      // Try to get project info from database first
      let projectData = await prisma.projectSettings.findFirst({
        orderBy: { id: 'asc' },
      });

      // If no database record, create one with env defaults
      if (!projectData) {
        try {
          projectData = await prisma.projectSettings.create({
            data: {
              project_id: 'default',
              name: process.env.PROJECT_NAME || 'My Project',
              title: process.env.PROJECT_TITLE || process.env.PROJECT_NAME || 'My Project',
              base_url: process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || null,
              support_email: process.env.SUPPORT_EMAIL || null,
              logo: process.env.PROJECT_LOGO_URL || null,
              flogo: process.env.PROJECT_FAVICON_URL || null,
            },
          });
        } catch (createError) {
          // If creation fails (e.g., race condition), try to fetch again
          projectData = await prisma.projectSettings.findFirst({
            orderBy: { id: 'asc' },
          });
          
          // If still no data, return defaults
          if (!projectData) {
            return {
              project: {
                id: 0,
                project_id: 'default',
                name: process.env.PROJECT_NAME || 'My Project',
                title: process.env.PROJECT_TITLE || process.env.PROJECT_NAME || 'My Project',
                baseURL: process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || null,
                support_mail: process.env.SUPPORT_EMAIL || null,
                logo: process.env.PROJECT_LOGO_URL || null,
                flogo: process.env.PROJECT_FAVICON_URL || null,
              }
            };
          }
        }
      }

      return { project: mapProjectToResponse(projectData) };
    };

    const result = forceRefresh
      ? await reCache(fetchProjectInfo, { key: cacheKey, duration: 'very_long' })
      : await withCache(fetchProjectInfo, { key: cacheKey, duration: 'very_long' });

    const response = SUCCESS.json('Project information retrieved', result);
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting project information', {
      module: 'Project',
      extraData: { error: errorMessage },
    });
    return ERROR.json('INTERNAL_ERROR', { message: errorMessage }, error);
  }
}

/**
 * Update project information (full update)
 * PUT /api/project/information
 */
export async function PUT(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_project_settings');
    if (permissionError) return permissionError;

    const body = await req.json();
    
    // Get existing project or create new one
    let projectData = await prisma.projectSettings.findFirst({
      orderBy: { id: 'asc' },
    });

    const updateData = {
      name: body.name ?? null,
      title: body.title ?? null,
      base_url: body.baseURL ?? body.base_url ?? null,
      support_email: body.support_mail ?? body.support_email ?? null,
      support_contact: body.support_contact ?? null,
      company_address: body.company_address ?? null,
      logo: body.logo ?? null,
      hlogo: body.hlogo ?? null,
      flogo: body.flogo ?? null,
      facebook: body.facebook ?? null,
      twitter: body.twitter ?? null,
      instagram: body.instagram ?? null,
      linkedin: body.linkedin ?? null,
      youtube: body.youtube ?? null,
      tiktok: body.tiktok ?? null,
      whatsapp: body.whatsapp ?? null,
      vimeo: body.vimeo ?? null,
      pinterest: body.pintrest ?? body.pinterest ?? null,
      meta_title: body.meta_title ?? null,
      meta_description: body.meta_description ?? null,
      meta_keywords: body.meta_keywords ?? null,
      head_meta_data: body.head_meta_data ?? null,
      body_meta_data: body.body_meta_data ?? null,
      extra_meta_data: body.extra_meta_data ?? null,
    };

    if (projectData) {
      projectData = await prisma.projectSettings.update({
        where: { id: projectData.id },
        data: updateData,
      });
    } else {
      projectData = await prisma.projectSettings.create({
        data: {
          project_id: body.project_id || 'default',
          ...updateData,
        },
      });
    }

    // Invalidate cache immediately
    await invalidateProjectCache();

    logger.info('Project information updated', {
      module: 'Project',
      extraData: { userId: user.uid || user.user_id, projectId: projectData.id },
    });

    return SUCCESS.json('Project information updated successfully', {
      project: mapProjectToResponse(projectData)
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating project information', {
      module: 'Project',
      extraData: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    });
    return ERROR.json('INTERNAL_ERROR', { message: errorMessage }, error);
  }
}

/**
 * Partial update project information
 * PATCH /api/project/information
 */
export async function PATCH(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_project_settings');
    if (permissionError) return permissionError;

    const body = await req.json();
    
    // Get existing project
    let projectData = await prisma.projectSettings.findFirst({
      orderBy: { id: 'asc' },
    });

    // Build update data - only include fields that are explicitly provided
    const updateData: Record<string, string | null> = {};
    
    if ('name' in body) updateData.name = body.name;
    if ('title' in body) updateData.title = body.title;
    if ('baseURL' in body) updateData.base_url = body.baseURL;
    if ('base_url' in body) updateData.base_url = body.base_url;
    if ('support_mail' in body) updateData.support_email = body.support_mail;
    if ('support_email' in body) updateData.support_email = body.support_email;
    if ('support_contact' in body) updateData.support_contact = body.support_contact;
    if ('company_address' in body) updateData.company_address = body.company_address;
    if ('logo' in body) updateData.logo = body.logo;
    if ('hlogo' in body) updateData.hlogo = body.hlogo;
    if ('flogo' in body) updateData.flogo = body.flogo;
    if ('facebook' in body) updateData.facebook = body.facebook;
    if ('twitter' in body) updateData.twitter = body.twitter;
    if ('instagram' in body) updateData.instagram = body.instagram;
    if ('linkedin' in body) updateData.linkedin = body.linkedin;
    if ('youtube' in body) updateData.youtube = body.youtube;
    if ('tiktok' in body) updateData.tiktok = body.tiktok;
    if ('whatsapp' in body) updateData.whatsapp = body.whatsapp;
    if ('vimeo' in body) updateData.vimeo = body.vimeo;
    if ('pintrest' in body) updateData.pinterest = body.pintrest;
    if ('pinterest' in body) updateData.pinterest = body.pinterest;
    if ('meta_title' in body) updateData.meta_title = body.meta_title;
    if ('meta_description' in body) updateData.meta_description = body.meta_description;
    if ('meta_keywords' in body) updateData.meta_keywords = body.meta_keywords;
    if ('head_meta_data' in body) updateData.head_meta_data = body.head_meta_data;
    if ('body_meta_data' in body) updateData.body_meta_data = body.body_meta_data;
    if ('extra_meta_data' in body) updateData.extra_meta_data = body.extra_meta_data;

    if (projectData) {
      // Update existing record
      projectData = await prisma.projectSettings.update({
        where: { id: projectData.id },
        data: updateData,
      });
    } else {
      // Create new record
      projectData = await prisma.projectSettings.create({
        data: {
          project_id: body.project_id || 'default',
          name: updateData.name || process.env.PROJECT_NAME || 'My Project',
          ...updateData,
        },
      });
    }

    // Invalidate cache immediately for instant refresh
    await invalidateProjectCache();

    logger.info('Project information updated (PATCH)', {
      module: 'Project',
      extraData: { 
        userId: user.uid || user.user_id, 
        projectId: projectData.id, 
        updatedFields: Object.keys(updateData) 
      },
    });

    return SUCCESS.json('Project information updated successfully', {
      project: mapProjectToResponse(projectData)
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating project information (PATCH)', {
      module: 'Project',
      extraData: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    });
    return ERROR.json('INTERNAL_ERROR', { message: errorMessage }, error);
  }
}

/**
 * Create project information
 * POST /api/project/information
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'manage_project_settings');
    if (permissionError) return permissionError;

    const body = await req.json();
    
    // Check if project settings already exist
    const existing = await prisma.projectSettings.findFirst();
    if (existing) {
      return ERROR.json('RESOURCE_ALREADY_EXISTS', { message: 'Project settings already exist. Use PATCH to update.' });
    }

    const projectData = await prisma.projectSettings.create({
      data: {
        project_id: body.project_id || 'default',
        name: body.name ?? null,
        title: body.title ?? null,
        base_url: body.baseURL ?? body.base_url ?? null,
        support_email: body.support_mail ?? body.support_email ?? null,
        support_contact: body.support_contact ?? null,
        company_address: body.company_address ?? null,
        logo: body.logo ?? null,
        hlogo: body.hlogo ?? null,
        flogo: body.flogo ?? null,
        facebook: body.facebook ?? null,
        twitter: body.twitter ?? null,
        instagram: body.instagram ?? null,
        linkedin: body.linkedin ?? null,
        youtube: body.youtube ?? null,
        tiktok: body.tiktok ?? null,
        whatsapp: body.whatsapp ?? null,
        vimeo: body.vimeo ?? null,
        pinterest: body.pintrest ?? body.pinterest ?? null,
        meta_title: body.meta_title ?? null,
        meta_description: body.meta_description ?? null,
        meta_keywords: body.meta_keywords ?? null,
        head_meta_data: body.head_meta_data ?? null,
        body_meta_data: body.body_meta_data ?? null,
        extra_meta_data: body.extra_meta_data ?? null,
      },
    });

    // Invalidate cache
    await invalidateProjectCache();

    logger.info('Project information created', {
      module: 'Project',
      extraData: { userId: user.uid || user.user_id, projectId: projectData.id },
    });

    return SUCCESS.json('Project information created successfully', {
      project: mapProjectToResponse(projectData)
    }, {}, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating project information', {
      module: 'Project',
      extraData: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
    });
    return ERROR.json('INTERNAL_ERROR', { message: errorMessage }, error);
  }
}
