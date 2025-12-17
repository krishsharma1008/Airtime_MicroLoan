/**
 * Model Service (Emulator)
 * Produces model-like outputs (P_repay, confidence, recommended_limit) plus feature contributions
 * This is a deterministic emulator that mimics ML behavior without actual training
 */

import { v4 as uuidv4 } from 'uuid';
import type { FeatureVector, ModelDecision } from '../types/schemas.js';
import { featureStore } from './featureStore.js';

const MODEL_NAME = 'airtime_risk_v1';
const MODEL_VERSION = '1.0.0';

// Amount buckets (USD)
const AMOUNT_BUCKETS = [1, 5, 10];

export class ModelService {
  /**
   * Generate a model decision from a feature vector
   */
  predict(features: FeatureVector): ModelDecision {
    const contributions = this.calculateContributions(features);
    const pRepay = this.calculateRepayProbability(features, contributions);
    const confidence = this.calculateConfidence(features, contributions);
    const recommendedLimit = this.calculateRecommendedLimit(features, pRepay, confidence);

    return {
      decision_id: uuidv4(),
      model_name: MODEL_NAME,
      model_version: MODEL_VERSION,
      timestamp: new Date(),
      msisdn: features.msisdn,
      features_snapshot: features,
      outputs: {
        p_repay: pRepay,
        confidence,
        recommended_limit: recommendedLimit,
      },
      contributions: contributions.map((c) => ({
        feature_name: c.feature,
        contribution: c.contribution,
        importance: Math.abs(c.contribution),
      })),
    };
  }

  /**
   * Calculate feature contributions (SHAP-like, but deterministic for POC)
   */
  private calculateContributions(features: FeatureVector): Array<{ feature: string; contribution: number }> {
    const contributions: Array<{ feature: string; contribution: number }> = [];

    // Positive contributions (increase P_repay)
    if (features.tenure_days > 90) {
      contributions.push({ feature: 'tenure_days', contribution: 0.15 });
    } else if (features.tenure_days > 30) {
      contributions.push({ feature: 'tenure_days', contribution: 0.08 });
    }

    if (features.on_time_repay_rate >= 0.9) {
      contributions.push({ feature: 'on_time_repay_rate', contribution: 0.2 });
    } else if (features.on_time_repay_rate >= 0.7) {
      contributions.push({ feature: 'on_time_repay_rate', contribution: 0.1 });
    }

    if (features.topup_frequency_30d >= 4) {
      contributions.push({ feature: 'topup_frequency_30d', contribution: 0.12 });
    } else if (features.topup_frequency_30d >= 2) {
      contributions.push({ feature: 'topup_frequency_30d', contribution: 0.06 });
    }

    if (features.avg_topup_amount >= 15) {
      contributions.push({ feature: 'avg_topup_amount', contribution: 0.1 });
    }

    if (features.total_topups_90d >= 10) {
      contributions.push({ feature: 'total_topups_90d', contribution: 0.08 });
    }

    if (features.network_quality_score >= 0.8) {
      contributions.push({ feature: 'network_quality_score', contribution: 0.05 });
    }

    if (features.device_type === 'smartphone') {
      contributions.push({ feature: 'device_type', contribution: 0.05 });
    }

    // Negative contributions (decrease P_repay)
    if (features.recent_call_drops >= 3) {
      contributions.push({ feature: 'recent_call_drops', contribution: -0.15 });
    } else if (features.recent_call_drops >= 1) {
      contributions.push({ feature: 'recent_call_drops', contribution: -0.08 });
    }

    if (features.recent_low_balance_events >= 5) {
      contributions.push({ feature: 'recent_low_balance_events', contribution: -0.1 });
    }

    if (features.last_topup_days_ago > 7) {
      contributions.push({ feature: 'last_topup_days_ago', contribution: -0.12 });
    }

    if (features.on_time_repay_rate < 0.7) {
      contributions.push({ feature: 'on_time_repay_rate', contribution: -0.15 });
    }

    // Sort by absolute contribution
    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return contributions;
  }

  /**
   * Calculate repayment probability from features and contributions
   */
  private calculateRepayProbability(
    features: FeatureVector,
    contributions: Array<{ feature: string; contribution: number }>
  ): number {
    // Base probability
    let pRepay = 0.5;

    // Sum contributions
    const totalContribution = contributions.reduce((sum, c) => sum + c.contribution, 0);
    pRepay += totalContribution;

    // Add some noise for realism (but keep deterministic based on features)
    const noise = (features.msisdn.charCodeAt(0) % 100) / 1000; // Deterministic "random"
    pRepay += noise - 0.05;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, pRepay));
  }

  /**
   * Calculate confidence in the prediction
   */
  private calculateConfidence(
    features: FeatureVector,
    contributions: Array<{ feature: string; contribution: number }>
  ): number {
    // Higher confidence if we have more data points
    let confidence = 0.5;

    if (features.tenure_days > 90) confidence += 0.2;
    if (features.total_loans > 0) confidence += 0.15;
    if (features.topup_frequency_30d >= 3) confidence += 0.1;
    if (features.total_topups_90d >= 5) confidence += 0.05;

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  /**
   * Calculate recommended limit based on P_repay and confidence
   */
  private calculateRecommendedLimit(
    features: FeatureVector,
    pRepay: number,
    confidence: number
  ): number {
    // Base limit calculation
    const riskAdjustedLimit = features.avg_topup_amount * pRepay * confidence;

    // Cap by user's typical top-up amount
    const maxLimit = Math.min(riskAdjustedLimit, features.avg_topup_amount * 0.5);

    // Find the largest bucket that fits
    const bucket = AMOUNT_BUCKETS.filter((b) => b <= maxLimit).pop() || AMOUNT_BUCKETS[0];

    return bucket;
  }

  /**
   * Generate user-facing reasons from contributions
   */
  generateUserReasons(decision: ModelDecision): string[] {
    const reasons: string[] = [];
    const topContributions = decision.contributions
      .filter((c) => c.contribution > 0)
      .slice(0, 5);

    for (const contrib of topContributions) {
      const feature = contrib.feature_name;
      const features = decision.features_snapshot;

      switch (feature) {
        case 'tenure_days':
          reasons.push(`You've been with us for ${Math.floor(features.tenure_days / 30)} months`);
          break;
        case 'on_time_repay_rate':
          if (features.on_time_repay_rate >= 0.9) {
            reasons.push('Excellent repayment history');
          }
          break;
        case 'topup_frequency_30d':
          reasons.push(`You recharge ${features.topup_frequency_30d} times per month`);
          break;
        case 'avg_topup_amount':
          reasons.push(`Your average recharge is $${features.avg_topup_amount}`);
          break;
        case 'total_topups_90d':
          reasons.push(`Active user with ${features.total_topups_90d} recharges in the last 3 months`);
          break;
        case 'network_quality_score':
          reasons.push('Good network connection history');
          break;
        case 'device_type':
          reasons.push('Smartphone user');
          break;
      }
    }

    // Always include at least one reason
    if (reasons.length === 0) {
      reasons.push('Based on your usage patterns');
    }

    return reasons.slice(0, 5); // Max 5 reasons
  }
}

export const modelService = new ModelService();


