'use client';

import { useState, useEffect } from 'react';
import { Search, Grid3X3, List, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui';
import { useResourceTags } from '@/hooks/useResources';

type ViewMode = 'grid' | 'list';

interface FilterValues {
  search: string;
  type: string;
  tags: string;
}

interface ResourceFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const RESOURCE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'SOP', label: 'SOP' },
  { value: 'PLAYBOOK', label: 'Playbook' },
  { value: 'COURSE', label: 'Course' },
  { value: 'VIDEO', label: 'Video' },
];

/**
 * ResourceFilters - Filter bar for resource library
 *
 * Includes search input, type dropdown, tags dropdown, and grid/list toggle.
 * Mobile responsive: stacks filters vertically on small screens.
 */
export function ResourceFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
}: ResourceFiltersProps) {
  const { data: tagsData } = useResourceTags();
  const [searchValue, setSearchValue] = useState(filters.search);

  // Debounce search input - 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, filters, onFiltersChange]);

  // Sync local search with external filter changes
  useEffect(() => {
    setSearchValue(filters.search);
  }, [filters.search]);

  const handleTypeChange = (value: string) => {
    onFiltersChange({ ...filters, type: value });
  };

  const handleTagsChange = (value: string) => {
    onFiltersChange({ ...filters, tags: value });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      {/* Search input */}
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search resources..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 w-full"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        {/* Type dropdown */}
        <div className="relative">
          <select
            value={filters.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="appearance-none w-full sm:w-auto px-3 py-2 pr-8 bg-background text-foreground border-2 border-input rounded-[8px] text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold cursor-pointer"
          >
            {RESOURCE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Tags dropdown */}
        <div className="relative">
          <select
            value={filters.tags}
            onChange={(e) => handleTagsChange(e.target.value)}
            className="appearance-none w-full sm:w-auto px-3 py-2 pr-8 bg-background text-foreground border-2 border-input rounded-[8px] text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold cursor-pointer"
          >
            <option value="">All Tags</option>
            {tagsData?.tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 border-2 border-input rounded-[8px] p-0.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-[6px] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              viewMode === 'grid'
                ? 'bg-accent text-gold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Grid view"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-[6px] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              viewMode === 'list'
                ? 'bg-accent text-gold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
