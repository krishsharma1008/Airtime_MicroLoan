/**
 * Ledger Service
 * Immutable audit trail for all events
 */

import { v4 as uuidv4 } from 'uuid';
import type { LedgerEvent } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';

export class LedgerService {
  /**
   * Log an event to the ledger
   */
  logEvent(event: Omit<LedgerEvent, 'event_id' | 'timestamp'>): void {
    const ledgerEvent: LedgerEvent = {
      event_id: uuidv4(),
      timestamp: new Date(),
      ...event,
    };

    store.addLedgerEvent(ledgerEvent);
  }

  /**
   * Get ledger events for an entity
   */
  getEventsForEntity(entityId: string, entityType?: string): LedgerEvent[] {
    return store.getLedgerEvents(entityId, entityType);
  }

  /**
   * Get all recent ledger events
   */
  getAllEvents(limit: number = 100): LedgerEvent[] {
    return store.getLedgerEvents().slice(0, limit);
  }
}

export const ledgerService = new LedgerService();


