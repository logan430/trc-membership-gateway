'use client';

/**
 * CategoryCard - Displays a benchmark category with submission status
 *
 * Shows category title, description, icon, and whether member has submitted.
 * Includes visual feedback for hover state and point value display.
 */

import { Card, CardContent } from '@/components/ui';
import { Check, ChevronRight } from 'lucide-react';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  hasSubmitted: boolean;
  onStart: () => void;
}

export function CategoryCard({
  title,
  description,
  icon,
  hasSubmitted,
  onStart,
}: CategoryCardProps) {
  return (
    <Card
      className="hover:shadow-[2px_2px_0px_0px_rgba(212,160,23,0.3)] cursor-pointer group transition-all duration-150"
      onClick={onStart}
    >
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Icon container */}
          <div className="p-2 sm:p-3 bg-accent rounded-[8px] text-foreground group-hover:bg-gold/10 group-hover:text-gold-dark transition-colors flex-shrink-0">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground group-hover:text-gold-dark transition-colors">
                {title}
              </h3>
              {hasSubmitted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">
                  <Check size={12} />
                  Submitted
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
            <p className="text-sm font-medium text-gold-dark mt-2">
              {hasSubmitted ? 'Update submission' : '+50 Gold'}
            </p>
          </div>

          {/* Chevron indicator (hidden on mobile) */}
          <ChevronRight className="text-muted-foreground group-hover:text-gold-dark transition-colors flex-shrink-0 hidden sm:block" />
        </div>
      </CardContent>
    </Card>
  );
}
