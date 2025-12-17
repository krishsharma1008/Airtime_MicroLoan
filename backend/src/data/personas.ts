/**
 * Seeded user personas for POC demo
 * Each persona has different risk profiles and usage patterns
 */

import type { UserProfile } from '../types/schemas.js';

export const PERSONAS: Record<string, UserProfile> = {
  onTimeRepayer: {
    msisdn: '+1234567890',
    tenure_days: 240,
    avg_topup_amount: 20,
    topup_frequency_30d: 4,
    opt_out: false,
    last_topup_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    total_topups_90d: 12,
    on_time_repay_rate: 1.0, // Perfect repayment
    recent_call_drops: 0,
    device_type: 'smartphone',
    region: 'US-West',
    network_quality_score: 0.9,
  },
  frequentUser: {
    msisdn: '+1234567891',
    tenure_days: 180,
    avg_topup_amount: 15,
    topup_frequency_30d: 6,
    opt_out: false,
    last_topup_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    total_topups_90d: 18,
    on_time_repay_rate: 0.95,
    recent_call_drops: 1,
    device_type: 'smartphone',
    region: 'US-East',
    network_quality_score: 0.85,
  },
  newUser: {
    msisdn: '+1234567892',
    tenure_days: 30,
    avg_topup_amount: 10,
    topup_frequency_30d: 2,
    opt_out: false,
    last_topup_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    total_topups_90d: 2,
    on_time_repay_rate: 1.0, // No history, assume good
    recent_call_drops: 0,
    device_type: 'smartphone',
    region: 'US-Central',
    network_quality_score: 0.75,
  },
  riskyUser: {
    msisdn: '+1234567893',
    tenure_days: 120,
    avg_topup_amount: 5,
    topup_frequency_30d: 1,
    opt_out: false,
    last_topup_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    total_topups_90d: 3,
    on_time_repay_rate: 0.6, // Poor repayment history
    recent_call_drops: 3,
    device_type: 'feature_phone',
    region: 'US-South',
    network_quality_score: 0.6,
  },
  optedOut: {
    msisdn: '+1234567894',
    tenure_days: 365,
    avg_topup_amount: 25,
    topup_frequency_30d: 3,
    opt_out: true, // User opted out
    last_topup_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    total_topups_90d: 9,
    on_time_repay_rate: 1.0,
    recent_call_drops: 0,
    device_type: 'smartphone',
    region: 'US-West',
    network_quality_score: 0.9,
  },
};

export function getPersonaByName(name: string): UserProfile | undefined {
  return PERSONAS[name];
}

export function getAllPersonaNames(): string[] {
  return Object.keys(PERSONAS);
}


