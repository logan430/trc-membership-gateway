'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Eye, Edit, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { useTemplates, usePreviewTemplate, useSeedTemplates } from '@/hooks/useAdminConfig';
import { useAdminAuth } from '@/lib/admin-auth';
import { EmailTemplate } from '@/lib/admin-api';

// Category groupings for templates
const TEMPLATE_CATEGORIES: Record<string, string[]> = {
  Welcome: ['welcome'],
  Billing: ['payment_failure', 'payment_recovered', 'payment_recovered_debtor'],
  Team: ['seat_invite'],
  Reminders: ['claim_reminder', 'claim_reminder_cheeky', 'reconciliation_report'],
};

// Human-readable descriptions
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  welcome: 'Welcome email sent after successful payment',
  claim_reminder: 'Reminder to claim Discord access (standard)',
  claim_reminder_cheeky: 'Reminder to claim Discord access (30+ days)',
  payment_failure: 'Payment failure notification with grace period',
  payment_recovered: 'Payment recovered during grace period',
  payment_recovered_debtor: 'Payment recovered after Debtor state',
  seat_invite: 'Team seat invitation email',
  reconciliation_report: 'Admin reconciliation report',
};

// Human-readable names
const TEMPLATE_NAMES: Record<string, string> = {
  welcome: 'Welcome',
  claim_reminder: 'Claim Reminder',
  claim_reminder_cheeky: 'Claim Reminder (Cheeky)',
  payment_failure: 'Payment Failure',
  payment_recovered: 'Payment Recovered',
  payment_recovered_debtor: 'Payment Recovered (Debtor)',
  seat_invite: 'Seat Invite',
  reconciliation_report: 'Reconciliation Report',
};

export default function AdminTemplatesPage() {
  const { isSuperAdmin } = useAdminAuth();
  const { data, isLoading } = useTemplates();
  const seedMutation = useSeedTemplates();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(TEMPLATE_CATEGORIES))
  );
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);

  const handleSeedTemplates = async () => {
    try {
      await seedMutation.mutateAsync();
      alert('Default templates created successfully.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to seed templates'}`);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  if (isLoading) {
    return <PageLoader message="Loading templates..." />;
  }

  const templates = data?.templates || [];
  const templateMap = new Map<string, EmailTemplate>();
  templates.forEach((t) => templateMap.set(t.name, t));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Mail size={28} className="text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-muted-foreground">Manage notification templates</p>
          </div>
        </div>
        {isSuperAdmin && templates.length === 0 && (
          <Button
            variant="outline"
            onClick={handleSeedTemplates}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? 'Seeding...' : 'Seed Defaults'}
          </Button>
        )}
      </div>

      {/* Empty State */}
      {templates.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-2">No templates found.</p>
          {isSuperAdmin && (
            <p className="text-muted-foreground">
              Click &quot;Seed Defaults&quot; to create the default email templates.
            </p>
          )}
        </Card>
      )}

      {/* Template Categories */}
      {templates.length > 0 && (
        <div className="space-y-4 max-w-3xl">
          {Object.entries(TEMPLATE_CATEGORIES).map(([categoryName, templateNames]) => {
            const categoryTemplates = templateNames.filter((name) => templateMap.has(name));
            if (categoryTemplates.length === 0) return null;

            const isExpanded = expandedCategories.has(categoryName);

            return (
              <Card key={categoryName} className="overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(categoryName)}
                  className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gold" />
                    ) : (
                      <ChevronRight size={16} className="text-gold" />
                    )}
                    <span className="font-semibold text-gold">{categoryName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''})
                  </span>
                </button>

                {/* Template List */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {categoryTemplates.map((templateName) => {
                      const template = templateMap.get(templateName)!;
                      const displayName = TEMPLATE_NAMES[templateName] || templateName;
                      const description = TEMPLATE_DESCRIPTIONS[templateName] || '';

                      return (
                        <div
                          key={templateName}
                          className="p-4 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-foreground">{displayName}</h4>
                              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Updated: {formatDate(template.updatedAt)}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <TemplatePreviewButton
                                templateName={templateName}
                                onPreview={(subject, html) => {
                                  setPreviewSubject(subject);
                                  setPreviewHtml(html);
                                }}
                              />
                              <Link href={`/admin/templates/${templateName}`}>
                                <Button variant="outline" size="sm">
                                  <Edit size={16} className="mr-1" />
                                  Edit
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
              <div>
                <h3 className="font-semibold text-foreground">Email Preview</h3>
                {previewSubject && (
                  <p className="text-sm text-muted-foreground">Subject: {previewSubject}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>
                Close
              </Button>
            </div>
            <div className="p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground bg-accent/30 p-4 rounded-[8px]">
                {previewHtml}
              </pre>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Separate component for preview button to handle its own mutation state
function TemplatePreviewButton({
  templateName,
  onPreview,
}: {
  templateName: string;
  onPreview: (subject: string, html: string) => void;
}) {
  const previewMutation = usePreviewTemplate(templateName);

  const handlePreview = async () => {
    try {
      const result = await previewMutation.mutateAsync();
      onPreview(result.preview.subject, result.preview.body);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to preview'}`);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePreview}
      disabled={previewMutation.isPending}
    >
      <Eye size={16} className="mr-1" />
      {previewMutation.isPending ? '...' : 'Preview'}
    </Button>
  );
}
