/**
 * Repayment Service
 * Handles automatic repayment on next top-up
 */

import type { TopUpEvent, Loan } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';
import { ledgerService } from './ledgerService.js';

export class RepaymentService {
  /**
   * Process top-up and check for automatic repayment
   */
  processTopUp(topUp: TopUpEvent): void {
    const { msisdn } = topUp;

    // Find active loan for this user
    const activeLoan = store.getActiveLoanForUser(msisdn);
    if (!activeLoan || activeLoan.status !== 'disbursed') {
      return; // No active loan to repay
    }

    // Log top-up detected
    ledgerService.logEvent({
      type: 'topup_detected',
      entity_id: activeLoan.loan_id,
      entity_type: 'loan',
      payload: {
        msisdn,
        topup_amount: topUp.amount,
        loan_amount: activeLoan.amount,
      },
    });

    // Initiate repayment
    this.repayLoan(activeLoan, topUp.amount);
  }

  /**
   * Repay a loan automatically
   */
  private repayLoan(loan: Loan, topUpAmount: number): void {
    // Log repayment initiation
    ledgerService.logEvent({
      type: 'repayment_initiated',
      entity_id: loan.loan_id,
      entity_type: 'loan',
      payload: {
        msisdn: loan.msisdn,
        loan_amount: loan.amount,
        topup_amount: topUpAmount,
      },
    });

    // Deduct from top-up amount (simulated)
    // In real system, this would be handled by MNO charging system
    const remainingTopUp = topUpAmount - loan.amount;

    // Update loan status
    loan.repaid_at = new Date();
    loan.status = 'repaid';
    store.setLoan(loan);

    // Update balance (top-up minus repayment)
    const latestBalance = store.getLatestBalance(loan.msisdn);
    const currentBalance = latestBalance?.balance || 0;
    const newBalance = currentBalance + remainingTopUp; // Top-up already added, we just adjust

    const balanceUpdate = {
      event_type: 'balance_update' as const,
      msisdn: loan.msisdn,
      balance: newBalance,
      timestamp: new Date(),
      consumption_rate_per_min: 0.1,
    };

    store.addBalanceUpdate(loan.msisdn, balanceUpdate);

    // Log repayment completion
    ledgerService.logEvent({
      type: 'repayment_completed',
      entity_id: loan.loan_id,
      entity_type: 'loan',
      payload: {
        msisdn: loan.msisdn,
        loan_amount: loan.amount,
        repaid_at: loan.repaid_at,
      },
    });
  }
}

export const repaymentService = new RepaymentService();


