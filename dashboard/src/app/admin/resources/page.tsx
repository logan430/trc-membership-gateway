'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { ResourceUploader } from '@/components/admin/ResourceUploader';
import { useResources, useDeleteResource } from '@/hooks/useAdminResources';
import { ResourceType, ResourceStatus } from '@/lib/admin-api';

export default function AdminResourcesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ResourceType | ''>('');
  const [status, setStatus] = useState<ResourceStatus | ''>('');

  const { data, isLoading, refetch } = useResources({
    search: search || undefined,
    type: type || undefined,
    status: status || undefined,
    limit: 50,
  });

  const deleteMutation = useDeleteResource();

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this resource?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading resources..." />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderOpen size={28} className="text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Resources</h1>
            <p className="text-muted-foreground">{data?.resources.length ?? 0} resources</p>
          </div>
        </div>
        <Button onClick={() => setShowUploader(true)}>
          <Plus size={16} className="mr-2" />
          Upload Resource
        </Button>
      </div>

      {/* Upload Form */}
      {showUploader && (
        <div className="mb-6">
          <ResourceUploader onClose={() => setShowUploader(false)} onSuccess={() => refetch()} />
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search resources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ResourceType | '')}
            className="px-3 py-2 rounded-[8px] border-2 border-border bg-background"
          >
            <option value="">All Types</option>
            <option value="TEMPLATE">Template</option>
            <option value="SOP">SOP</option>
            <option value="PLAYBOOK">Playbook</option>
            <option value="COURSE">Course</option>
            <option value="VIDEO">Video</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ResourceStatus | '')}
            className="px-3 py-2 rounded-[8px] border-2 border-border bg-background"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="SCHEDULED">Scheduled</option>
          </select>
        </div>
      </Card>

      {/* Resources List */}
      <div className="grid gap-4">
        {data?.resources.map((resource) => (
          <Card key={resource.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Link
                  href={`/admin/resources/${resource.id}`}
                  className="text-foreground font-medium hover:text-gold"
                >
                  {resource.title}
                </Link>
                <p className="text-sm text-muted-foreground mt-1">
                  {resource.description.slice(0, 100)}
                  {resource.description.length > 100 && '...'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <TypeBadge type={resource.type} />
                  <StatusBadge status={resource.status} />
                  <span className="text-xs text-muted-foreground">
                    v{resource.currentVersionNumber} | {resource.downloadCount} downloads
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/resources/${resource.id}`}>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(resource.id)}
                  className="text-error hover:bg-error/10"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {data?.resources.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No resources found</p>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs px-2 py-1 rounded bg-accent text-muted-foreground">{type}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PUBLISHED: 'bg-success/10 text-success',
    DRAFT: 'bg-warning/10 text-warning',
    SCHEDULED: 'bg-info/10 text-info',
  };
  return (
    <span className={`text-xs px-2 py-1 rounded ${colors[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
