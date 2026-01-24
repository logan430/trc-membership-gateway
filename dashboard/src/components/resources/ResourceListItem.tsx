'use client';

import { FileText, ClipboardList, BookOpen, GraduationCap, Video, Star, Download } from 'lucide-react';
import type { Resource } from '@/lib/api';

interface ResourceListItemProps {
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
 * ResourceListItem - Horizontal row view for resource library list mode
 *
 * Compact layout showing icon, title, description, type badge, and download count.
 * Mobile responsive: stacks on small screens.
 */
export function ResourceListItem({ resource, onClick }: ResourceListItemProps) {
  const Icon = typeIcons[resource.type as keyof typeof typeIcons] || FileText;

  // Popularity badges
  const isPopular = resource.downloadCount > 50;
  const isTrending = resource.downloadCount > 20 && !isPopular;

  return (
    <button
      type="button"
      className="w-full text-left p-3 sm:p-4 hover:bg-accent/50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-inset"
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        {/* Icon */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="p-2 bg-accent rounded-[8px]">
            <Icon className="w-4 h-4 text-gold" />
          </div>

          {/* Title and badges - mobile only shows inline */}
          <div className="flex items-center gap-2 sm:hidden">
            {resource.isFeatured && (
              <Star className="w-3.5 h-3.5 text-gold fill-gold" />
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm truncate">
              {resource.title}
            </h3>
            {/* Desktop badges */}
            <div className="hidden sm:flex items-center gap-1.5">
              {resource.isFeatured && (
                <Star className="w-3.5 h-3.5 text-gold fill-gold" />
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
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {resource.description}
          </p>
        </div>

        {/* Type badge and download count */}
        <div className="flex items-center gap-3 flex-shrink-0 mt-1 sm:mt-0">
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium bg-accent text-muted-foreground rounded">
            {resource.type}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="w-3 h-3" />
            <span>{resource.downloadCount}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
