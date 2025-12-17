/**
 * In-memory data store for POC
 * In production, this would be replaced with a real database
 */

import type {
  UserProfile,
  CallSessionEvent,
  BalanceUpdateEvent,
  TopUpEvent,
  Offer,
  Loan,
  LedgerEvent,
  SmsMessage,
  ModelDecision,
  JourneyEvent,
} from '../types/schemas.js';

export class InMemoryStore {
  private users: Map<string, UserProfile> = new Map();
  private callSessions: Map<string, CallSessionEvent> = new Map();
  private balanceSnapshots: Map<string, BalanceUpdateEvent[]> = new Map(); // msisdn -> events
  private topUps: Map<string, TopUpEvent[]> = new Map(); // msisdn -> events
  private offers: Map<string, Offer> = new Map(); // offer_id -> offer
  private loans: Map<string, Loan> = new Map(); // loan_id -> loan
  private ledger: LedgerEvent[] = [];
  private smsMessages: Map<string, SmsMessage> = new Map(); // message_id -> message
  private modelDecisions: Map<string, ModelDecision> = new Map(); // decision_id -> decision
  private journeyEvents: Map<string, JourneyEvent[]> = new Map(); // msisdn -> journey timeline

  // User Profile methods
  getUser(msisdn: string): UserProfile | undefined {
    return this.users.get(msisdn);
  }

  setUser(msisdn: string, profile: UserProfile): void {
    this.users.set(msisdn, profile);
  }

  getAllUsers(): UserProfile[] {
    return Array.from(this.users.values());
  }

  // Call Session methods
  getCallSession(sessionId: string): CallSessionEvent | undefined {
    return this.callSessions.get(sessionId);
  }

  setCallSession(sessionId: string, session: CallSessionEvent): void {
    this.callSessions.set(sessionId, session);
  }

  getActiveCallSessions(): CallSessionEvent[] {
    return Array.from(this.callSessions.values()).filter(
      (s) => s.event_type === 'call_start' && !s.end_time
    );
  }

  getActiveCallForUser(msisdn: string): CallSessionEvent | undefined {
    return this.getActiveCallSessions().find((s) => s.msisdn === msisdn);
  }

  // Balance methods
  addBalanceUpdate(msisdn: string, update: BalanceUpdateEvent): void {
    if (!this.balanceSnapshots.has(msisdn)) {
      this.balanceSnapshots.set(msisdn, []);
    }
    this.balanceSnapshots.get(msisdn)!.push(update);
  }

  getLatestBalance(msisdn: string): BalanceUpdateEvent | undefined {
    const updates = this.balanceSnapshots.get(msisdn);
    if (!updates || updates.length === 0) return undefined;
    return updates[updates.length - 1];
  }

  getBalanceHistory(msisdn: string, limit: number = 50): BalanceUpdateEvent[] {
    const updates = this.balanceSnapshots.get(msisdn) || [];
    if (limit <= 0) {
      return [...updates];
    }
    return updates.slice(-limit);
  }

  // Top-up methods
  addTopUp(msisdn: string, topUp: TopUpEvent): void {
    if (!this.topUps.has(msisdn)) {
      this.topUps.set(msisdn, []);
    }
    this.topUps.get(msisdn)!.push(topUp);
  }

  getTopUps(msisdn: string): TopUpEvent[] {
    return this.topUps.get(msisdn) || [];
  }

  // Offer methods
  getOffer(offerId: string): Offer | undefined {
    return this.offers.get(offerId);
  }

  setOffer(offer: Offer): void {
    this.offers.set(offer.offer_id, offer);
  }

  getOffersByMsisdn(msisdn: string): Offer[] {
    return Array.from(this.offers.values()).filter((o) => o.msisdn === msisdn);
  }

  getActiveOfferForUser(msisdn: string): Offer | undefined {
    return Array.from(this.offers.values()).find(
      (o) =>
        o.msisdn === msisdn &&
        ['created', 'sms_sent', 'link_opened'].includes(o.status) &&
        o.expires_at > new Date()
    );
  }

  getAllOffers(): Offer[] {
    return Array.from(this.offers.values());
  }

  // Loan methods
  getLoan(loanId: string): Loan | undefined {
    return this.loans.get(loanId);
  }

  setLoan(loan: Loan): void {
    this.loans.set(loan.loan_id, loan);
  }

  getLoansByMsisdn(msisdn: string): Loan[] {
    return Array.from(this.loans.values()).filter((l) => l.msisdn === msisdn);
  }

  getActiveLoanForUser(msisdn: string): Loan | undefined {
    return Array.from(this.loans.values()).find(
      (l) => l.msisdn === msisdn && ['pending', 'disbursed'].includes(l.status)
    );
  }

  getAllLoans(): Loan[] {
    return Array.from(this.loans.values());
  }

  // Ledger methods
  addLedgerEvent(event: LedgerEvent): void {
    this.ledger.push(event);
  }

  getLedgerEvents(entityId?: string, entityType?: string): LedgerEvent[] {
    let events = [...this.ledger];
    if (entityId) {
      events = events.filter((e) => e.entity_id === entityId);
    }
    if (entityType) {
      events = events.filter((e) => e.entity_type === entityType);
    }
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // SMS methods
  addSmsMessage(message: SmsMessage): void {
    this.smsMessages.set(message.message_id, message);
  }

  getSmsMessage(messageId: string): SmsMessage | undefined {
    return this.smsMessages.get(messageId);
  }

  getSmsMessagesByMsisdn(msisdn: string): SmsMessage[] {
    return Array.from(this.smsMessages.values())
      .filter((m) => m.msisdn === msisdn)
      .sort((a, b) => {
        const timeA = a.sent_at?.getTime() || 0;
        const timeB = b.sent_at?.getTime() || 0;
        return timeB - timeA;
      });
  }

  getAllSmsMessages(): SmsMessage[] {
    return Array.from(this.smsMessages.values()).sort((a, b) => {
      const timeA = a.sent_at?.getTime() || 0;
      const timeB = b.sent_at?.getTime() || 0;
      return timeB - timeA;
    });
  }

  resetUserState(msisdn: string): void {
    this.callSessions.forEach((session, sessionId) => {
      if (session.msisdn === msisdn) {
        this.callSessions.delete(sessionId);
      }
    });

    this.balanceSnapshots.delete(msisdn);
    this.topUps.delete(msisdn);
    this.journeyEvents.delete(msisdn);

    this.offers.forEach((offer, offerId) => {
      if (offer.msisdn === msisdn) {
        this.offers.delete(offerId);
      }
    });

    this.loans.forEach((loan, loanId) => {
      if (loan.msisdn === msisdn) {
        this.loans.delete(loanId);
      }
    });

    this.smsMessages.forEach((message, messageId) => {
      if (message.msisdn === msisdn) {
        this.smsMessages.delete(messageId);
      }
    });

    this.ledger = this.ledger.filter((event) => event.payload?.msisdn !== msisdn);
  }

  // Model Decision methods
  setModelDecision(decision: ModelDecision): void {
    this.modelDecisions.set(decision.decision_id, decision);
  }

  getModelDecision(decisionId: string): ModelDecision | undefined {
    return this.modelDecisions.get(decisionId);
  }

  // Journey timeline methods
  addJourneyEvent(msisdn: string, event: JourneyEvent): void {
    if (!this.journeyEvents.has(msisdn)) {
      this.journeyEvents.set(msisdn, []);
    }
    this.journeyEvents.get(msisdn)!.push(event);
  }

  getJourneyEvents(msisdn: string, limit: number = 50): JourneyEvent[] {
    const events = this.journeyEvents.get(msisdn) || [];
    const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return sorted.slice(-limit);
  }

  // Clear all (for testing)
  clear(): void {
    this.users.clear();
    this.callSessions.clear();
    this.balanceSnapshots.clear();
    this.topUps.clear();
    this.offers.clear();
    this.loans.clear();
    this.ledger = [];
    this.smsMessages.clear();
    this.modelDecisions.clear();
    this.journeyEvents.clear();
  }
}

// Singleton instance
export const store = new InMemoryStore();
