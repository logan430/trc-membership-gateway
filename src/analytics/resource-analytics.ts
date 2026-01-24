/**
 * Resource analytics service
 * ANALYTICS-04: Resource download analytics
 */

import { prisma } from '../lib/prisma.js';
import type {
  ResourceStats,
  PopularResource,
  TrendingResource,
  DateRange,
} from './types.js';

// =============================================================================
// ANALYTICS-04: Resource Statistics
// =============================================================================

/**
 * Get resource library overview statistics
 * Includes total resources, downloads, unique downloaders
 */
export async function getResourceStats(range?: DateRange): Promise<ResourceStats> {
  const whereClause = range
    ? { downloadedAt: { gte: range.startDate, lt: range.endDate } }
    : {};

  const [totalResources, totalDownloads, uniqueDownloaders, downloadsThisPeriod] =
    await Promise.all([
      // Total published resources (not deleted)
      prisma.resource.count({
        where: { deletedAt: null, status: 'PUBLISHED' },
      }),
      // Total downloads ever
      prisma.resourceDownload.count(),
      // Unique members who have downloaded
      prisma.resourceDownload
        .groupBy({ by: ['memberId'] })
        .then((g) => g.length),
      // Downloads in specified period (or all if no range)
      range
        ? prisma.resourceDownload.count({ where: whereClause })
        : prisma.resourceDownload.count(),
    ]);

  return {
    totalResources,
    totalDownloads,
    uniqueDownloaders,
    downloadsThisPeriod,
  };
}

// =============================================================================
// ANALYTICS-04: Popular Resources
// =============================================================================

/**
 * Get most popular resources by download count
 * Includes download count and unique downloader count
 */
export async function getPopularResources(
  limit = 10
): Promise<PopularResource[]> {
  const resources = await prisma.resource.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    orderBy: { downloadCount: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      downloadCount: true,
    },
  });

  // Get unique downloader count per resource
  const uniqueCounts = await Promise.all(
    resources.map((r) =>
      prisma.resourceDownload
        .groupBy({
          by: ['memberId'],
          where: { resourceId: r.id },
        })
        .then((g) => g.length)
    )
  );

  return resources.map((r, i) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    downloadCount: r.downloadCount,
    uniqueDownloaders: uniqueCounts[i],
  }));
}

// =============================================================================
// ANALYTICS-04: Trending Resources
// =============================================================================

/**
 * Get trending resources based on recent download growth
 * Compares last 7 days vs previous 7 days
 */
export async function getTrendingResources(
  limit = 10
): Promise<TrendingResource[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get download counts for last 7 days and previous 7 days per resource
  const rows = await prisma.$queryRaw<
    Array<{
      resourceId: string;
      recentDownloads: bigint;
      previousDownloads: bigint;
    }>
  >`
    SELECT
      "resourceId",
      COUNT(*) FILTER (WHERE "downloadedAt" >= ${sevenDaysAgo})::bigint as "recentDownloads",
      COUNT(*) FILTER (WHERE "downloadedAt" >= ${fourteenDaysAgo} AND "downloadedAt" < ${sevenDaysAgo})::bigint as "previousDownloads"
    FROM "ResourceDownload"
    WHERE "downloadedAt" >= ${fourteenDaysAgo}
    GROUP BY "resourceId"
    HAVING COUNT(*) FILTER (WHERE "downloadedAt" >= ${sevenDaysAgo}) > 0
    ORDER BY COUNT(*) FILTER (WHERE "downloadedAt" >= ${sevenDaysAgo}) DESC
    LIMIT ${limit * 2}
  `;

  // Get resource details
  const resourceIds = rows.map((r) => r.resourceId);
  const resources = await prisma.resource.findMany({
    where: { id: { in: resourceIds }, deletedAt: null },
    select: { id: true, title: true, type: true },
  });

  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  // Calculate growth and filter
  const results: TrendingResource[] = [];

  for (const row of rows) {
    const resource = resourceMap.get(row.resourceId);
    if (!resource) continue;

    const recent = Number(row.recentDownloads);
    const previous = Number(row.previousDownloads);
    const growthPercent =
      previous === 0
        ? 100
        : Math.round(((recent - previous) / previous) * 100);

    results.push({
      id: resource.id,
      title: resource.title,
      type: resource.type as string,
      recentDownloads: recent,
      previousDownloads: previous,
      growthPercent,
    });
  }

  return results
    .sort((a, b) => b.growthPercent - a.growthPercent)
    .slice(0, limit);
}
