/**
 * MNO Event Simulator
 * Generates realistic call sessions, balance depletion, and top-up events
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CallSessionEvent,
  BalanceUpdateEvent,
  TopUpEvent,
  MnoEvent,
} from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';

export class MnoEventSimulator {
  private activeSimulations: Map<string, NodeJS.Timeout> = new Map();
  private eventCallbacks: ((event: MnoEvent) => void)[] = [];

  /**
   * Register a callback to receive events
   */
  onEvent(callback: (event: MnoEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  private emitEvent(event: MnoEvent): void {
    this.eventCallbacks.forEach((cb) => cb(event));
  }

  /**
   * Start a simulated call for a user
   */
  startCall(msisdn: string): string {
    const sessionId = uuidv4();
    const callStart: CallSessionEvent = {
      event_type: 'call_start',
      session_id: sessionId,
      msisdn,
      start_time: new Date(),
      cell_id: `cell_${Math.floor(Math.random() * 1000)}`,
      region: store.getUser(msisdn)?.region,
    };

    store.setCallSession(sessionId, callStart);
    this.emitEvent(callStart);

    const latestBalance = store.getLatestBalance(msisdn)?.balance ?? 2;
    const startingBalance = Math.min(Math.max(1.5, latestBalance), 4); // keep journeys snappy while showing gradual drop
    const initialBalanceUpdate: BalanceUpdateEvent = {
      event_type: 'balance_update',
      msisdn,
      session_id: sessionId,
      balance: startingBalance,
      timestamp: new Date(),
      consumption_rate_per_min: 60,
    };
    store.addBalanceUpdate(msisdn, initialBalanceUpdate);
    this.emitEvent(initialBalanceUpdate);

    // Start balance depletion simulation
    this.simulateBalanceDepletion(msisdn, sessionId, startingBalance);

    return sessionId;
  }

  /**
   * End a call
   */
  endCall(sessionId: string): void {
    const session = store.getCallSession(sessionId);
    if (!session || session.event_type !== 'call_start') return;

    const callEnd: CallSessionEvent = {
      ...session,
      event_type: 'call_end',
      end_time: new Date(),
    };

    store.setCallSession(sessionId, callEnd);
    this.emitEvent(callEnd);

    // Stop balance depletion
    const key = `${session.msisdn}_${sessionId}`;
    const interval = this.activeSimulations.get(key);
    if (interval) {
      clearInterval(interval);
      this.activeSimulations.delete(key);
    }
  }

  /**
   * Simulate balance depletion during a call
   * Speeds up consumption for demo purposes so journeys finish quickly
   */
  private simulateBalanceDepletion(msisdn: string, sessionId: string, initialBalance: number): void {
    const user = store.getUser(msisdn);
    if (!user) return;

    // Get current balance or start with a small amount
    let currentBalance = initialBalance || store.getLatestBalance(msisdn)?.balance || 2.0; // Start with $2
    const intervalMs = 1200;
    const consumptionRatePerMin = 6; // ~10 cents per second
    const depletionPerTick = 0.1; // 10 cents per tick

    const key = `${msisdn}_${sessionId}`;
    const interval = setInterval(() => {
      const session = store.getCallSession(sessionId);
      if (!session || session.end_time) {
        clearInterval(interval);
        this.activeSimulations.delete(key);
        return;
      }

      // Deplete balance gradually in 10-cent increments
      currentBalance = Math.max(0, Number((currentBalance - depletionPerTick).toFixed(2)));

      const balanceUpdate: BalanceUpdateEvent = {
        event_type: 'balance_update',
        msisdn,
        session_id: sessionId,
        balance: Number(currentBalance.toFixed(2)),
        timestamp: new Date(),
        consumption_rate_per_min: consumptionRatePerMin,
      };

      store.addBalanceUpdate(msisdn, balanceUpdate);
      this.emitEvent(balanceUpdate);

      // If balance is very low, we'll let TriggerService handle the low_balance_trigger
    }, intervalMs);

    this.activeSimulations.set(key, interval);
  }

  /**
   * Simulate a top-up event
   */
  simulateTopUp(msisdn: string, amount: number, channel: 'online' | 'retail' | 'ussd' | 'app' = 'online'): void {
    const topUp: TopUpEvent = {
      event_type: 'topup',
      msisdn,
      amount,
      timestamp: new Date(),
      channel,
      transaction_id: uuidv4(),
    };

    store.addTopUp(msisdn, topUp);
    this.emitEvent(topUp);

    // Update user's last top-up date
    const user = store.getUser(msisdn);
    if (user) {
      user.last_topup_date = new Date();
      user.total_topups_90d += 1;
      store.setUser(msisdn, user);
    }

    // Update balance
    const latestBalance = store.getLatestBalance(msisdn);
    const newBalance = (latestBalance?.balance || 0) + amount;

    const balanceUpdate: BalanceUpdateEvent = {
      event_type: 'balance_update',
      msisdn,
      balance: newBalance,
      timestamp: new Date(),
      consumption_rate_per_min: 60,
    };

    store.addBalanceUpdate(msisdn, balanceUpdate);
    this.emitEvent(balanceUpdate);
  }

  /**
   * Stop all simulations
   */
  stopAll(): void {
    this.activeSimulations.forEach((interval) => clearInterval(interval));
    this.activeSimulations.clear();
  }
}

export const simulator = new MnoEventSimulator();
