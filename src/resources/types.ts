/**
 * Resource domain types for resource library operations.
 * These types augment the Prisma-generated types for API/service use.
 */
import { ResourceType, ResourceStatus } from '@prisma/client';

/**
 * Resource with version and download details.
 * Used for detail views and admin management.
 */
export interface ResourceWithDetails {
  id: string;
  title: string;
  description: string;
  tags: string[];
  type: ResourceType;
  status: ResourceStatus;
  publishAt: Date | null;
  author: string | null;
  uploadedBy: string | null;
  storagePath: string;
  fileSize: number | null;
  mimeType: string | null;
  isFeatured: boolean;
  downloadCount: number;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Input for creating a new resource.
 */
export interface CreateResourceInput {
  title: string;
  description: string;
  tags: string[];
  type: ResourceType;
  status?: ResourceStatus;
  publishAt?: Date;
  author?: string;
  isFeatured?: boolean;
}

/**
 * Input for updating resource metadata.
 * Note: File replacement is separate (creates new version).
 */
export interface UpdateResourceInput {
  title?: string;
  description?: string;
  tags?: string[];
  type?: ResourceType;
  status?: ResourceStatus;
  publishAt?: Date | null;
  author?: string | null;
  isFeatured?: boolean;
}

/**
 * Resource list item (for browse views).
 * Lighter than full details.
 */
export interface ResourceListItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  type: ResourceType;
  author: string | null;
  fileSize: number | null;
  mimeType: string | null;
  isFeatured: boolean;
  downloadCount: number;
  createdAt: Date;
}

/**
 * Admin resource list item (includes status for management).
 */
export interface AdminResourceListItem extends ResourceListItem {
  status: ResourceStatus;
  publishAt: Date | null;
  uploadedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Filters for resource listing (member view - published only).
 */
export interface ResourceFilters {
  tags?: string[];
  type?: ResourceType;
  search?: string;
  isFeatured?: boolean;
}

/**
 * Filters for admin resource listing (all statuses).
 */
export interface AdminResourceFilters extends ResourceFilters {
  status?: ResourceStatus;
  includeDeleted?: boolean;
}

/**
 * Resource analytics data.
 */
export interface ResourceAnalytics {
  totalResources: number;
  totalDownloads: number;
  uniqueDownloaders: number;
  downloadsByResource: {
    resourceId: string;
    title: string;
    downloads: number;
    uniqueDownloaders: number;
  }[];
  trendingResources: {
    resourceId: string;
    title: string;
    recentDownloads: number; // Downloads in last 7 days
  }[];
}

/**
 * Version info for version history.
 */
export interface ResourceVersionInfo {
  id: string;
  version: number;
  fileSize: number | null;
  changelog: string | null;
  uploadedBy: string;
  createdAt: Date;
}

/**
 * Download record for tracking member downloads.
 */
export interface ResourceDownload {
  id: string;
  resourceId: string;
  memberId: string;
  downloadedAt: Date;
}

/**
 * Pagination options for list queries.
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'title' | 'downloadCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
