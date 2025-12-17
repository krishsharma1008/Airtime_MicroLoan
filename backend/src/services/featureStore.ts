/**
 * Feature Store Mock
 * Serves realistic feature vectors per user for model consumption
 */

import type { UserProfile, FeatureVector } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';

export class FeatureStoreMock {
  /**
   * Build a feature vector for a user at a given timestamp
   */
  getFeatureVector(msisdn: string, timestamp: Date = new Date()): FeatureVector | null {
    const user = store.getUser(msisdn);
    if (!user) return null;

    const topUps = store.getTopUps(msisdn);
    const loans = store.getLoansByMsisdn(msisdn);
    const recentOffers = store.getOffersByMsisdn(msisdn).filter(
      (o) => o.created_at > new Date(timestamp.getTime() - 30 * 24 * 60 * 60 * 1000)
    );

    // Calculate last top-up days ago
    const lastTopupDaysAgo = user.last_topup_date
      ? Math.floor((timestamp.getTime() - user.last_topup_date.getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    // Calculate recent low balance events (offers created in last 30 days)
    const recentLowBalanceEvents = recentOffers.length;

    // Calculate repayment history
    const totalLoans = loans.length;
    const repaidLoans = loans.filter((l) => l.status === 'repaid').length;
    const totalRepaid = totalLoans > 0 ? repaidLoans / totalLoans : 1.0;

    // Average call duration (mock - in real system would come from CDR)
    const avgCallDurationMinutes = 5 + Math.random() * 10; // 5-15 minutes

    return {
      msisdn,
      timestamp,
      // Top-up features
      topup_frequency_30d: user.topup_frequency_30d,
      avg_topup_amount: user.avg_topup_amount,
      last_topup_days_ago: lastTopupDaysAgo,
      total_topups_90d: user.total_topups_90d,
      // Tenure & loyalty
      tenure_days: user.tenure_days,
      // Repayment history
      on_time_repay_rate: user.on_time_repay_rate,
      total_loans: totalLoans,
      total_repaid: repaidLoans,
      // Usage patterns
      recent_call_drops: user.recent_call_drops,
      avg_call_duration_minutes,
      recent_low_balance_events: recentLowBalanceEvents,
      // Device/location proxies
      device_type: user.device_type,
      region: user.region,
      network_quality_score: user.network_quality_score,
    };
  }
}

export const featureStore = new FeatureStoreMock();


