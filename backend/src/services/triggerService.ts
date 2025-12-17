/**
 * Trigger Service
 * Detects low-balance during active call with debounce and cooldown
 */

import { v4 as uuidv4 } from 'uuid';
import type { LowBalanceTriggerEvent, BalanceUpdateEvent } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';

const LOW_BALANCE_THRESHOLD = 1.0; // $1.00 threshold for demo speed
const DEBOUNCE_MS = 3000; // 3 seconds - accelerate repeated triggers for the POC
const COOLDOWN_MS = 60000; // 1 minute cooldown keeps pace with faster journeys

export class TriggerService {
  private lastTriggerTime: Map<string, number> = new Map(); // msisdn -> timestamp
  private triggerCallbacks: ((event: LowBalanceTriggerEvent) => void)[] = [];

  onTrigger(callback: (event: LowBalanceTriggerEvent) => void): void {
    this.triggerCallbacks.push(callback);
  }

  private emitTrigger(event: LowBalanceTriggerEvent): void {
    this.triggerCallbacks.forEach((cb) => cb(event));
  }

  /**
   * Check if a balance update should trigger a low-balance offer
   */
  checkBalanceUpdate(update: BalanceUpdateEvent): void {
    const { msisdn, session_id, balance, timestamp } = update;

    // Must be during an active call
    if (!session_id) return;
    const session = store.getCallSession(session_id);
    if (!session || session.end_time) return;

    // Check if balance is below threshold
    if (balance > LOW_BALANCE_THRESHOLD) return;

    // Debounce check
    const lastTrigger = this.lastTriggerTime.get(msisdn) || 0;
    const timeSinceLastTrigger = timestamp.getTime() - lastTrigger;
    if (timeSinceLastTrigger < DEBOUNCE_MS) return;

    // Cooldown check - don't offer if we recently offered
    const recentOffer = store.getActiveOfferForUser(msisdn);
    if (recentOffer) {
      const timeSinceOffer = timestamp.getTime() - recentOffer.created_at.getTime();
      if (timeSinceOffer < COOLDOWN_MS) return;
    }

    // Check if user already has an active loan
    const activeLoan = store.getActiveLoanForUser(msisdn);
    if (activeLoan && activeLoan.status === 'disbursed') return;

    // Create trigger event
    const triggerEvent: LowBalanceTriggerEvent = {
      event_type: 'low_balance_trigger',
      msisdn,
      session_id,
      balance,
      threshold: LOW_BALANCE_THRESHOLD,
      timestamp,
    };

    this.lastTriggerTime.set(msisdn, timestamp.getTime());
    this.emitTrigger(triggerEvent);
  }
}

export const triggerService = new TriggerService();

