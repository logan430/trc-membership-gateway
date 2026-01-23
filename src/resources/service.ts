/**
 * Resource service layer
 * Handles CRUD, downloads, versioning, and analytics
 */
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { uploadToStorage, deleteFromStorage } from '../storage/upload.js';
import { generateSignedUrl } from '../storage/download.js';
import { validateFileType } from '../lib/file-validation.js';
import { awardDownloadPoints } from '../points/service.js';
import { logAuditEvent, AuditAction } from '../lib/audit.js';
import { ResourceStatus, ResourceType } from '@prisma/client';
import type {
  CreateResourceInput,
  UpdateResourceInput,
  ResourceFilters,
  AdminResourceFilters,
  ResourceListItem,
  AdminResourceListItem,
  ResourceWithDetails,
  ResourceAnalytics,
  ResourceVersionInfo,
} from './types.js';

// Version retention limit per CONTEXT.md (Claude's discretion: keep last 5)
const MAX_VERSIONS_TO_KEEP = 5;

/**
 * Create a new resource with file upload
 * RES-01: Admin uploads file with metadata
 */
export async function createResource(
  file: { buffer: Buffer; originalname: string },
  input: CreateResourceInput,
  adminId: string
): Promise<ResourceWithDetails> {
  // Validate file type via magic number (RES-02)
  const validation = await validateFileType(file.buffer, file.originalname);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Upload to Supabase Storage (RES-03)
  const uploadResult = await uploadToStorage(
    file.buffer,
    file.originalname,
    adminId,
    validation.detectedMime!
  );

  // Create resource and initial version in transaction
  const resource = await prisma.$transaction(async (tx) => {
    const res = await tx.resource.create({
      data: {
        title: input.title,
        description: input.description,
        tags: input.tags,
        type: input.type,
        status: input.status ?? 'DRAFT',
        publishAt: input.publishAt ?? null,
        author: input.author ?? null,
        isFeatured: input.isFeatured ?? false,
        uploadedBy: adminId,
        storagePath: uploadResult.storagePath,
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
        currentVersion: 1,
      },
    });

    // Create initial version record
    await tx.resourceVersion.create({
      data: {
        resourceId: res.id,
        version: 1,
        storagePath: uploadResult.storagePath,
        fileSize: uploadResult.fileSize,
        uploadedBy: adminId,
      },
    });

    return res;
  });

  // Log audit event
  await logAuditEvent({
    action: AuditAction.RESOURCE_CREATED,
    entityType: 'Resource',
    entityId: resource.id,
    details: {
      title: resource.title,
      type: resource.type,
      tags: resource.tags,
      status: resource.status,
    },
    performedBy: adminId,
  });

  logger.info({ resourceId: resource.id, title: resource.title }, 'Resource created');

  return resource as ResourceWithDetails;
}

/**
 * Update resource metadata (no file change)
 * RES-12: Admin can update title, description, tags, etc.
 * Does NOT create new version - metadata is independent of file
 */
export async function updateResource(
  resourceId: string,
  input: UpdateResourceInput,
  adminId: string
): Promise<ResourceWithDetails> {
  const existing = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!existing || existing.deletedAt) {
    throw new Error('Resource not found');
  }

  const resource = await prisma.resource.update({
    where: { id: resourceId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.publishAt !== undefined && { publishAt: input.publishAt }),
      ...(input.author !== undefined && { author: input.author }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
    },
  });

  await logAuditEvent({
    action: AuditAction.RESOURCE_UPDATED,
    entityType: 'Resource',
    entityId: resourceId,
    details: { updates: input },
    performedBy: adminId,
  });

  logger.info({ resourceId, updates: input }, 'Resource metadata updated');

  return resource as ResourceWithDetails;
}

/**
 * Upload new file version
 * RES-13: Replace file with version history
 */
export async function uploadNewVersion(
  resourceId: string,
  file: { buffer: Buffer; originalname: string },
  changelog: string | undefined,
  adminId: string
): Promise<{ resource: ResourceWithDetails; version: ResourceVersionInfo }> {
  const existing = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!existing || existing.deletedAt) {
    throw new Error('Resource not found');
  }

  // Validate file type
  const validation = await validateFileType(file.buffer, file.originalname);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Upload to storage
  const uploadResult = await uploadToStorage(
    file.buffer,
    file.originalname,
    adminId,
    validation.detectedMime!
  );

  const newVersionNumber = existing.currentVersion + 1;

  // Create version and update resource in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create new version
    const version = await tx.resourceVersion.create({
      data: {
        resourceId,
        version: newVersionNumber,
        storagePath: uploadResult.storagePath,
        fileSize: uploadResult.fileSize,
        changelog: changelog ?? null,
        uploadedBy: adminId,
      },
    });

    // Update resource to point to new version
    const resource = await tx.resource.update({
      where: { id: resourceId },
      data: {
        storagePath: uploadResult.storagePath,
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
        currentVersion: newVersionNumber,
      },
    });

    return { resource, version };
  });

  // Prune old versions (keep last MAX_VERSIONS_TO_KEEP)
  await pruneOldVersions(resourceId);

  await logAuditEvent({
    action: AuditAction.RESOURCE_VERSION_UPLOADED,
    entityType: 'Resource',
    entityId: resourceId,
    details: {
      version: newVersionNumber,
      changelog,
      previousVersion: existing.currentVersion,
    },
    performedBy: adminId,
  });

  logger.info({ resourceId, version: newVersionNumber, changelog }, 'New resource version uploaded');

  return {
    resource: result.resource as ResourceWithDetails,
    version: result.version as ResourceVersionInfo,
  };
}

/**
 * Prune old versions beyond retention limit
 * Deletes files from storage and version records
 */
async function pruneOldVersions(resourceId: string): Promise<void> {
  const versions = await prisma.resourceVersion.findMany({
    where: { resourceId },
    orderBy: { version: 'desc' },
  });

  if (versions.length <= MAX_VERSIONS_TO_KEEP) {
    return;
  }

  const versionsToDelete = versions.slice(MAX_VERSIONS_TO_KEEP);

  for (const version of versionsToDelete) {
    try {
      await deleteFromStorage(version.storagePath);
    } catch (err) {
      logger.warn({ resourceId, version: version.version, error: err }, 'Failed to delete old version file');
    }

    await prisma.resourceVersion.delete({
      where: { id: version.id },
    });
  }

  logger.info(
    { resourceId, deletedVersions: versionsToDelete.length },
    'Pruned old resource versions'
  );
}

/**
 * Soft delete resource
 * RES-14: Sets deletedAt, preserves for audit
 */
export async function softDeleteResource(
  resourceId: string,
  adminId: string
): Promise<void> {
  const existing = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!existing) {
    throw new Error('Resource not found');
  }

  await prisma.resource.update({
    where: { id: resourceId },
    data: { deletedAt: new Date() },
  });

  await logAuditEvent({
    action: AuditAction.RESOURCE_DELETED,
    entityType: 'Resource',
    entityId: resourceId,
    details: { title: existing.title },
    performedBy: adminId,
  });

  logger.info({ resourceId, title: existing.title }, 'Resource soft deleted');
}

/**
 * Get resource by ID (admin view - includes drafts and scheduled)
 */
export async function getResourceById(
  resourceId: string,
  includeDeleted = false
): Promise<ResourceWithDetails | null> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource) return null;
  if (resource.deletedAt && !includeDeleted) return null;

  return resource as ResourceWithDetails;
}

/**
 * Get resource version history
 */
export async function getVersionHistory(resourceId: string): Promise<ResourceVersionInfo[]> {
  const versions = await prisma.resourceVersion.findMany({
    where: { resourceId },
    orderBy: { version: 'desc' },
  });

  return versions as ResourceVersionInfo[];
}

/**
 * List published resources for members
 * RES-06: Browse with filtering (tags, type, search)
 */
export async function listResources(
  filters: ResourceFilters,
  cursor?: string,
  limit = 20
): Promise<{ resources: ResourceListItem[]; nextCursor: string | null }> {
  const now = new Date();

  const where: any = {
    deletedAt: null,
    OR: [
      { status: 'PUBLISHED' },
      { status: 'SCHEDULED', publishAt: { lte: now } }, // Scheduled and past publish date
    ],
  };

  // Tag filter (any of the provided tags)
  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  // Type filter
  if (filters.type) {
    where.type = filters.type;
  }

  // Featured filter
  if (filters.isFeatured !== undefined) {
    where.isFeatured = filters.isFeatured;
  }

  // Search filter (title and description)
  if (filters.search) {
    where.AND = [
      {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const resources = await prisma.resource.findMany({
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    where,
    orderBy: [
      { isFeatured: 'desc' }, // Featured first
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      type: true,
      author: true,
      fileSize: true,
      mimeType: true,
      isFeatured: true,
      downloadCount: true,
      createdAt: true,
    },
  });

  const hasMore = resources.length > limit;
  const results = hasMore ? resources.slice(0, limit) : resources;

  return {
    resources: results as ResourceListItem[],
    nextCursor: hasMore ? results[results.length - 1].id : null,
  };
}

/**
 * List all resources for admin management
 * Includes drafts, scheduled, and optionally deleted resources
 */
export async function listResourcesAdmin(
  filters: AdminResourceFilters,
  cursor?: string,
  limit = 50
): Promise<{ resources: AdminResourceListItem[]; nextCursor: string | null }> {
  const where: any = {};

  // Handle deleted filter
  if (filters.includeDeleted !== true) {
    where.deletedAt = null;
  }

  // Status filter (optional - admin can filter by specific status)
  if (filters.status) {
    where.status = filters.status;
  }

  // Tag filter (any of the provided tags)
  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  // Type filter
  if (filters.type) {
    where.type = filters.type;
  }

  // Featured filter
  if (filters.isFeatured !== undefined) {
    where.isFeatured = filters.isFeatured;
  }

  // Search filter (title and description)
  if (filters.search) {
    where.AND = [
      {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const resources = await prisma.resource.findMany({
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    where,
    orderBy: [
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      type: true,
      status: true,
      publishAt: true,
      author: true,
      uploadedBy: true,
      fileSize: true,
      mimeType: true,
      isFeatured: true,
      downloadCount: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  const hasMore = resources.length > limit;
  const results = hasMore ? resources.slice(0, limit) : resources;

  return {
    resources: results as AdminResourceListItem[],
    nextCursor: hasMore ? results[results.length - 1].id : null,
  };
}

/**
 * Download resource
 * RES-08, RES-09, RES-10: Generate signed URL, track download, award points
 */
export async function downloadResource(
  resourceId: string,
  memberId: string
): Promise<{ url: string; expiresAt: Date; pointsAwarded: boolean }> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource || resource.deletedAt) {
    throw new Error('Resource not found');
  }

  // Check if published (or scheduled and past publish date)
  const now = new Date();
  const isPublished =
    resource.status === 'PUBLISHED' ||
    (resource.status === 'SCHEDULED' && resource.publishAt && resource.publishAt <= now);

  if (!isPublished) {
    throw new Error('Resource not available');
  }

  // Ensure storagePath exists (should always exist for valid resources)
  if (!resource.storagePath) {
    throw new Error('Resource file not available');
  }

  // Generate signed URL (SEC-05, SEC-06)
  const signedUrl = await generateSignedUrl(resource.storagePath, resource.title);

  // Record download (RES-09)
  await prisma.resourceDownload.create({
    data: {
      memberId,
      resourceId,
    },
  });

  // Increment download count (denormalized for fast sorting)
  await prisma.resource.update({
    where: { id: resourceId },
    data: { downloadCount: { increment: 1 } },
  });

  // Award points (RES-10) - first download only per resource (handled by awardDownloadPoints idempotency)
  const pointsResult = await awardDownloadPoints(memberId, resourceId, resource.title);

  logger.info(
    { resourceId, memberId, pointsAwarded: pointsResult.awarded },
    'Resource downloaded'
  );

  return {
    url: signedUrl.url,
    expiresAt: signedUrl.expiresAt,
    pointsAwarded: pointsResult.awarded,
  };
}

/**
 * Get resource analytics for admin dashboard
 * RES-11: Downloads, unique downloaders, trending
 */
export async function getResourceAnalytics(): Promise<ResourceAnalytics> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Total resources (excluding deleted)
  const totalResources = await prisma.resource.count({
    where: { deletedAt: null },
  });

  // Total downloads
  const totalDownloads = await prisma.resourceDownload.count();

  // Unique downloaders
  const uniqueDownloaders = await prisma.resourceDownload.groupBy({
    by: ['memberId'],
  });

  // Downloads by resource
  const downloadsByResource = await prisma.resource.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      downloadCount: true,
      _count: {
        select: { downloads: true },
      },
      downloads: {
        select: { memberId: true },
        distinct: ['memberId'],
      },
    },
    orderBy: { downloadCount: 'desc' },
    take: 20,
  });

  // Trending resources (most downloads in last 7 days)
  const recentDownloads = await prisma.resourceDownload.groupBy({
    by: ['resourceId'],
    where: { downloadedAt: { gte: sevenDaysAgo } },
    _count: { resourceId: true },
    orderBy: { _count: { resourceId: 'desc' } },
    take: 10,
  });

  const trendingResourceIds = recentDownloads.map((d) => d.resourceId);
  const trendingResources = await prisma.resource.findMany({
    where: { id: { in: trendingResourceIds }, deletedAt: null },
    select: { id: true, title: true },
  });

  const trendingMap = new Map(trendingResources.map((r) => [r.id, r.title]));

  return {
    totalResources,
    totalDownloads,
    uniqueDownloaders: uniqueDownloaders.length,
    downloadsByResource: downloadsByResource.map((r) => ({
      resourceId: r.id,
      title: r.title,
      downloads: r.downloadCount,
      uniqueDownloaders: r.downloads.length,
    })),
    trendingResources: recentDownloads.map((d) => ({
      resourceId: d.resourceId,
      title: trendingMap.get(d.resourceId) ?? 'Unknown',
      recentDownloads: d._count.resourceId,
    })),
  };
}

/**
 * Get all tags (for admin management and member filtering)
 */
export async function getAllTags(): Promise<{ id: string; name: string }[]> {
  return prisma.resourceTag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/**
 * Create new tag (admin only)
 */
export async function createTag(name: string, adminId: string): Promise<{ id: string; name: string }> {
  const tag = await prisma.resourceTag.create({
    data: {
      name: name.trim(),
      createdBy: adminId,
    },
  });

  logger.info({ tagId: tag.id, name: tag.name }, 'Resource tag created');

  return { id: tag.id, name: tag.name };
}

/**
 * Delete tag (admin only)
 * Note: Does not remove tag from existing resources
 */
export async function deleteTag(tagId: string): Promise<void> {
  await prisma.resourceTag.delete({
    where: { id: tagId },
  });

  logger.info({ tagId }, 'Resource tag deleted');
}

/**
 * Get recommended resources for member
 * RES-15: Simple recommendation based on previously downloaded resource tags
 */
export async function getRecommendedResources(
  memberId: string,
  limit = 5
): Promise<ResourceListItem[]> {
  // Get tags from member's downloaded resources
  const downloads = await prisma.resourceDownload.findMany({
    where: { memberId },
    select: { resource: { select: { tags: true } } },
    orderBy: { downloadedAt: 'desc' },
    take: 10, // Look at last 10 downloads
  });

  // Collect all tags
  const tagCounts = new Map<string, number>();
  for (const d of downloads) {
    for (const tag of d.resource.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  // If no download history, return featured resources
  if (tagCounts.size === 0) {
    const { resources } = await listResources({ isFeatured: true }, undefined, limit);
    return resources;
  }

  // Sort tags by frequency
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  // Get downloaded resource IDs to exclude
  const downloadedIds = await prisma.resourceDownload.findMany({
    where: { memberId },
    select: { resourceId: true },
  });
  const downloadedSet = new Set(downloadedIds.map((d) => d.resourceId));

  // Find resources with matching tags that member hasn't downloaded
  const now = new Date();
  const recommendations = await prisma.resource.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [...downloadedSet] },
      tags: { hasSome: topTags },
      OR: [
        { status: 'PUBLISHED' },
        { status: 'SCHEDULED', publishAt: { lte: now } },
      ],
    },
    orderBy: { downloadCount: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      type: true,
      author: true,
      fileSize: true,
      mimeType: true,
      isFeatured: true,
      downloadCount: true,
      createdAt: true,
    },
  });

  return recommendations as ResourceListItem[];
}
