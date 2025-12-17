/**
 * Disbursal Service
 * Simulates applying airtime credit to user's account
 */

import { v4 as uuidv4 } from 'uuid';
import type { Loan, Offer } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';
import { ledgerService } from './ledgerService.js';
import { offerService } from './offerService.js';

export class DisbursalService {
  /**
   * Disburse loan (apply airtime credit)
   */
  disburseLoan(offer: Offer): Loan | null {
    if (offer.status !== 'accepted') {
      return null; // Can only disburse accepted offers
    }

    // Create loan
    const loan: Loan = {
      loan_id: uuidv4(),
      offer_id: offer.offer_id,
      msisdn: offer.msisdn,
      amount: offer.amount,
      repayment_method: 'next_topup',
      status: 'pending',
      disbursed_at: undefined,
      repaid_at: undefined,
    };

    store.setLoan(loan);

    // Log disbursal initiation
    ledgerService.logEvent({
      type: 'disbursal_initiated',
      entity_id: loan.loan_id,
      entity_type: 'loan',
      payload: {
        msisdn: offer.msisdn,
        amount: offer.amount,
        offer_id: offer.offer_id,
      },
    });

    // Simulate MNO disbursal (apply airtime credit)
    this.applyAirtimeCredit(offer.msisdn, offer.amount);

    // Update loan status
    loan.disbursed_at = new Date();
    loan.status = 'disbursed';
    store.setLoan(loan);

    // Update offer status
    offerService.updateOfferStatus(offer.offer_id, 'disbursed');

    // Log disbursal completion
    ledgerService.logEvent({
      type: 'disbursal_completed',
      entity_id: loan.loan_id,
      entity_type: 'loan',
      payload: {
        msisdn: offer.msisdn,
        amount: offer.amount,
      },
    });

    return loan;
  }

  /**
   * Apply airtime credit to user's balance (simulated)
   */
  private applyAirtimeCredit(msisdn: string, amount: number): void {
    // Get current balance
    const latestBalance = store.getLatestBalance(msisdn);
    const currentBalance = latestBalance?.balance || 0;

    // Add credit
    const newBalance = currentBalance + amount;

    // Create balance update event
    const balanceUpdate = {
      event_type: 'balance_update' as const,
      msisdn,
      balance: newBalance,
      timestamp: new Date(),
      consumption_rate_per_min: 0.1,
    };

    store.addBalanceUpdate(msisdn, balanceUpdate);
  }
}

export const disbursalService = new DisbursalService();


