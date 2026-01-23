/**
 * Admin resource management API routes
 * Endpoints for CRUD, file upload, versioning, and analytics
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../admin/middleware.js';
import { uploadMiddleware } from '../../storage/upload.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';
import { validateFileType } from '../../lib/file-validation.js';
import {
  createResource,
  updateResource,
  uploadNewVersion,
  softDeleteResource,
  getResourceById,
  getVersionHistory,
  getResourceAnalytics,
  getAllTags,
  createTag,
  deleteTag,
  listResourcesAdmin,
} from '../../resources/service.js';
import { ResourceType, ResourceStatus } from '@prisma/client';

export const adminResourcesRouter = Router();

// Schema for creating a resource (metadata in JSON, file as multipart)
const createResourceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  tags: z.array(z.string()).default([]),
  type: z.enum(['TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).default('DRAFT'),
  publishAt: z.string().datetime().optional(),
  author: z.string().max(100).optional(),
  isFeatured: z.boolean().default(false),
});

// ============================================
// Static routes MUST come before dynamic :id routes
// ============================================

/**
 * GET /api/admin/resources/analytics
 * Get resource download analytics
 */
adminResourcesRouter.get('/analytics', requireAdmin, async (req, res) => {
  const analytics = await getResourceAnalytics();
  res.json(analytics);
});

/**
 * GET /api/admin/resources/tags
 * Get all tags
 */
adminResourcesRouter.get('/tags', requireAdmin, async (req, res) => {
  const tags = await getAllTags();
  res.json({ tags });
});

/**
 * POST /api/admin/resources/tags
 * Create new tag
 */
adminResourcesRouter.post('/tags', requireAdmin, async (req, res) => {
  const { name } = z.object({ name: z.string().min(1).max(50) }).parse(req.body);
  const admin = res.locals.admin!;

  try {
    const tag = await createTag(name, admin.id);
    res.status(201).json({ tag });
  } catch (error) {
    // Handle unique constraint violation
    if ((error as any).code === 'P2002') {
      res.status(409).json({ error: 'Tag already exists' });
      return;
    }
    throw error;
  }
});

/**
 * DELETE /api/admin/resources/tags/:id
 * Delete tag
 */
adminResourcesRouter.delete('/tags/:id', requireAdmin, async (req, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);

  try {
    await deleteTag(id);
    res.json({ success: true });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    throw error;
  }
});

// ============================================
// Main CRUD routes
// ============================================

/**
 * POST /api/admin/resources
 * Upload new resource with file and metadata
 * Rate limited: 5 files/hour/admin (SEC-07)
 */
adminResourcesRouter.post(
  '/',
  requireAdmin,
  uploadLimiter,
  uploadMiddleware,
  async (req, res) => {
    const admin = res.locals.admin!;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      // Parse metadata from form field
      const metadata = createResourceSchema.parse(
        JSON.parse(req.body.metadata || '{}')
      );

      // Validate file type via magic number (SEC-02, SEC-03)
      const validation = await validateFileType(req.file.buffer, req.file.originalname);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const resource = await createResource(
        { buffer: req.file.buffer, originalname: req.file.originalname },
        {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          type: metadata.type as ResourceType,
          status: metadata.status as ResourceStatus,
          publishAt: metadata.publishAt ? new Date(metadata.publishAt) : undefined,
          author: metadata.author,
          isFeatured: metadata.isFeatured,
        },
        admin.id
      );

      res.status(201).json({ resource });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid metadata', details: error.issues });
        return;
      }
      throw error;
    }
  }
);

/**
 * GET /api/admin/resources
 * List all resources (including drafts, scheduled, and optionally deleted) for admin management
 * Uses listResourcesAdmin() to show ALL statuses, not just published
 */
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  tags: z.string().optional(), // Comma-separated
  type: z.enum(['TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO']).optional(),
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
});

adminResourcesRouter.get('/', requireAdmin, async (req, res) => {
  const query = listQuerySchema.parse(req.query);

  // Use listResourcesAdmin to get ALL resources (drafts, scheduled, published)
  const resources = await listResourcesAdmin(
    {
      tags: query.tags?.split(',').filter(Boolean),
      type: query.type as ResourceType | undefined,
      search: query.search,
      status: query.status as ResourceStatus | undefined,
      includeDeleted: query.includeDeleted === 'true',
    },
    query.cursor,
    query.limit
  );

  res.json(resources);
});

/**
 * GET /api/admin/resources/:id
 * Get resource details including version history
 */
adminResourcesRouter.get('/:id', requireAdmin, async (req, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);

  const resource = await getResourceById(id, true); // Include deleted for admin
  if (!resource) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  const versions = await getVersionHistory(id);

  res.json({ resource, versions });
});

// Schema for updating resource metadata
const updateResourceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional(),
  publishAt: z.string().datetime().nullable().optional(),
  author: z.string().max(100).nullable().optional(),
  isFeatured: z.boolean().optional(),
});

/**
 * PATCH /api/admin/resources/:id
 * Update resource metadata (no file change)
 */
adminResourcesRouter.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const admin = res.locals.admin!;

  try {
    const updates = updateResourceSchema.parse(req.body);

    const resource = await updateResource(
      id,
      {
        ...updates,
        type: updates.type as ResourceType | undefined,
        status: updates.status as ResourceStatus | undefined,
        publishAt: updates.publishAt === null ? null : updates.publishAt ? new Date(updates.publishAt) : undefined,
      },
      admin.id
    );

    res.json({ resource });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.issues });
      return;
    }
    if ((error as Error).message === 'Resource not found') {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }
    throw error;
  }
});

/**
 * POST /api/admin/resources/:id/version
 * Upload new file version
 * Rate limited: 5 files/hour/admin
 */
adminResourcesRouter.post(
  '/:id/version',
  requireAdmin,
  uploadLimiter,
  uploadMiddleware,
  async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const admin = res.locals.admin!;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const changelog = req.body.changelog as string | undefined;

      // Validate file type
      const validation = await validateFileType(req.file.buffer, req.file.originalname);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const result = await uploadNewVersion(
        id,
        { buffer: req.file.buffer, originalname: req.file.originalname },
        changelog,
        admin.id
      );

      res.json(result);
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }
      throw error;
    }
  }
);

/**
 * DELETE /api/admin/resources/:id
 * Soft delete resource
 */
adminResourcesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const admin = res.locals.admin!;

  try {
    await softDeleteResource(id, admin.id);
    res.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'Resource not found') {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }
    throw error;
  }
});
