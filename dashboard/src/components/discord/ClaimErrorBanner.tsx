'use client';

import { AlertCircle, X } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Discord connection failed due to a security check. Please try again.',
  session_expired: 'Your session expired during the Discord connection. Please try again.',
  no_code: 'Discord did not provide authorization. Please try again.',
  discord_already_linked: 'This Discord account is already linked to another membership.',
  oauth_failed: 'Something went wrong connecting to Discord. Please try again.',
};

interface ClaimErrorBannerProps {
  reason: string | null;
  onDismiss: () => void;
}

export function ClaimErrorBanner({ reason, onDismiss }: ClaimErrorBannerProps) {
  if (!reason) return null;

  const message = ERROR_MESSAGES[reason] || 'Discord connection failed. Please try again.';

  return (
    <div className="flex items-start gap-3 p-4 rounded-[8px] bg-destructive/10 border-2 border-destructive/20 text-destructive">
      <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Dismiss error"
      >
        <X size={16} />
      </button>
    </div>
  );
}
