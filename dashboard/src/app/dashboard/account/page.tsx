'use client';

import { useState, useEffect } from 'react';
import { GoldCoinsLoader, Card, Button, Input } from '@/components/ui';
import {
  useProfile,
  usePrivacySettings,
  useUpdateEmail,
  useUpdatePassword,
  useUpdateLeaderboardVisibility,
} from '@/hooks/useProfile';
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { DiscordClaimCard } from '@/components/discord/DiscordClaimCard';

export default function AccountPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: privacy, isLoading: privacyLoading } = usePrivacySettings();

  // Email form state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Privacy state
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [privacySuccess, setPrivacySuccess] = useState(false);

  const updateEmailMutation = useUpdateEmail();
  const updatePasswordMutation = useUpdatePassword();
  const updateLeaderboardVisibilityMutation = useUpdateLeaderboardVisibility();

  // Sync privacy setting when loaded
  useEffect(() => {
    if (privacy) {
      setLeaderboardVisible(privacy.leaderboardVisible);
    }
  }, [privacy]);

  const isLoading = profileLoading || privacyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess(false);

    if (!newEmail || !emailPassword) {
      setEmailError('Please fill in all fields');
      return;
    }

    if (!newEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      await updateEmailMutation.mutateAsync({
        newEmail,
        currentPassword: emailPassword,
      });
      setEmailSuccess(true);
      setNewEmail('');
      setEmailPassword('');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to update email');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      await updatePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  const handleLeaderboardVisibilityToggle = async () => {
    const newValue = !leaderboardVisible;
    setLeaderboardVisible(newValue);
    setPrivacySuccess(false);

    try {
      await updateLeaderboardVisibilityMutation.mutateAsync(newValue);
      setPrivacySuccess(true);
      setTimeout(() => setPrivacySuccess(false), 3000);
    } catch {
      // Revert on error
      setLeaderboardVisible(!newValue);
    }
  };

  // Format subscription status for display
  const formatSubscriptionStatus = (status: string) => {
    return status.toLowerCase().replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your email, password, and privacy settings.
        </p>
      </div>

      {/* Current account info */}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Current Account</h2>
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium truncate">{profile?.member.email}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-muted-foreground">Subscription</span>
            <span className="font-medium capitalize">
              {formatSubscriptionStatus(profile?.member.subscriptionStatus || '')}
            </span>
          </div>
          {profile?.member.currentPeriodEnd && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-muted-foreground">Renews</span>
              <span className="font-medium">
                {new Date(profile.member.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Discord Connection */}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Discord Connection</h2>
        <DiscordClaimCard
          canClaim={profile?.claim.canClaim ?? false}
          hasClaimed={profile?.claim.hasClaimed ?? false}
          discordInviteUrl={profile?.claim.discordInviteUrl ?? null}
          discordUsername={profile?.member.discordUsername ?? null}
          variant="compact"
        />
      </Card>

      {/* Privacy settings - Leaderboard visibility (GAME-11) */}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Privacy Settings</h2>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {leaderboardVisible ? (
                  <Eye size={18} className="text-success" />
                ) : (
                  <EyeOff size={18} className="text-muted-foreground" />
                )}
                <span className="font-medium">Show on Leaderboard</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {leaderboardVisible
                  ? 'Your rank and points are visible to other members on the leaderboard.'
                  : 'You are hidden from the leaderboard. Your points still count toward personal progress.'}
              </p>
            </div>
            <button
              onClick={handleLeaderboardVisibilityToggle}
              disabled={updateLeaderboardVisibilityMutation.isPending}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 ${
                leaderboardVisible ? 'bg-success' : 'bg-muted'
              } ${updateLeaderboardVisibilityMutation.isPending ? 'opacity-50' : ''}`}
              role="switch"
              aria-checked={leaderboardVisible}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  leaderboardVisible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {privacySuccess && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Check size={16} />
              Privacy settings updated
            </div>
          )}
        </div>
      </Card>

      {/* Update email */}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Change Email</h2>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">New Email</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <Input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Enter your password to confirm"
            />
          </div>

          {emailError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} />
              {emailError}
            </div>
          )}

          {emailSuccess && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Check size={16} />
              Email updated successfully
            </div>
          )}

          <Button
            type="submit"
            loading={updateEmailMutation.isPending}
          >
            Update Email
          </Button>
        </form>
      </Card>

      {/* Update password */}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} />
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Check size={16} />
              Password updated successfully
            </div>
          )}

          <Button
            type="submit"
            loading={updatePasswordMutation.isPending}
          >
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
