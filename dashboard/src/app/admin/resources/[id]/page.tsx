'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Save, History } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { useResource, useUpdateResource, useUploadVersion } from '@/hooks/useAdminResources';
import { ResourceType, ResourceStatus } from '@/lib/admin-api';
import { formatDistanceToNow } from 'date-fns';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResourceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data, isLoading } = useResource(id);
  const updateMutation = useUpdateResource(id);
  const uploadMutation = useUploadVersion(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ResourceType>('TEMPLATE');
  const [status, setStatus] = useState<ResourceStatus>('DRAFT');
  const [showVersionUpload, setShowVersionUpload] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form when data loads
  useEffect(() => {
    if (data?.resource && !initialized) {
      setTitle(data.resource.title);
      setDescription(data.resource.description);
      setType(data.resource.type);
      setStatus(data.resource.status);
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSave = () => {
    updateMutation.mutate({
      title,
      description,
      type,
      status,
    });
  };

  const handleVersionUpload = () => {
    if (!versionFile) return;
    uploadMutation.mutate(
      { file: versionFile, changelog },
      {
        onSuccess: () => {
          setShowVersionUpload(false);
          setVersionFile(null);
          setChangelog('');
        },
      }
    );
  };

  if (isLoading) {
    return <PageLoader message="Loading resource..." />;
  }

  const resource = data?.resource;
  const versions = data?.versions ?? [];

  if (!resource) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-muted-foreground">Resource not found</p>
        <Link href="/admin/resources" className="text-gold hover:underline">
          Back to resources
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/resources"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} />
          Back to Resources
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{resource.title}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowVersionUpload(true)}>
              <Upload size={16} className="mr-2" />
              New Version
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save size={16} className="mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="lg:col-span-2">
          <Card className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ResourceType)}
                  className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background"
                >
                  <option value="TEMPLATE">Template</option>
                  <option value="SOP">SOP</option>
                  <option value="PLAYBOOK">Playbook</option>
                  <option value="COURSE">Course</option>
                  <option value="VIDEO">Video</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ResourceStatus)}
                  className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="SCHEDULED">Scheduled</option>
                </select>
              </div>
            </div>

            {updateMutation.isSuccess && (
              <div className="p-3 bg-success/10 text-success rounded-[8px]">Changes saved!</div>
            )}

            {updateMutation.error && (
              <div className="p-3 bg-error/10 text-error rounded-[8px]">
                {(updateMutation.error as Error).message}
              </div>
            )}
          </Card>
        </div>

        {/* Version History */}
        <div>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <History size={20} className="text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Version History</h3>
            </div>
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="p-3 bg-accent/50 rounded-[8px]">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{v.fileName}</p>
                  {v.changelog && <p className="text-xs text-muted-foreground mt-1">{v.changelog}</p>}
                </div>
              ))}
              {versions.length === 0 && (
                <p className="text-sm text-muted-foreground">No versions yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Version Upload Modal */}
      {showVersionUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="font-semibold text-foreground mb-4">Upload New Version</h3>
            <div className="space-y-4">
              <input
                type="file"
                onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                className="w-full"
              />
              <div>
                <label className="block text-sm font-medium mb-1">Changelog</label>
                <Input
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="What changed in this version?"
                />
              </div>
              {uploadMutation.error && (
                <div className="p-3 bg-error/10 text-error text-sm rounded-[8px]">
                  {(uploadMutation.error as Error).message}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleVersionUpload}
                  disabled={!versionFile || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
                <Button variant="outline" onClick={() => setShowVersionUpload(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
