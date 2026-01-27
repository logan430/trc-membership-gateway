'use client';

import { useState } from 'react';
import { Shield, Plus, Trash2, Key, UserCog } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import {
  useAdminUsers,
  useCreateAdmin,
  useUpdateAdminRole,
  useResetAdminPassword,
  useDeleteAdmin,
} from '@/hooks/useAdminConfig';
import { useAdminAuth } from '@/lib/admin-auth';
import { formatDistanceToNow } from 'date-fns';

export default function AdminUsersPage() {
  const { admin: currentAdmin, isSuperAdmin } = useAdminAuth();
  const { data, isLoading, error } = useAdminUsers();
  const createMutation = useCreateAdmin();
  const updateRoleMutation = useUpdateAdminRole();
  const resetPasswordMutation = useResetAdminPassword();
  const deleteMutation = useDeleteAdmin();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN');

  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // Access denied for non-super-admins
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-6 text-center max-w-md">
          <Shield size={48} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            Only Super Admins can manage admin accounts.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <PageLoader message="Loading admins..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card className="p-6 text-center">
          <p className="text-destructive">Failed to load admin users. Please try again.</p>
        </Card>
      </div>
    );
  }

  const admins = data?.admins || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setShowAddForm(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('ADMIN');
      alert('Admin created successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create admin'}`);
    }
  };

  const handleRoleChange = async (id: string, role: 'ADMIN' | 'SUPER_ADMIN') => {
    if (!confirm(`Are you sure you want to change this admin's role to ${role}?`)) {
      return;
    }
    try {
      await updateRoleMutation.mutateAsync({ id, role });
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to change role'}`);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordId || resetPasswordValue.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    try {
      await resetPasswordMutation.mutateAsync({
        id: resetPasswordId,
        password: resetPasswordValue,
      });
      setResetPasswordId(null);
      setResetPasswordEmail('');
      setResetPasswordValue('');
      alert('Password reset successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to reset password'}`);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete admin'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Users</h1>
            <p className="text-muted-foreground">{admins.length} administrator{admins.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus size={16} className="mr-2" />
          Add Admin
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-6 mb-6 max-w-md">
          <h3 className="font-semibold text-foreground mb-4">Add New Admin</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'SUPER_ADMIN')}
                className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground focus:border-gold focus:outline-none"
              >
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" type="button" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Admin List */}
      <div className="space-y-4">
        {admins.map((admin) => {
          const isSelf = admin.id === currentAdmin?.sub;
          const isSuperAdminRole = admin.role === 'SUPER_ADMIN';

          return (
            <Card key={admin.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{admin.email}</h4>
                    {isSelf && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <RoleBadge role={admin.role} />
                    <span className="text-xs text-muted-foreground">
                      Last login:{' '}
                      {admin.lastLoginAt
                        ? formatDistanceToNow(new Date(admin.lastLoginAt), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Role Change */}
                  <select
                    value={admin.role}
                    onChange={(e) => handleRoleChange(admin.id, e.target.value as 'ADMIN' | 'SUPER_ADMIN')}
                    disabled={updateRoleMutation.isPending || isSelf}
                    className="px-2 py-1.5 rounded border border-border bg-background text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isSelf ? 'Cannot change your own role' : undefined}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>

                  {/* Reset Password */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResetPasswordId(admin.id);
                      setResetPasswordEmail(admin.email);
                      setResetPasswordValue('');
                    }}
                    title="Reset Password"
                  >
                    <Key size={16} />
                  </Button>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(admin.id, admin.email)}
                    disabled={isSelf || deleteMutation.isPending}
                    className="text-destructive hover:bg-destructive/10"
                    title={isSelf ? 'Cannot delete yourself' : 'Delete Admin'}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {admins.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No admin accounts found.</p>
          </Card>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="font-semibold text-foreground mb-2">Reset Password</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter new password for {resetPasswordEmail}
            </p>
            <Input
              type="password"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              placeholder="New password (min 8 characters)"
              minLength={8}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setResetPasswordId(null);
                  setResetPasswordEmail('');
                  setResetPasswordValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending || resetPasswordValue.length < 8}
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  return (
    <span
      className={`text-xs px-2 py-1 rounded border ${
        isSuperAdmin
          ? 'bg-gold/10 text-gold-dark border-gold/30'
          : 'bg-accent text-muted-foreground border-border'
      }`}
    >
      {isSuperAdmin ? 'Super Admin' : 'Admin'}
    </span>
  );
}
