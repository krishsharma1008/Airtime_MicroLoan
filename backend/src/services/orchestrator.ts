/**
 * Orchestrator Service
 * Wires together all services to handle the end-to-end flow
 */

import type { MnoEvent, LowBalanceTriggerEvent } from '../types/schemas.js';
import { simulator } from './mnoEventSimulator.js';
import { triggerService } from './triggerService.js';
import { offerService } from './offerService.js';
import { smsGateway } from './smsGateway.js';
import { disbursalService } from './disbursalService.js';
import { repaymentService } from './repaymentService.js';
import { store } from '../store/inMemoryStore.js';

export class Orchestrator {
  private eventCallbacks: ((event: any) => void)[] = [];

  /**
   * Register callback for real-time events (for WebSocket)
   */
  onEvent(callback: (event: any) => void): void {
    this.eventCallbacks.push(callback);
  }

  private emitEvent(event: any): void {
    this.eventCallbacks.forEach((cb) => cb(event));
  }

  /**
   * Initialize the orchestrator and wire up event handlers
   */
  initialize(): void {
    // Wire MNO simulator events
    simulator.onEvent((event: MnoEvent) => {
      this.emitEvent({ type: 'mno_event', data: event });

      // Handle balance updates
      if (event.event_type === 'balance_update') {
        triggerService.checkBalanceUpdate(event);
      }

      // Handle top-ups
      if (event.event_type === 'topup') {
        repaymentService.processTopUp(event);
        this.emitEvent({ type: 'topup_processed', data: event });
      }
    });

    // Wire trigger service
    triggerService.onTrigger((trigger: LowBalanceTriggerEvent) => {
      this.emitEvent({ type: 'low_balance_trigger', data: trigger });

      // Create offer
      const offer = offerService.createOffer(trigger.msisdn, trigger.session_id);
      if (offer) {
        this.emitEvent({ type: 'offer_created', data: offer });

        // Send SMS
        const sms = smsGateway.sendOfferSms(offer);
        this.emitEvent({ type: 'sms_sent', data: sms });
      } else {
        this.emitEvent({ type: 'offer_not_created', data: { msisdn: trigger.msisdn, reason: 'not_eligible' } });
      }
    });
  }

  /**
   * Start a call simulation for a user
   */
  startCall(msisdn: string): string {
    return simulator.startCall(msisdn);
  }

  /**
   * End a call
   */
  endCall(sessionId: string): void {
    simulator.endCall(sessionId);
  }

  /**
   * Simulate a top-up
   */
  simulateTopUp(msisdn: string, amount: number, channel: 'online' | 'retail' | 'ussd' | 'app' = 'online'): void {
    simulator.simulateTopUp(msisdn, amount, channel);
  }

  /**
   * Handle consent (accept/decline)
   */
  handleConsent(token: string, action: 'accept' | 'decline'): { success: boolean; loanId?: string; message: string } {
    const offer = offerService.getOfferByToken(token);
    if (!offer) {
      return { success: false, message: 'Offer not found or expired' };
    }

    if (action === 'accept') {
      const accepted = offerService.acceptOffer(offer.offer_id);
      if (!accepted) {
        return { success: false, message: 'Unable to accept offer' };
      }

      this.emitEvent({ type: 'offer_accepted', data: offer });

      // Disburse loan
      const loan = disbursalService.disburseLoan(offer);
      if (loan) {
        this.emitEvent({ type: 'loan_disbursed', data: loan });
        return { success: true, loanId: loan.loan_id, message: 'Loan disbursed successfully' };
      } else {
        return { success: false, message: 'Disbursal failed' };
      }
    } else {
      const declined = offerService.declineOffer(offer.offer_id);
      if (declined) {
        this.emitEvent({ type: 'offer_declined', data: offer });
        return { success: true, message: 'Offer declined' };
      } else {
        return { success: false, message: 'Unable to decline offer' };
      }
    }
  }

  /**
   * Mark link as opened (user clicked SMS link)
   */
  markLinkOpened(token: string): void {
    const offer = offerService.getOfferByToken(token);
    if (offer) {
      offerService.markLinkOpened(offer.offer_id);
      this.emitEvent({ type: 'link_opened', data: offer });
    }
  }
}

export const orchestrator = new Orchestrator();


