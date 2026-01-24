/**
 * Analytics Export Service
 * ANALYTICS-08: Export data for CRM sync (CSV or JSON)
 */

import { Parser } from 'json2csv';
import { prisma } from '../lib/prisma.js';
import type { Response } from 'express';

// Export filters
interface ExportFilters {
  subscriptionStatus?: string[];
  minPoints?: number;
  maxPoints?: number;
  activeWithin?: number; // days
  createdAfter?: Date;
  createdBefore?: Date;
}

// Member export data shape
interface MemberExportRow {
  id: string;
  email: string | null;
  discordUsername: string | null;
  company: string | null;
  jobTitle: string | null;
  subscriptionStatus: string;
  totalPoints: number;
  currentStreak: number;
  lastActiveAt: string | null;
  createdAt: string;
}

/**
 * Get members for export with optional filters
 */
async function getMembersForExport(filters: ExportFilters = {}): Promise<MemberExportRow[]> {
  const where: Record<string, unknown> = {};

  if (filters.subscriptionStatus?.length) {
    where.subscriptionStatus = { in: filters.subscriptionStatus };
  }

  if (filters.minPoints !== undefined) {
    where.totalPoints = { ...(where.totalPoints as object || {}), gte: filters.minPoints };
  }

  if (filters.maxPoints !== undefined) {
    where.totalPoints = { ...(where.totalPoints as object || {}), lte: filters.maxPoints };
  }

  if (filters.activeWithin) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.activeWithin);
    where.lastActiveAt = { gte: cutoff };
  }

  if (filters.createdAfter) {
    where.createdAt = { ...(where.createdAt as object || {}), gte: filters.createdAfter };
  }

  if (filters.createdBefore) {
    where.createdAt = { ...(where.createdAt as object || {}), lte: filters.createdBefore };
  }

  const members = await prisma.member.findMany({
    where,
    select: {
      id: true,
      email: true,
      discordUsername: true,
      company: true,
      jobTitle: true,
      subscriptionStatus: true,
      totalPoints: true,
      currentStreak: true,
      lastActiveAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10000, // Limit to prevent memory issues
  });

  return members.map((m) => ({
    id: m.id,
    email: m.email,
    discordUsername: m.discordUsername,
    company: m.company,
    jobTitle: m.jobTitle,
    subscriptionStatus: m.subscriptionStatus,
    totalPoints: m.totalPoints,
    currentStreak: m.currentStreak,
    lastActiveAt: m.lastActiveAt?.toISOString() || null,
    createdAt: m.createdAt.toISOString(),
  }));
}

/**
 * Export members to CSV and send as response
 */
export async function exportMembersToCsv(
  res: Response,
  filters: ExportFilters = {}
): Promise<void> {
  const members = await getMembersForExport(filters);

  const fields = [
    { label: 'ID', value: 'id' },
    { label: 'Email', value: 'email' },
    { label: 'Discord Username', value: 'discordUsername' },
    { label: 'Company', value: 'company' },
    { label: 'Job Title', value: 'jobTitle' },
    { label: 'Subscription Status', value: 'subscriptionStatus' },
    { label: 'Total Points', value: 'totalPoints' },
    { label: 'Current Streak', value: 'currentStreak' },
    { label: 'Last Active', value: 'lastActiveAt' },
    { label: 'Created At', value: 'createdAt' },
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(members);

  const filename = `members-export-${new Date().toISOString().split('T')[0]}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

/**
 * Export members to JSON and send as response
 */
export async function exportMembersToJson(
  res: Response,
  filters: ExportFilters = {}
): Promise<void> {
  const members = await getMembersForExport(filters);

  const filename = `members-export-${new Date().toISOString().split('T')[0]}.json`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json({
    exportedAt: new Date().toISOString(),
    count: members.length,
    members,
  });
}

/**
 * Export any analytics data to CSV
 * Generic function for exporting arrays of objects
 */
export async function exportAnalyticsCsv<T extends Record<string, unknown>>(
  res: Response,
  data: T[],
  filename: string,
  fields?: { label: string; value: string }[]
): Promise<void> {
  // Auto-detect fields if not provided
  const exportFields = fields || (data.length > 0
    ? Object.keys(data[0]).map((key) => ({ label: key, value: key }))
    : []);

  const parser = new Parser({ fields: exportFields });
  const csv = parser.parse(data);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// Export types for use in routes
export type { ExportFilters };
