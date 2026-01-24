'use client';

import { useState, useEffect } from 'react';
import { X, FileText, ClipboardList, BookOpen, GraduationCap, Video, Download, Star, Coins, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { useDownloadResource } from '@/hooks/useResources';
import type { Resource } from '@/lib/api';

interface ResourcePreviewModalProps {
  resource: Resource;
  onClose: () => void;
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
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ResourcePreviewModal - Modal overlay for resource details
 *
 * Shows full resource details with download button.
 * Awards +5 gold on download, shows confirmation briefly.
 * Mobile responsive: full-width on mobile with scrollable content.
 */
export function ResourcePreviewModal({ resource, onClose }: ResourcePreviewModalProps) {
  const [showDownloaded, setShowDownloaded] = useState(false);
  const downloadMutation = useDownloadResource();

  const Icon = typeIcons[resource.type as keyof typeof typeIcons] || FileText;

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleDownload = async () => {
    await downloadMutation.mutateAsync(resource.id);
    setShowDownloaded(true);
    // Reset after 2 seconds
    setTimeout(() => setShowDownloaded(false), 2000);
  };

  // Popularity badges
  const isPopular = resource.downloadCount > 50;
  const isTrending = resource.downloadCount > 20 && !isPopular;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-auto sm:w-full sm:max-w-lg bg-card border-2 border-border rounded-[8px] shadow-[4px_4px_0px_0px_rgba(51,65,85,0.3)] overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b-2 border-border">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 bg-accent rounded-[8px] flex-shrink-0">
              <Icon className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">
                  {resource.title}
                </h2>
                {resource.isFeatured && (
                  <Star className="w-4 h-4 text-gold fill-gold flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {resource.type}
                </span>
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
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Description */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {resource.description}
              </p>
            </div>

            {/* Tags */}
            {resource.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {resource.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-accent text-muted-foreground rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {resource.author && (
                <div>
                  <span className="text-xs text-muted-foreground">Author</span>
                  <p className="text-sm font-medium text-foreground">{resource.author}</p>
                </div>
              )}
              {resource.fileSize && (
                <div>
                  <span className="text-xs text-muted-foreground">File Size</span>
                  <p className="text-sm font-medium text-foreground">{formatFileSize(resource.fileSize)}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">Downloads</span>
                <p className="text-sm font-medium text-foreground">{resource.downloadCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with download button */}
        <div className="border-t-2 border-border p-4 sm:p-6 bg-accent/30">
          <Button
            variant="secondary"
            size="lg"
            className="w-full min-h-[48px]"
            onClick={handleDownload}
            disabled={downloadMutation.isPending || showDownloaded}
          >
            {downloadMutation.isPending ? (
              <>
                <Download className="w-4 h-4 animate-pulse" />
                Downloading...
              </>
            ) : showDownloaded ? (
              <>
                <Check className="w-4 h-4" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-gold-dark/30 rounded text-xs">
                  <Coins className="w-3 h-3" />
                  +5 Gold
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
