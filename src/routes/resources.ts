/**
 * Member-facing resource API routes
 * Endpoints for browsing, viewing, and downloading resources
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/session.js';
import {
  listResources,
  getResourceById,
  downloadResource,
  getRecommendedResources,
  getAllTags,
} from '../resources/service.js';
import { ResourceType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const resourcesRouter = Router();

// Schema for list query parameters
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  tags: z.string().optional(), // Comma-separated
  type: z.enum(['TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO']).optional(),
  search: z.string().max(100).optional(),
  featured: z.enum(['true', 'false']).optional(),
});

// ============================================
// Static routes MUST come before dynamic :id routes
// ============================================

/**
 * GET /api/resources/tags
 * Get all available tags for filtering UI
 */
resourcesRouter.get('/tags', requireAuth, async (req: AuthenticatedRequest, res) => {
  const tags = await getAllTags();
  res.json({ tags });
});

/**
 * GET /api/resources/recommended
 * Get personalized recommendations based on download history
 * RES-15: Contextual recommendations
 */
resourcesRouter.get('/recommended', requireAuth, async (req: AuthenticatedRequest, res) => {
  const memberId = req.memberId!;
  const limit = z.coerce.number().min(1).max(10).default(5).parse(req.query.limit || 5);

  const resources = await getRecommendedResources(memberId, limit);
  res.json({ resources });
});

// ============================================
// Main browse/download routes
// ============================================

/**
 * GET /api/resources
 * Browse published resources with filtering
 * RES-06: Faceted filtering by tags, type, search
 */
resourcesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = listQuerySchema.parse(req.query);

  const result = await listResources(
    {
      tags: query.tags?.split(',').filter(Boolean),
      type: query.type as ResourceType | undefined,
      search: query.search,
      isFeatured: query.featured === 'true' ? true : query.featured === 'false' ? false : undefined,
    },
    query.cursor,
    query.limit
  );

  res.json(result);
});

/**
 * GET /api/resources/:id
 * View resource details before downloading
 * RES-07: Preview resource details
 */
resourcesRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);

  const resource = await getResourceById(id);

  if (!resource) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  // Check if published
  const now = new Date();
  const isAvailable =
    resource.status === 'PUBLISHED' ||
    (resource.status === 'SCHEDULED' && resource.publishAt && resource.publishAt <= now);

  if (!isAvailable) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  // Return resource details (without storagePath - member shouldn't see internal paths)
  res.json({
    resource: {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      tags: resource.tags,
      type: resource.type,
      author: resource.author,
      fileSize: resource.fileSize,
      mimeType: resource.mimeType,
      isFeatured: resource.isFeatured,
      downloadCount: resource.downloadCount,
      createdAt: resource.createdAt,
    },
  });
});

/**
 * POST /api/resources/:id/download
 * Download resource - generates signed URL and awards points
 * RES-08: Download via signed URL
 * RES-09: Track download
 * RES-10: Award points
 */
resourcesRouter.post('/:id/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const memberId = req.memberId!;

  // Verify member has an active subscription before allowing download
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { subscriptionStatus: true },
  });

  if (!member || member.subscriptionStatus !== 'ACTIVE') {
    res.status(403).json({ error: 'Active subscription required to download resources' });
    return;
  }

  try {
    const result = await downloadResource(id, memberId);

    res.json({
      downloadUrl: result.url,
      expiresAt: result.expiresAt,
      pointsAwarded: result.pointsAwarded,
    });
  } catch (error) {
    if ((error as Error).message === 'Resource not found') {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }
    if ((error as Error).message === 'Resource not available') {
      res.status(404).json({ error: 'Resource not available' });
      return;
    }
    throw error;
  }
});
