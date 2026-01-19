/**
 * Types for reconciliation system
 */

export type DriftType =
  | 'MISSING_ACCESS'      // Stripe active but Discord has no role
  | 'UNAUTHORIZED_ACCESS' // Discord has role but Stripe inactive
  | 'ROLE_MISMATCH'       // Wrong role for tier (Knight vs Lord)
  | 'DEBTOR_MISMATCH';    // Debtor state doesn't match Debtor role

export type DriftSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DriftIssue {
  type: DriftType;
  memberId: string;
  discordId: string | null;
  description: string;
  stripeStatus: string | null;
  databaseStatus: string | null;
  discordRoles: string[] | null;
  severity: DriftSeverity;
}

export interface ReconciliationResult {
  runId: string;
  issuesFound: number;
  issuesFixed: number;
  issues: DriftIssue[];
  autoFixEnabled: boolean;
}

export interface ReconciliationOptions {
  isVerificationRerun?: boolean;
  triggeredBy?: 'scheduled' | 'manual' | 'verification';
}
