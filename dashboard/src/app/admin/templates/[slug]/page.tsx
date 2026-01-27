'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Eye, RotateCcw } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import {
  useTemplate,
  useTemplateVariables,
  useUpdateTemplate,
  usePreviewTemplate,
  useResetTemplate,
} from '@/hooks/useAdminConfig';

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

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function TemplateEditPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();

  // useTemplate now returns the unwrapped template (BUG FIXED in API client)
  const { data: template, isLoading, error } = useTemplate(slug);
  const { data: variablesData } = useTemplateVariables(slug);
  const updateMutation = useUpdateTemplate(slug);
  const previewMutation = usePreviewTemplate(slug);
  const resetMutation = useResetTemplate(slug);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Initialize form when template loads
  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template]);

  const handleSave = async () => {
    setSaveSuccess(false);
    setWarning(null);

    try {
      const result = await updateMutation.mutateAsync({ subject, body });
      setSaveSuccess(true);
      if (result.warning) {
        setWarning(result.warning);
      }
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await previewMutation.mutateAsync();
      setPreviewSubject(result.preview.subject);
      setPreviewHtml(result.preview.body);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to preview'}`);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset this template to its default content? This cannot be undone.')) {
      return;
    }

    try {
      const result = await resetMutation.mutateAsync();
      setSubject(result.template.subject);
      setBody(result.template.body);
      alert('Template reset to default.');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to reset'}`);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = `{{${variable}}}`;

    const before = body.substring(0, start);
    const after = body.substring(end);
    setBody(before + text + after);

    // Restore focus and cursor position after React re-renders
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + text.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  if (isLoading) {
    return <PageLoader message="Loading template..." />;
  }

  if (error || !template) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card className="p-6 max-w-md mx-auto text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Template Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The requested template could not be found.
          </p>
          <Link href="/admin/templates" className="text-gold hover:underline">
            Back to Templates
          </Link>
        </Card>
      </div>
    );
  }

  const displayName = TEMPLATE_NAMES[slug] || slug;
  const description = TEMPLATE_DESCRIPTIONS[slug] || '';
  const variables = variablesData?.variables || [];

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/templates"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 w-fit"
        >
          <ArrowLeft size={16} />
          Back to Templates
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
            {description && <p className="text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              <Eye size={16} className="mr-2" />
              {previewMutation.isPending ? 'Loading...' : 'Preview'}
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save size={16} className="mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Success/Warning Messages */}
      {saveSuccess && (
        <div className="mb-4 p-3 bg-success/10 text-success rounded-[8px] max-w-3xl">
          Template saved successfully!
        </div>
      )}
      {warning && (
        <div className="mb-4 p-3 bg-warning/10 text-warning border border-warning rounded-[8px] max-w-3xl">
          {warning}
        </div>
      )}

      {/* Variables Reference */}
      {variables.length > 0 && (
        <Card className="p-4 mb-6 max-w-3xl">
          <h4 className="font-medium text-foreground mb-2">Available Variables</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Click a variable to insert at cursor position:
          </p>
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <button
                key={variable}
                onClick={() => insertVariable(variable)}
                className="px-3 py-1.5 bg-accent hover:bg-gold/20 rounded text-sm text-foreground font-mono transition-colors cursor-pointer border border-gold/30 hover:border-gold"
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Editor Form */}
      <Card className="p-6 max-w-3xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Subject Line</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email Body (HTML)
            </label>
            <textarea
              id="template-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 rounded-[8px] border-2 border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:border-gold resize-y"
              placeholder="Email body content..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            <RotateCcw size={16} className="mr-2" />
            {resetMutation.isPending ? 'Resetting...' : 'Reset to Default'}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save size={16} className="mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </Card>

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
