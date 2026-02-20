'use client';

import { useState } from 'react';
import { Users, Search } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { MembersTable } from '@/components/admin/MembersTable';
import { useMembers } from '@/hooks/useAdminMembers';

export default function AdminMembersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useMembers({
    page,
    pageSize: 20,
    search: search || undefined,
    status: status || undefined,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Users size={28} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-foreground font-cinzel">Members</h1>
          <p className="text-muted-foreground">
            {data?.pagination?.total ?? 0} total members
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or username..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIALING">Trialing</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <MembersTable members={data?.members ?? []} isLoading={isLoading} />

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t-2 border-border">
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= data.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
