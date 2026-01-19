import Stripe from 'stripe';
import { Member, Team, SeatTier } from '@prisma/client';
import { DriftIssue, DriftSeverity } from './types.js';
import { MANAGED_ROLES } from '../config/discord.js';

// Active statuses that should have Discord access
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Check if a Stripe subscription status grants access
 */
function isActiveSubscription(status: string | null): boolean {
  return status !== null && ACTIVE_STATUSES.includes(status);
}

/**
 * Get expected Discord role for a member based on their state
 */
function getExpectedRole(member: Member): string | null {
  if (member.isInDebtorState) return 'Debtor';
  if (!member.introCompleted) return 'Squire';
  if (member.seatTier === 'OWNER' || member.seatTier === 'INDIVIDUAL') return 'Lord';
  return 'Knight';
}

/**
 * Check if Discord roles include any membership role
 */
function hasAnyMemberRole(roles: string[]): boolean {
  return roles.some(r => ['Knight', 'Lord', 'Squire'].includes(r));
}

/**
 * Detect drift for an individual member
 * Compares Stripe subscription status against Discord roles
 *
 * @param member - Member with optional team relation
 * @param stripeCustomerMap - Map of Stripe customer ID to subscription
 * @param discordMemberMap - Map of Discord ID to role names
 */
export function detectMemberDrift(
  member: Member & { team: Team | null },
  stripeCustomerMap: Map<string, Stripe.Subscription>,
  discordMemberMap: Map<string, string[]>
): DriftIssue[] {
  const issues: DriftIssue[] = [];

  // Skip members without Discord linked (unclaimed is valid per CONTEXT.md)
  if (!member.discordId) return issues;

  // Determine Stripe status
  let stripeActive = false;
  let stripeStatus: string | null = null;

  if (member.teamId && member.team?.stripeCustomerId) {
    // Team member - check team subscription
    const sub = stripeCustomerMap.get(member.team.stripeCustomerId);
    stripeStatus = sub?.status ?? null;
    stripeActive = isActiveSubscription(stripeStatus);
  } else if (member.stripeCustomerId) {
    // Individual - check member subscription
    const sub = stripeCustomerMap.get(member.stripeCustomerId);
    stripeStatus = sub?.status ?? null;
    stripeActive = isActiveSubscription(stripeStatus);
  }

  // Get actual Discord roles
  const discordRoles = discordMemberMap.get(member.discordId) ?? [];
  const hasRole = hasAnyMemberRole(discordRoles);
  const hasDebtorRole = discordRoles.includes('Debtor');

  // Scenario 1: Stripe active but Discord has no role (MISSING_ACCESS)
  if (stripeActive && !hasRole && !hasDebtorRole) {
    issues.push({
      type: 'MISSING_ACCESS',
      memberId: member.id,
      discordId: member.discordId,
      description: `Stripe ${stripeStatus} but Discord has no member role`,
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'HIGH',
    });
  }

  // Scenario 2: Discord has role but Stripe inactive (UNAUTHORIZED_ACCESS)
  if (!stripeActive && hasRole && !member.isInDebtorState) {
    issues.push({
      type: 'UNAUTHORIZED_ACCESS',
      memberId: member.id,
      discordId: member.discordId,
      description: `Discord has ${discordRoles.join(', ')} but Stripe ${stripeStatus ?? 'no subscription'}`,
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'HIGH',
    });
  }

  // Scenario 3: Role mismatch (wrong tier)
  if (stripeActive && hasRole) {
    const expectedRole = getExpectedRole(member);
    const hasManagedRole = discordRoles.find(r => (MANAGED_ROLES as readonly string[]).includes(r));

    if (expectedRole && hasManagedRole && hasManagedRole !== expectedRole) {
      issues.push({
        type: 'ROLE_MISMATCH',
        memberId: member.id,
        discordId: member.discordId,
        description: `Expected ${expectedRole} but has ${hasManagedRole}`,
        stripeStatus,
        databaseStatus: member.subscriptionStatus,
        discordRoles,
        severity: 'MEDIUM',
      });
    }
  }

  // Scenario 4: Debtor state mismatch
  if (member.isInDebtorState && !hasDebtorRole) {
    issues.push({
      type: 'DEBTOR_MISMATCH',
      memberId: member.id,
      discordId: member.discordId,
      description: `Member in Debtor state but Discord missing Debtor role`,
      stripeStatus,
      databaseStatus: member.subscriptionStatus,
      discordRoles,
      severity: 'MEDIUM',
    });
  }

  return issues;
}

/**
 * Detect drift for a team (checks all team members against team subscription)
 * Team-level issues are aggregated into member issues since roles are per-member
 */
export function detectTeamDrift(
  team: Team & { members: Member[] },
  stripeCustomerMap: Map<string, Stripe.Subscription>,
  discordMemberMap: Map<string, string[]>
): DriftIssue[] {
  const issues: DriftIssue[] = [];

  // Get team subscription status
  const teamSub = stripeCustomerMap.get(team.stripeCustomerId);
  const teamStripeActive = isActiveSubscription(teamSub?.status ?? null);

  // Check each team member
  for (const member of team.members) {
    if (!member.discordId) continue;

    const discordRoles = discordMemberMap.get(member.discordId) ?? [];
    const hasRole = hasAnyMemberRole(discordRoles);

    // Team subscription active but member has no role
    if (teamStripeActive && !hasRole && !member.isInDebtorState) {
      issues.push({
        type: 'MISSING_ACCESS',
        memberId: member.id,
        discordId: member.discordId,
        description: `Team ${team.name} Stripe active but member has no Discord role`,
        stripeStatus: teamSub?.status ?? null,
        databaseStatus: team.subscriptionStatus,
        discordRoles,
        severity: 'HIGH',
      });
    }

    // Team subscription inactive but member has role
    if (!teamStripeActive && hasRole && !member.isInDebtorState) {
      issues.push({
        type: 'UNAUTHORIZED_ACCESS',
        memberId: member.id,
        discordId: member.discordId,
        description: `Team ${team.name} Stripe inactive but member has Discord role`,
        stripeStatus: teamSub?.status ?? null,
        databaseStatus: team.subscriptionStatus,
        discordRoles,
        severity: 'HIGH',
      });
    }
  }

  return issues;
}
