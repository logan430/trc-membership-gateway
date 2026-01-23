/**
 * Benchmark types and interfaces
 * Defines data structures for all 4 benchmark categories
 */

// Re-export BenchmarkCategory enum from Prisma client
export { BenchmarkCategory } from '@prisma/client';

/**
 * Compensation category data structure
 * All fields optional - users submit partial data
 */
export interface CompensationData {
  gtm_engineer_us?: number;
  gtm_engineer_offshore?: number;
  sdr_bdr_us_salary?: number;
  sdr_bdr_us_commission?: string; // Text field for commission structure (e.g., "$100 per meeting")
  sdr_bdr_offshore_salary?: number;
  account_manager?: number;
  virtual_assistant_hourly?: number;
  copywriter_hourly?: number;
}

/**
 * Infrastructure category data structure
 * Covers costs and vendors for email infrastructure
 */
export interface InfrastructureData {
  cost_per_domain?: number;
  domain_vendor?: string;
  cost_per_inbox?: number;
  inbox_provider?: string;
  warmup_tool?: string;
  warmup_cost?: number;
  sending_platform?: string;
  sending_platform_cost?: number;
  data_enrichment_cost?: number;
}

/**
 * Business metrics category data structure
 * Revenue, pricing, and business health metrics
 */
export interface BusinessData {
  annual_revenue_band?: string;
  agency_type?: string;
  average_monthly_retainer?: number;
  pricing_model?: string;
  gross_margin_percent?: number;
  monthly_client_churn_percent?: number;
  revenue_per_employee?: number;
}

/**
 * Operational metrics category data structure
 * Email campaign operational metrics
 */
export interface OperationalData {
  domains_per_client?: number;
  inboxes_per_domain?: number;
  daily_sends_per_inbox?: number;
  warmup_period_days?: number;
  average_reply_rate_percent?: number;
  average_positive_reply_rate_percent?: number;
  average_meeting_rate_percent?: number;
}

/**
 * Union type for all benchmark data categories
 */
export type BenchmarkData =
  | CompensationData
  | InfrastructureData
  | BusinessData
  | OperationalData;

/**
 * Field configuration for UI metadata
 * Used by frontend to render benchmark forms dynamically
 */
export interface BenchmarkFieldConfig {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  options?: string[];
  max?: number;
}
