'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { useCreateResource } from '@/hooks/useAdminResources';
import { ResourceType, ResourceStatus } from '@/lib/admin-api';

interface ResourceUploaderProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ResourceUploader({ onClose, onSuccess }: ResourceUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ResourceType>('TEMPLATE');
  const [status, setStatus] = useState<ResourceStatus>('DRAFT');
  const [tagsInput, setTagsInput] = useState('');

  const { mutate, isPending, error } = useCreateResource();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drop zone entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    mutate(
      {
        file,
        metadata: {
          title,
          description,
          type,
          status,
          tags: tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      }
    );
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">Upload New Resource</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-[8px] p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging
              ? 'border-gold bg-gold/10'
              : file
                ? 'border-success bg-success/5'
                : 'border-border hover:border-gold/50'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {isDragging ? (
            <div>
              <Upload size={32} className="mx-auto text-gold mb-2" />
              <p className="text-gold font-medium">Drop file here</p>
            </div>
          ) : file ? (
            <div>
              <p className="text-foreground font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Drag and drop a file here, or click to browse</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
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

        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="sales, onboarding, operations"
          />
        </div>

        {error && (
          <div className="p-3 bg-error/10 text-error text-sm rounded-[8px]">
            {(error as Error).message}
          </div>
        )}

        <Button type="submit" disabled={isPending || !file} className="w-full">
          {isPending ? 'Uploading...' : 'Upload Resource'}
        </Button>
      </form>
    </Card>
  );
}
