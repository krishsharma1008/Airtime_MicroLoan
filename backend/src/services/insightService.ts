import { store } from '../store/inMemoryStore.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function daysAgo(date?: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / MS_IN_DAY));
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '$0';
  return `$${Number(value).toFixed(2)}`;
}

export function buildOfferContextReasons(msisdn: string): string[] {
  const user = store.getUser(msisdn);
  const loans = store.getLoansByMsisdn(msisdn);
  const repaidLoans = loans.filter((loan) => loan.status === 'repaid').length;
  const totalLoans = loans.length;
  const topUps = store.getTopUps(msisdn);
  const lastTopUp = topUps.length ? topUps[topUps.length - 1] : undefined;
  const lastTopUpDays = lastTopUp ? daysAgo(lastTopUp.timestamp) : null;
  const reasons: string[] = [];

  if (totalLoans > 0) {
    if (repaidLoans === totalLoans) {
      reasons.push(`Repaid ${repaidLoans}/${totalLoans} previous advances on time.`);
    } else {
      reasons.push(`Closed ${repaidLoans} of ${totalLoans} previous advances without issues.`);
    }
  } else {
    reasons.push('Pilot advance to build credit history with this subscriber.');
  }

  if (user) {
    reasons.push(
      `Average recharge ${formatCurrency(user.avg_topup_amount)} about ${user.topup_frequency_30d}x every 30 days.`,
    );
  }

  if (lastTopUp && lastTopUpDays !== null) {
    reasons.push(
      `Last top-up ${formatCurrency(lastTopUp.amount)} about ${lastTopUpDays}d ago (${lastTopUp.channel}).`,
    );
  }

  if (user && user.on_time_repay_rate >= 0.9) {
    reasons.push('No late repayments recorded in recent history.');
  }

  if (!store.getActiveLoanForUser(msisdn)) {
    reasons.push('No outstanding exposure today, so this amount fits within policy.');
  }

  return Array.from(new Set(reasons)).slice(0, 4);
}
