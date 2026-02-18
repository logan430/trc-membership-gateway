'use client';

import { Card, CardContent, Button } from '@/components/ui';
import { DiscordIcon } from '@/components/icons/DiscordIcon';
import { Check, ExternalLink } from 'lucide-react';

interface DiscordClaimCardProps {
  canClaim: boolean;
  hasClaimed: boolean;
  discordInviteUrl: string | null;
  discordUsername: string | null;
  variant: 'hero' | 'compact';
}

export function DiscordClaimCard({
  canClaim,
  hasClaimed,
  discordInviteUrl,
  discordUsername,
  variant,
}: DiscordClaimCardProps) {
  // State: already connected
  if (hasClaimed) {
    if (variant === 'hero') {
      return (
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-success/10 rounded-[8px]">
                <Check className="text-success" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Discord Connected</h3>
                <p className="text-sm text-muted-foreground">
                  Linked as <span className="font-medium text-foreground">@{discordUsername}</span>
                </p>
              </div>
              {discordInviteUrl && (
                <a
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-dark hover:underline"
                >
                  Join Server <ExternalLink size={14} />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Compact variant
    return (
      <div className="flex items-center gap-3">
        <Check className="text-success flex-shrink-0" size={18} />
        <span className="text-sm text-muted-foreground">
          Connected as <span className="font-medium text-foreground">@{discordUsername}</span>
        </span>
        {discordInviteUrl && (
          <a
            href={discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-gold-dark hover:underline"
          >
            Join Server <ExternalLink size={14} />
          </a>
        )}
      </div>
    );
  }

  // State: can claim (active subscription, no Discord linked)
  if (canClaim) {
    if (variant === 'hero') {
      return (
        <Card className="border-l-4 border-l-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent rounded-[8px]">
                <DiscordIcon size={28} className="text-[#5865F2]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-lg">Claim Your Discord Access</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Discord account to join the guild, earn points, and unlock your rank.
                </p>
                <a href="/claim/discord" className="inline-block mt-3">
                  <Button variant="secondary" size="sm">
                    <DiscordIcon size={16} />
                    Connect Discord
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Compact variant
    return (
      <div className="flex items-center gap-3">
        <DiscordIcon size={18} className="text-[#5865F2] flex-shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">
          Connect your Discord to join the guild and earn points.
        </span>
        <a href="/claim/discord">
          <Button variant="secondary" size="sm">
            Connect
          </Button>
        </a>
      </div>
    );
  }

  // State: cannot claim (no active subscription)
  if (variant === 'compact') {
    return (
      <p className="text-sm text-muted-foreground">
        An active subscription is required to connect Discord.
      </p>
    );
  }

  // Hero variant — don't show anything if can't claim
  return null;
}
