/**
 * Zod validation schemas for benchmark data
 * Validates incoming benchmark submissions before database write
 */

import { z } from 'zod';

/**
 * K-anonymity threshold - minimum submissions required
 * before aggregate data is shown for a field
 * Per BENCH-06 requirement: minimum 5 submissions
 */
export const K_ANONYMITY_THRESHOLD = 5;

/**
 * Compensation category schema
 * Salaries and rates for various roles
 */
export const compensationSchema = z.object({
  gtm_engineer_us: z.number().optional(),
  gtm_engineer_offshore: z.number().optional(),
  sdr_bdr_us_salary: z.number().optional(),
  sdr_bdr_us_commission: z.string().optional(), // Text field for commission structure
  sdr_bdr_offshore_salary: z.number().optional(),
  account_manager: z.number().optional(),
  virtual_assistant_hourly: z.number().optional(),
  copywriter_hourly: z.number().optional(),
});

/**
 * Infrastructure category schema
 * Costs and vendors for email infrastructure
 */
export const infrastructureSchema = z.object({
  cost_per_domain: z.number().optional(),
  domain_vendor: z.string().optional(),
  cost_per_inbox: z.number().optional(),
  inbox_provider: z.string().optional(),
  warmup_tool: z.string().optional(),
  warmup_cost: z.number().optional(),
  sending_platform: z.string().optional(),
  sending_platform_cost: z.number().optional(),
  data_enrichment_cost: z.number().optional(),
});

/**
 * Business metrics category schema
 * Revenue, pricing, and business health metrics
 * Percentage fields constrained to 0-100
 */
export const businessSchema = z.object({
  annual_revenue_band: z.string().optional(),
  agency_type: z.string().optional(),
  average_monthly_retainer: z.number().optional(),
  pricing_model: z.string().optional(),
  gross_margin_percent: z.number().min(0).max(100).optional(),
  monthly_client_churn_percent: z.number().min(0).max(100).optional(),
  revenue_per_employee: z.number().optional(),
});

/**
 * Operational metrics category schema
 * Email campaign operational metrics
 * Percentage fields constrained to 0-100
 */
export const operationalSchema = z.object({
  domains_per_client: z.number().optional(),
  inboxes_per_domain: z.number().optional(),
  daily_sends_per_inbox: z.number().optional(),
  warmup_period_days: z.number().optional(),
  average_reply_rate_percent: z.number().min(0).max(100).optional(),
  average_positive_reply_rate_percent: z.number().min(0).max(100).optional(),
  average_meeting_rate_percent: z.number().min(0).max(100).optional(),
});

/**
 * Map of category to schema for dynamic validation
 * Keys match BenchmarkCategory enum values
 */
export const benchmarkDataSchemas = {
  COMPENSATION: compensationSchema,
  INFRASTRUCTURE: infrastructureSchema,
  BUSINESS: businessSchema,
  OPERATIONAL: operationalSchema,
} as const;

/**
 * Type inference exports for use in service layer
 */
export type CompensationInput = z.infer<typeof compensationSchema>;
export type InfrastructureInput = z.infer<typeof infrastructureSchema>;
export type BusinessInput = z.infer<typeof businessSchema>;
export type OperationalInput = z.infer<typeof operationalSchema>;

/**
 * Union type for any category's input
 */
export type BenchmarkInput =
  | CompensationInput
  | InfrastructureInput
  | BusinessInput
  | OperationalInput;
