'use client';

import { useState } from 'react';
import { GoldCoinsLoader, Card } from '@/components/ui';
import {
  ResourceCard,
  ResourceListItem,
  ResourceFilters,
  ResourcePreviewModal,
} from '@/components/resources';
import { useResources } from '@/hooks/useResources';
import type { Resource } from '@/lib/api';

type ViewMode = 'grid' | 'list';

/**
 * ResourcesPage - Resource Library Browser
 *
 * Members can browse curated resources (templates, SOPs, playbooks),
 * filter by type/tags, toggle grid/list view, preview details,
 * and download to earn +5 gold points.
 *
 * UI-04: Resource library browser with filtering and search
 * UI-05: Resource detail modal with download button
 * UI-11: Mobile responsive at 375px breakpoint
 * UI-12: Loading states prevent confusion
 * GAME-02: Download awards +5 points (shown in UI)
 */
export default function ResourcesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    tags: '',
  });
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const { data, isLoading, error } = useResources({
    search: filters.search || undefined,
    type: filters.type || undefined,
    tags: filters.tags || undefined,
  });

  const handleResourceClick = (resource: Resource) => {
    setSelectedResource(resource);
  };

  const handleCloseModal = () => {
    setSelectedResource(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6 sm:p-8 text-center">
        <p className="text-muted-foreground">
          Failed to load resources. Please try again later.
        </p>
      </Card>
    );
  }

  const resources = data?.resources || [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">
          Resource Vault
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Download templates, SOPs, and playbooks. Earn +5 gold per download.
        </p>
      </div>

      {/* Filters */}
      <ResourceFilters
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Resource listing */}
      {resources.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <p className="text-muted-foreground">
            {filters.search || filters.type || filters.tags
              ? 'No resources match your filters.'
              : 'No resources available yet.'}
          </p>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onClick={() => handleResourceClick(resource)}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <Card withShadow={false} className="divide-y divide-border overflow-hidden">
          {resources.map((resource) => (
            <ResourceListItem
              key={resource.id}
              resource={resource}
              onClick={() => handleResourceClick(resource)}
            />
          ))}
        </Card>
      )}

      {/* Preview modal */}
      {selectedResource && (
        <ResourcePreviewModal
          resource={selectedResource}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
