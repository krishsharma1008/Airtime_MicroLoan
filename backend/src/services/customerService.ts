import { PERSONAS } from '../data/personas.js';
import { store } from '../store/inMemoryStore.js';
import type {
  UserProfile,
  Offer,
  Loan,
  BalanceUpdateEvent,
} from '../types/schemas.js';

type StateValue = 'on_call' | 'offer_pending' | 'loan_active' | 'repaid' | 'idle';

export interface CustomerSummary {
  persona: string;
  label: string;
  msisdn: string;
  profile: UserProfile;
  stats: {
    totalLoans: number;
    activeLoans: number;
    totalOffers: number;
    offersToday: number;
    acceptanceRate: number;
    repaymentRate: number;
    totalExposure: number;
    avgLoanAmount: number;
  };
  behavior: {
    tenureDays: number;
    avgTopupAmount: number;
    topupFrequency: number;
    riskTier: 'low' | 'medium' | 'high';
  };
  state: {
    value: StateValue;
    label: string;
    hint: string;
  };
  balance: {
    latest: number;
    previous: number | null;
    change: number;
    lastUpdated?: Date;
  };
  activity: {
    lastOfferAt?: Date;
    lastTopUpAt?: Date;
    lastLoanAt?: Date;
  };
  activeCall?: ReturnType<typeof store.getActiveCallForUser>;
  activeOffer?: Offer | undefined;
  activeLoan?: Loan | undefined;
}

class CustomerService {
  getCustomerSummaries(): CustomerSummary[] {
    const personas = Object.entries(PERSONAS);
    return personas
      .map(([personaKey, profile]) => this.buildSummary(personaKey, profile.msisdn))
      .filter((summary): summary is CustomerSummary => summary !== null);
  }

  getCustomerSummary(msisdn: string): CustomerSummary | null {
    const personaEntry = Object.entries(PERSONAS).find(
      ([, profile]) => profile.msisdn === msisdn
    );
    if (!personaEntry) {
      return null;
    }
    return this.buildSummary(personaEntry[0], msisdn);
  }

  private buildSummary(personaKey: string, msisdn: string): CustomerSummary | null {
    const profile = store.getUser(msisdn) || PERSONAS[personaKey];
    if (!profile) {
      return null;
    }

    const offers = store.getOffersByMsisdn(msisdn);
    const loans = store.getLoansByMsisdn(msisdn);
    const balanceHistory = store.getBalanceHistory(msisdn, 25);
    const activeCall = store.getActiveCallForUser(msisdn);
    const activeOffer = store.getActiveOfferForUser(msisdn);
    const activeLoan = store.getActiveLoanForUser(msisdn);
    const topUps = store.getTopUps(msisdn);

    const acceptedOffers = offers.filter((o) =>
      ['accepted', 'disbursed'].includes(o.status)
    );
    const repaidLoans = loans.filter((l) => l.status === 'repaid');
    const activeLoans = loans.filter((l) => ['pending', 'disbursed'].includes(l.status));

    const acceptanceRate = offers.length > 0 ? acceptedOffers.length / offers.length : 0;
    const repaymentRate = loans.length > 0 ? repaidLoans.length / loans.length : 0;
    const totalExposure = activeLoans.reduce((sum, loan) => sum + loan.amount, 0);
    const avgLoanAmount =
      loans.length > 0 ? loans.reduce((sum, loan) => sum + loan.amount, 0) / loans.length : 0;
    const offersToday = offers.filter(
      (offer) => Date.now() - offer.created_at.getTime() < 24 * 60 * 60 * 1000
    ).length;

    const lastOfferAt = this.getLatestDate(offers.map((o) => o.created_at));
    const lastLoanAt = this.getLatestDate(
      loans.map((l) => l.disbursed_at || l.repaid_at || undefined)
    );
    const lastTopUpAt = this.getLatestDate(topUps.map((t) => t.timestamp));

    const latestBalance = this.getLatestBalance(balanceHistory);
    const previousBalance = this.getPreviousBalance(balanceHistory);

    return {
      persona: personaKey,
      label: this.formatPersonaLabel(personaKey),
      msisdn,
      profile,
      stats: {
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        totalOffers: offers.length,
        offersToday,
        acceptanceRate,
        repaymentRate,
        totalExposure,
        avgLoanAmount,
      },
      behavior: {
        tenureDays: profile.tenure_days,
        avgTopupAmount: profile.avg_topup_amount,
        topupFrequency: profile.topup_frequency_30d,
        riskTier: this.getRiskTier(profile),
      },
      state: this.deriveState(activeCall, activeOffer, activeLoan, repaidLoans.length > 0),
      balance: {
        latest: latestBalance?.balance || 0,
        previous: previousBalance?.balance ?? null,
        change: this.calculateBalanceDelta(latestBalance, previousBalance),
        lastUpdated: latestBalance?.timestamp,
      },
      activity: {
        lastOfferAt,
        lastLoanAt,
        lastTopUpAt,
      },
      activeCall,
      activeOffer,
      activeLoan,
    };
  }

  private formatPersonaLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private getRiskTier(profile: UserProfile): 'low' | 'medium' | 'high' {
    if (profile.on_time_repay_rate >= 0.9) return 'low';
    if (profile.on_time_repay_rate >= 0.7) return 'medium';
    return 'high';
  }

  private getLatestDate(dates: Array<Date | undefined>): Date | undefined {
    const filtered = dates.filter((date): date is Date => Boolean(date));
    if (!filtered.length) {
      return undefined;
    }
    return filtered.sort((a, b) => b.getTime() - a.getTime())[0];
  }

  private getLatestBalance(history: BalanceUpdateEvent[]): BalanceUpdateEvent | undefined {
    if (!history.length) return undefined;
    return history[history.length - 1];
  }

  private getPreviousBalance(history: BalanceUpdateEvent[]): BalanceUpdateEvent | undefined {
    if (history.length < 2) return undefined;
    return history[history.length - 2];
  }

  private calculateBalanceDelta(
    latest?: BalanceUpdateEvent,
    previous?: BalanceUpdateEvent
  ): number {
    if (!latest || !previous) return 0;
    return latest.balance - previous.balance;
  }

  private deriveState(
    activeCall: ReturnType<typeof store.getActiveCallForUser>,
    activeOffer: Offer | undefined,
    activeLoan: Loan | undefined,
    hasRepaid: boolean
  ): { value: StateValue; label: string; hint: string } {
    if (activeCall) {
      return {
        value: 'on_call',
        label: 'On call',
        hint: 'Live session in progress',
      };
    }
    if (activeOffer) {
      return {
        value: 'offer_pending',
        label: 'Offer pending',
        hint: `Awaiting consent for $${activeOffer.amount}`,
      };
    }
    if (activeLoan) {
      return {
        value: 'loan_active',
        label: 'Loan active',
        hint: `Outstanding $${activeLoan.amount}`,
      };
    }
    if (hasRepaid) {
      return {
        value: 'repaid',
        label: 'Repaid',
        hint: 'Last loan closed',
      };
    }
    return {
      value: 'idle',
      label: 'Idle',
      hint: 'No active engagement',
    };
  }
}

export const customerService = new CustomerService();
