/**
 * Core data schemas for the airtime micro-loans POC
 * All event and entity types are defined here
 */

import { z } from 'zod';

// ============================================================================
// User Profile & Features
// ============================================================================

export const UserProfileSchema = z.object({
  msisdn: z.string(), // Phone number
  tenure_days: z.number().int().min(0),
  avg_topup_amount: z.number().min(0),
  topup_frequency_30d: z.number().int().min(0),
  opt_out: z.boolean().default(false),
  // Additional fields for richer personas
  last_topup_date: z.date().optional(),
  total_topups_90d: z.number().int().min(0).default(0),
  on_time_repay_rate: z.number().min(0).max(1).default(1.0), // 0-1, 1 = perfect
  recent_call_drops: z.number().int().min(0).default(0),
  device_type: z.enum(['smartphone', 'feature_phone', 'unknown']).default('smartphone'),
  region: z.string().optional(),
  network_quality_score: z.number().min(0).max(1).default(0.8), // 0-1
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// Feature vector snapshot (what the model sees)
export const FeatureVectorSchema = z.object({
  msisdn: z.string(),
  timestamp: z.date(),
  // Top-up features
  topup_frequency_30d: z.number(),
  avg_topup_amount: z.number(),
  last_topup_days_ago: z.number(),
  total_topups_90d: z.number(),
  // Tenure & loyalty
  tenure_days: z.number(),
  // Repayment history
  on_time_repay_rate: z.number(),
  total_loans: z.number().int(),
  total_repaid: z.number().int(),
  // Usage patterns
  recent_call_drops: z.number(),
  avg_call_duration_minutes: z.number().default(5),
  recent_low_balance_events: z.number().int().default(0),
  // Device/location proxies
  device_type: z.string(),
  region: z.string().optional(),
  network_quality_score: z.number(),
});

export type FeatureVector = z.infer<typeof FeatureVectorSchema>;

// ============================================================================
// Call Session Events
// ============================================================================

export const CallSessionEventSchema = z.object({
  event_type: z.enum(['call_start', 'call_end']),
  session_id: z.string().uuid(),
  msisdn: z.string(),
  start_time: z.date(),
  end_time: z.date().optional(),
  cell_id: z.string().optional(),
  region: z.string().optional(),
});

export type CallSessionEvent = z.infer<typeof CallSessionEventSchema>;

// ============================================================================
// Balance & Usage Events
// ============================================================================

export const BalanceUpdateEventSchema = z.object({
  event_type: z.literal('balance_update'),
  msisdn: z.string(),
  session_id: z.string().uuid().optional(), // If during active call
  balance: z.number().min(0),
  timestamp: z.date(),
  consumption_rate_per_min: z.number().min(0).default(0.1), // USD per minute
});

export type BalanceUpdateEvent = z.infer<typeof BalanceUpdateEventSchema>;

export const LowBalanceTriggerEventSchema = z.object({
  event_type: z.literal('low_balance_trigger'),
  msisdn: z.string(),
  session_id: z.string().uuid(),
  balance: z.number().min(0),
  threshold: z.number().min(0),
  timestamp: z.date(),
});

export type LowBalanceTriggerEvent = z.infer<typeof LowBalanceTriggerEventSchema>;

// ============================================================================
// Top-up Events
// ============================================================================

export const TopUpEventSchema = z.object({
  event_type: z.literal('topup'),
  msisdn: z.string(),
  amount: z.number().min(0),
  timestamp: z.date(),
  channel: z.enum(['online', 'retail', 'ussd', 'app']).default('online'),
  transaction_id: z.string().optional(),
});

export type TopUpEvent = z.infer<typeof TopUpEventSchema>;

// ============================================================================
// Model Decision
// ============================================================================

export const ModelDecisionSchema = z.object({
  decision_id: z.string().uuid(),
  model_name: z.string().default('airtime_risk_v1'),
  model_version: z.string().default('1.0.0'),
  timestamp: z.date(),
  msisdn: z.string(),
  features_snapshot: FeatureVectorSchema,
  outputs: z.object({
    p_repay: z.number().min(0).max(1), // Probability of repayment
    confidence: z.number().min(0).max(1),
    recommended_limit: z.number().min(0), // Raw recommended amount
  }),
  contributions: z.array(z.object({
    feature_name: z.string(),
    contribution: z.number(), // Can be positive or negative
    importance: z.number().min(0), // Absolute importance
  })),
});

export type ModelDecision = z.infer<typeof ModelDecisionSchema>;

// ============================================================================
// Offer
// ============================================================================

export const OfferStatusSchema = z.enum([
  'created',
  'sms_sent',
  'link_opened',
  'accepted',
  'declined',
  'expired',
  'disbursed',
]);

export const OfferSchema = z.object({
  offer_id: z.string().uuid(),
  msisdn: z.string(),
  session_id: z.string().uuid(),
  amount: z.number().min(0), // Final approved amount (bucketed)
  status: OfferStatusSchema,
  created_at: z.date(),
  expires_at: z.date(),
  reasons: z.array(z.string()), // User-facing reasons
  model_decision_id: z.string().uuid(),
  consent_token: z.string().optional(), // Short-lived token for consent link
  benefit_estimate: z.object({
    voice_minutes: z.number().optional(),
    data_days: z.number().optional(),
  }).optional(),
});

export type Offer = z.infer<typeof OfferSchema>;
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

// ============================================================================
// Loan
// ============================================================================

export const LoanSchema = z.object({
  loan_id: z.string().uuid(),
  offer_id: z.string().uuid(),
  msisdn: z.string(),
  amount: z.number().min(0),
  disbursed_at: z.date().optional(),
  repaid_at: z.date().optional(),
  repayment_method: z.literal('next_topup'),
  status: z.enum(['pending', 'disbursed', 'repaid', 'overdue']).default('pending'),
});

export type Loan = z.infer<typeof LoanSchema>;

// ============================================================================
// Ledger Events
// ============================================================================

export const LedgerEventTypeSchema = z.enum([
  'offer_created',
  'sms_sent',
  'link_opened',
  'offer_accepted',
  'offer_declined',
  'disbursal_initiated',
  'disbursal_completed',
  'topup_detected',
  'repayment_initiated',
  'repayment_completed',
  'offer_expired',
]);

export const LedgerEventSchema = z.object({
  event_id: z.string().uuid(),
  type: LedgerEventTypeSchema,
  entity_id: z.string(), // offer_id, loan_id, etc.
  entity_type: z.enum(['offer', 'loan', 'user']),
  timestamp: z.date(),
  payload: z.record(z.any()), // Flexible payload for event-specific data
});

export type LedgerEvent = z.infer<typeof LedgerEventSchema>;
export type LedgerEventType = z.infer<typeof LedgerEventTypeSchema>;

// ============================================================================
// SMS
// ============================================================================

export const SmsMessageSchema = z.object({
  message_id: z.string().uuid(),
  msisdn: z.string(),
  message: z.string(),
  offer_id: z.string().uuid().optional(),
  sent_at: z.date().optional(),
  delivered: z.boolean().default(false),
  delivery_failed: z.boolean().default(false),
});

export type SmsMessage = z.infer<typeof SmsMessageSchema>;

// ============================================================================
// Union type for all events
// ============================================================================

export type MnoEvent = CallSessionEvent | BalanceUpdateEvent | LowBalanceTriggerEvent | TopUpEvent;

// ============================================================================
// API Request/Response types
// ============================================================================

export const ConsentRequestSchema = z.object({
  token: z.string(),
  action: z.enum(['accept', 'decline']),
});

export type ConsentRequest = z.infer<typeof ConsentRequestSchema>;

export const ConsentResponseSchema = z.object({
  success: z.boolean(),
  offer_id: z.string().uuid().optional(),
  loan_id: z.string().uuid().optional(),
  message: z.string(),
});

export type ConsentResponse = z.infer<typeof ConsentResponseSchema>;


