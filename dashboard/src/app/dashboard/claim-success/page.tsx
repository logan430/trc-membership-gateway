'use client';

import { Card, CardContent, Button } from '@/components/ui';
import { DiscordIcon } from '@/components/icons/DiscordIcon';
import { Check, ArrowLeft, ExternalLink } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

export default function ClaimSuccessPage() {
  const { data: profile } = useProfile();

  const discordUsername = profile?.member.discordUsername;
  const inviteUrl = profile?.claim.discordInviteUrl;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* Success icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="p-4 bg-success/10 rounded-full">
                <DiscordIcon size={48} className="text-[#5865F2]" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-background rounded-full">
                <div className="p-1 bg-success rounded-full">
                  <Check size={14} className="text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Discord Connected!</h1>
            {discordUsername && (
              <p className="text-muted-foreground mt-1">
                Linked as <span className="font-medium text-foreground">@{discordUsername}</span>
              </p>
            )}
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground">
            Your Discord account is now linked to your membership.
            Join the server to access the community and start earning points.
          </p>

          {/* Actions */}
          <div className="space-y-3">
            {inviteUrl && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="secondary" size="lg" className="w-full">
                  <DiscordIcon size={18} />
                  Join the Server
                  <ExternalLink size={14} />
                </Button>
              </a>
            )}

            <a href="/dashboard" className="block">
              <Button variant="outline" size="lg" className="w-full">
                <ArrowLeft size={18} />
                Back to Dashboard
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
