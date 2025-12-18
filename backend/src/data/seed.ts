/**
 * Seed initial mock data so cockpit dashboard isn't empty on load.
 */

import { v4 as uuidv4 } from 'uuid';
import { PERSONAS } from './personas.js';
import type {
  Offer,
  Loan,
  FeatureVector,
  UserProfile,
} from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';
import { modelService } from '../services/modelService.js';
import { buildOfferContextReasons } from '../services/insightService.js';

type Outcome = 'repaid' | 'active' | 'declined';

interface OfferSeed {
  amount: number;
  outcome: Outcome;
  createdDaysAgo: number;
  repaidDaysAgo?: number;
}

interface PersonaSeed {
  initialBalance: number;
  topups: Array<{ amount: number; daysAgo: number; channel?: 'online' | 'retail' | 'ussd' | 'app' }>;
  offers: OfferSeed[];
}

const PERSONA_HISTORY_SEEDS: Record<string, PersonaSeed> = {
  onTimeRepayer: {
    initialBalance: 6.5,
    topups: [
      { amount: 25, daysAgo: 2 },
      { amount: 25, daysAgo: 12 },
      { amount: 30, daysAgo: 28 },
    ],
    offers: [
      { amount: 10, outcome: 'repaid', createdDaysAgo: 5, repaidDaysAgo: 1 },
      { amount: 10, outcome: 'repaid', createdDaysAgo: 18, repaidDaysAgo: 14 },
      { amount: 5, outcome: 'repaid', createdDaysAgo: 35, repaidDaysAgo: 31 },
    ],
  },
  frequentUser: {
    initialBalance: 5.2,
    topups: [
      { amount: 15, daysAgo: 1 },
      { amount: 12, daysAgo: 6 },
      { amount: 10, daysAgo: 11 },
      { amount: 18, daysAgo: 20 },
    ],
    offers: [
      { amount: 5, outcome: 'active', createdDaysAgo: 5 },
      { amount: 5, outcome: 'repaid', createdDaysAgo: 15, repaidDaysAgo: 11 },
      { amount: 3, outcome: 'declined', createdDaysAgo: 30 },
    ],
  },
  newUser: {
    initialBalance: 3.2,
    topups: [
      { amount: 10, daysAgo: 4 },
      { amount: 10, daysAgo: 25 },
    ],
    offers: [
      { amount: 3, outcome: 'declined', createdDaysAgo: 9 },
    ],
  },
  riskyUser: {
    initialBalance: 2.5,
    topups: [
      { amount: 5, daysAgo: 7 },
      { amount: 5, daysAgo: 18 },
    ],
    offers: [
      { amount: 3, outcome: 'declined', createdDaysAgo: 8 },
      { amount: 5, outcome: 'declined', createdDaysAgo: 25 },
    ],
  },
  optedOut: {
    initialBalance: 4.1,
    topups: [
      { amount: 25, daysAgo: 3 },
      { amount: 20, daysAgo: 10 },
      { amount: 25, daysAgo: 26 },
    ],
    offers: [],
  },
};

const msInDay = 24 * 60 * 60 * 1000;
const minutesToMs = (minutes: number) => minutes * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * msInDay);
}

function seedBalanceHistory(profile: UserProfile, personaSeed?: PersonaSeed): void {
  const baseline = personaSeed?.initialBalance ?? 5;
  const samples = 12;
  let balance = baseline + 1;
  for (let i = samples; i > 0; i--) {
    const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
    balance = Math.max(0, balance - 0.15 - Math.random() * 0.2);
    store.addBalanceUpdate(profile.msisdn, {
      event_type: 'balance_update',
      msisdn: profile.msisdn,
      balance: parseFloat(Math.max(0, balance + (Math.random() - 0.5) * 0.2).toFixed(2)),
      timestamp,
      consumption_rate_per_min: 0.08 + Math.random() * 0.05,
    });
  }

  store.addBalanceUpdate(profile.msisdn, {
    event_type: 'balance_update',
    msisdn: profile.msisdn,
    balance: baseline,
    timestamp: new Date(),
    consumption_rate_per_min: 0.08 + Math.random() * 0.05,
  });
}

function buildFeatureVector(profile: UserProfile, overrides: Partial<FeatureVector> = {}): FeatureVector {
  const lastTopupDaysAgo = profile.last_topup_date
    ? Math.floor((Date.now() - profile.last_topup_date.getTime()) / msInDay)
    : 5;

  return {
    msisdn: profile.msisdn,
    timestamp: new Date(),
    topup_frequency_30d: profile.topup_frequency_30d,
    avg_topup_amount: profile.avg_topup_amount,
    last_topup_days_ago: lastTopupDaysAgo,
    total_topups_90d: profile.total_topups_90d,
    tenure_days: profile.tenure_days,
    on_time_repay_rate: profile.on_time_repay_rate,
    total_loans: overrides.total_loans ?? 0,
    total_repaid: overrides.total_repaid ?? 0,
    recent_call_drops: profile.recent_call_drops,
    avg_call_duration_minutes: overrides.avg_call_duration_minutes ?? 7 + Math.random() * 5,
    recent_low_balance_events: overrides.recent_low_balance_events ?? 2,
    device_type: profile.device_type,
    region: profile.region,
    network_quality_score: profile.network_quality_score,
  };
}

function createOfferFromSeed(profile: UserProfile, seed: OfferSeed, index: number): Offer {
  const createdAt = daysAgo(seed.createdDaysAgo);
  const sessionId = uuidv4();
  const features = buildFeatureVector(profile, {
    total_loans: index,
    total_repaid: index,
  });
  const decision = modelService.predict(features);
  store.setModelDecision(decision);

  const offer: Offer = {
    offer_id: uuidv4(),
    msisdn: profile.msisdn,
    session_id: sessionId,
    amount: seed.amount,
    status: seed.outcome === 'declined' ? 'declined' : 'disbursed',
    created_at: createdAt,
    expires_at: new Date(createdAt.getTime() + minutesToMs(10)),
    reasons: ['Based on your usage patterns', 'Great repayment history'],
    model_decision_id: decision.decision_id,
    consent_token: uuidv4(),
    benefit_estimate: {
      voice_minutes: Math.floor(seed.amount * 8),
      data_days: Math.max(1, Math.floor(seed.amount / 0.6)),
    },
    context_reasons: buildOfferContextReasons(profile.msisdn),
  };

  store.setOffer(offer);

  if (seed.outcome !== 'declined') {
    const loan: Loan = {
      loan_id: uuidv4(),
      offer_id: offer.offer_id,
      msisdn: profile.msisdn,
      amount: seed.amount,
      repayment_method: 'next_topup',
      status: seed.outcome === 'repaid' ? 'repaid' : 'disbursed',
      disbursed_at: new Date(createdAt.getTime() + minutesToMs(2)),
      repaid_at: seed.outcome === 'repaid' && seed.repaidDaysAgo
        ? daysAgo(seed.repaidDaysAgo)
        : undefined,
    };

    // For demo personas, mark older "active" loans as repaid so they can receive new offers
    if (
      loan.status === 'disbursed' &&
      seed.createdDaysAgo > 2
    ) {
      loan.status = 'repaid';
      loan.repaid_at = daysAgo(Math.max(seed.createdDaysAgo - 1, 0));
    }

    store.setLoan(loan);
  }

  return offer;
}

export function seedInitialData(): void {
  Object.entries(PERSONAS).forEach(([key, profile]) => {
    store.setUser(profile.msisdn, profile);

    seedPersonaData(key);
  });
}

export function seedPersonaData(personaKey: string): void {
  const profile = PERSONAS[personaKey];
  if (!profile) return;

  store.resetUserState(profile.msisdn);
  store.setUser(profile.msisdn, profile);

  const personaSeed = PERSONA_HISTORY_SEEDS[personaKey];
  seedBalanceHistory(profile, personaSeed);

  if (!personaSeed) {
    return;
  }

  personaSeed.topups.forEach((topUpSeed) => {
    store.addTopUp(profile.msisdn, {
      event_type: 'topup',
      msisdn: profile.msisdn,
      amount: topUpSeed.amount,
      timestamp: daysAgo(topUpSeed.daysAgo),
      channel: topUpSeed.channel || 'online',
      transaction_id: uuidv4(),
    });
  });

  personaSeed.offers.forEach((offerSeed, index) => {
    createOfferFromSeed(profile, offerSeed, index);
  });
}
