/**
 * Eligibility Service
 * Applies hard gates and consumes model output to decide eligibility
 */

import type { UserProfile, ModelDecision, FeatureVector } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';
import { featureStore } from './featureStore.js';
import { modelService } from './modelService.js';

const MIN_TENURE_DAYS = 30;
const MIN_P_REPAY = 0.5; // Minimum probability of repayment (loosened so more personas qualify)
const MIN_CONFIDENCE = 0.6;
const ACTIVE_LOAN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // allow new offers if prior loan is older than 24h

export interface EligibilityResult {
  eligible: boolean;
  modelDecision: ModelDecision | null;
  reasons: string[];
  approvedAmount: number | null;
  benefitEstimate?: {
    voice_minutes?: number;
    data_days?: number;
  };
}

export class EligibilityService {
  /**
   * Check if a user is eligible for a loan offer
   */
  checkEligibility(msisdn: string): EligibilityResult {
    const user = store.getUser(msisdn);
    if (!user) {
      return {
        eligible: false,
        modelDecision: null,
        reasons: ['User not found'],
        approvedAmount: null,
      };
    }

    // Hard gates
    if (user.opt_out) {
      return {
        eligible: false,
        modelDecision: null,
        reasons: ['User has opted out'],
        approvedAmount: null,
      };
    }

    if (user.tenure_days < MIN_TENURE_DAYS) {
      return {
        eligible: false,
        modelDecision: null,
        reasons: [`Minimum tenure requirement not met (${MIN_TENURE_DAYS} days)`],
        approvedAmount: null,
      };
    }

    // Check for active unpaid loan
    const activeLoan = store.getActiveLoanForUser(msisdn);
    if (activeLoan && ['pending', 'disbursed'].includes(activeLoan.status)) {
      const disbursedAt = activeLoan.disbursed_at?.getTime();
      const withinCooldown =
        activeLoan.status === 'pending' ||
        !disbursedAt ||
        Date.now() - disbursedAt < ACTIVE_LOAN_COOLDOWN_MS;

      if (withinCooldown) {
        return {
          eligible: false,
          modelDecision: null,
          reasons: ['Active loan cooling down'],
          approvedAmount: null,
        };
      }
    }

    // Get feature vector and run model
    const features = featureStore.getFeatureVector(msisdn);
    if (!features) {
      return {
        eligible: false,
        modelDecision: null,
        reasons: ['Unable to generate features'],
        approvedAmount: null,
      };
    }

    const modelDecision = modelService.predict(features);
    store.setModelDecision(modelDecision);

    // Check model outputs against thresholds
    if (modelDecision.outputs.p_repay < MIN_P_REPAY) {
      return {
        eligible: false,
        modelDecision,
        reasons: ['Repayment probability too low'],
        approvedAmount: null,
      };
    }

    if (modelDecision.outputs.confidence < MIN_CONFIDENCE) {
      return {
        eligible: false,
        modelDecision,
        reasons: ['Model confidence too low'],
        approvedAmount: null,
      };
    }

    // Apply policy constraints
    const approvedAmount = this.applyPolicyConstraints(modelDecision, user);

    if (approvedAmount === null) {
      return {
        eligible: false,
        modelDecision,
        reasons: ['Policy constraints not met'],
        approvedAmount: null,
      };
    }

    // Generate user-facing reasons
    const reasons = modelService.generateUserReasons(modelDecision);

    // Calculate benefit estimate
    const benefitEstimate = this.calculateBenefitEstimate(approvedAmount, features);

    return {
      eligible: true,
      modelDecision,
      reasons,
      approvedAmount,
      benefitEstimate,
    };
  }

  /**
   * Apply policy constraints to model-recommended limit
   */
  private applyPolicyConstraints(modelDecision: ModelDecision, user: UserProfile): number | null {
    let limit = modelDecision.outputs.recommended_limit;

    // Cap by max exposure per user (e.g., 50% of average top-up)
    const maxExposure = user.avg_topup_amount * 0.5;
    limit = Math.min(limit, maxExposure);

    // Cap by recent top-up amount (don't offer more than they typically top up)
    limit = Math.min(limit, user.avg_topup_amount);

    // Floor: minimum $1
    if (limit < 1) return null;

    // Bucket the amount
    const buckets = [1, 5, 10];
    const bucket = buckets.filter((b) => b <= limit).pop() || buckets[0];

    return bucket;
  }

  /**
   * Calculate benefit estimate (voice minutes / data days)
   */
  private calculateBenefitEstimate(amount: number, features: FeatureVector): {
    voice_minutes?: number;
    data_days?: number;
  } {
    // Simple rate model
    const voiceRatePerMinute = 0.1; // $0.10 per minute
    const dataRatePerDay = 0.5; // $0.50 per day for typical usage

    const voiceMinutes = Math.floor(amount / voiceRatePerMinute);
    const dataDays = Math.floor(amount / dataRatePerDay);

    return {
      voice_minutes: voiceMinutes,
      data_days: dataDays,
    };
  }
}

export const eligibilityService = new EligibilityService();

