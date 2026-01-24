'use client';

import { FileText, ClipboardList, BookOpen, GraduationCap, Video, Star, Download } from 'lucide-react';
import { Card } from '@/components/ui';
import type { Resource } from '@/lib/api';

interface ResourceCardProps {
  resource: Resource;
  onClick?: () => void;
}

/**
 * Icon mapping for resource types
 */
const typeIcons = {
  TEMPLATE: FileText,
  SOP: ClipboardList,
  PLAYBOOK: BookOpen,
  COURSE: GraduationCap,
  VIDEO: Video,
} as const;

/**
 * ResourceCard - Grid view card for resource library
 *
 * Shows resource with icon, title, description, tags, and popularity badges.
 * Click opens preview modal.
 */
export function ResourceCard({ resource, onClick }: ResourceCardProps) {
  const Icon = typeIcons[resource.type as keyof typeof typeIcons] || FileText;

  // Popularity badges per CONTEXT.md: "Popular" if > 50, "Trending" if > 20
  const isPopular = resource.downloadCount > 50;
  const isTrending = resource.downloadCount > 20 && !isPopular;

  return (
    <Card
      className="cursor-pointer transition-all duration-150 hover:scale-[1.02] p-3 sm:p-4"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header with icon, badges, and featured star */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-accent rounded-[8px]">
              <Icon className="w-5 h-5 text-gold" />
            </div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {resource.type.toLowerCase()}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {resource.isFeatured && (
              <Star className="w-4 h-4 text-gold fill-gold" />
            )}
            {isPopular && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-gold/20 text-gold-dark rounded">
                Popular
              </span>
            )}
            {isTrending && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-success/20 text-success rounded">
                Trending
              </span>
            )}
          </div>
        </div>

        {/* Title and description */}
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground line-clamp-2 text-sm sm:text-base">
            {resource.title}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            {resource.description}
          </p>
        </div>

        {/* Tags */}
        {resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resource.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] sm:text-xs bg-accent text-muted-foreground rounded"
              >
                {tag}
              </span>
            ))}
            {resource.tags.length > 3 && (
              <span className="px-2 py-0.5 text-[10px] sm:text-xs text-muted-foreground">
                +{resource.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Download count footer */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border">
          <Download className="w-3 h-3" />
          <span>{resource.downloadCount} downloads</span>
        </div>
      </div>
    </Card>
  );
}
