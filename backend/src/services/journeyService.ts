/**
 * Journey Service
 * Maintains per-customer journey timelines that power cockpit UI
 */

import { v4 as uuidv4 } from 'uuid';
import type { JourneyEvent, JourneyEventType } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';

const DEFAULT_LABELS: Record<JourneyEventType, string> = {
  call_start: 'Call started',
  call_end: 'Call ended',
  balance_low: 'Balance low',
  offer_created: 'Offer generated',
  sms_sent: 'SMS sent',
  link_opened: 'Link opened',
  offer_accepted: 'Offer accepted',
  offer_declined: 'Offer declined',
  loan_disbursed: 'Loan disbursed',
  topup: 'Top-up detected',
  repayment_completed: 'Repayment completed',
};

export class JourneyService {
  recordEvent(msisdn: string, type: JourneyEventType, metadata: Record<string, any> = {}, label?: string): void {
    if (!msisdn) return;

    const event: JourneyEvent = {
      event_id: uuidv4(),
      msisdn,
      type,
      label: label || DEFAULT_LABELS[type] || type,
      timestamp: new Date(),
      metadata,
    };

    store.addJourneyEvent(msisdn, event);
  }

  ingestRealtimeEvent(event: { type: string; data: any }): void {
    const { type, data } = event;
    if (!data) return;

    switch (type) {
      case 'mno_event':
        this.handleMnoEvent(data);
        break;
      case 'low_balance_trigger':
        this.recordEvent(data.msisdn, 'balance_low', {
          session_id: data.session_id,
          balance: data.balance,
          threshold: data.threshold,
        });
        break;
      case 'offer_created':
        this.recordEvent(data.msisdn, 'offer_created', {
          amount: data.amount,
          offer_id: data.offer_id,
          status: data.status,
          reasons: data.reasons,
          context_reasons: data.context_reasons,
          benefit_estimate: data.benefit_estimate,
        });
        break;
      case 'sms_sent':
        this.recordEvent(data.msisdn, 'sms_sent', {
          offer_id: data.offer_id,
          message_id: data.message_id,
          preview: data.message,
        });
        break;
      case 'link_opened':
        this.recordEvent(data.msisdn, 'link_opened', {
          offer_id: data.offer_id,
          amount: data.amount,
          source: data.source || 'user',
        });
        break;
      case 'offer_accepted':
        this.recordEvent(data.msisdn, 'offer_accepted', {
          offer_id: data.offer_id,
          amount: data.amount,
          source: data.source || 'user',
        });
        break;
      case 'offer_declined':
        this.recordEvent(data.msisdn, 'offer_declined', {
          offer_id: data.offer_id,
          source: data.source || 'user',
        });
        break;
      case 'loan_disbursed':
        this.recordEvent(data.msisdn, 'loan_disbursed', {
          loan_id: data.loan_id,
          amount: data.amount,
          offer_id: data.offer_id,
          source: data.source || 'system',
        });
        break;
      case 'topup_processed':
        this.recordEvent(data.msisdn, 'topup', {
          amount: data.amount,
          channel: data.channel,
        });
        break;
      case 'repayment_completed':
        this.recordEvent(data.msisdn, 'repayment_completed', {
          loan_id: data.loan_id,
          amount: data.amount,
        });
        break;
      default:
        break;
    }
  }

  private handleMnoEvent(event: any): void {
    switch (event.event_type) {
      case 'call_start':
        this.recordEvent(event.msisdn, 'call_start', {
          session_id: event.session_id,
          region: event.region,
          cell_id: event.cell_id,
        });
        break;
      case 'call_end':
        this.recordEvent(event.msisdn, 'call_end', {
          session_id: event.session_id,
        });
        break;
      case 'topup':
        this.recordEvent(event.msisdn, 'topup', {
          amount: event.amount,
          channel: event.channel,
        });
        break;
      default:
        break;
    }
  }

  getTimeline(msisdn: string, limit = 50): JourneyEvent[] {
    return store.getJourneyEvents(msisdn, limit);
  }
}

export const journeyService = new JourneyService();
