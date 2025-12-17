// Frontend type definitions (simplified from backend schemas)

export interface Offer {
  offer_id: string
  msisdn: string
  session_id: string
  amount: number
  status: string
  created_at: string
  expires_at: string
  reasons: string[]
  model_decision_id: string
  consent_token?: string
  benefit_estimate?: {
    voice_minutes?: number
    data_days?: number
  }
  context_reasons?: string[]
}

export interface Loan {
  loan_id: string
  offer_id: string
  msisdn: string
  amount: number
  disbursed_at?: string
  repaid_at?: string
  repayment_method: string
  status: string
}

export interface LedgerEvent {
  event_id: string
  type: string
  entity_id: string
  entity_type: string
  timestamp: string
  payload: any
}

export interface JourneyEvent {
  event_id: string
  msisdn: string
  type:
    | 'call_start'
    | 'call_end'
    | 'balance_low'
    | 'offer_created'
    | 'sms_sent'
    | 'link_opened'
    | 'offer_accepted'
    | 'offer_declined'
    | 'loan_disbursed'
    | 'topup'
    | 'repayment_completed'
  label: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface BalanceHistoryPoint {
  event_type: 'balance_update'
  msisdn: string
  session_id?: string
  balance: number
  timestamp: string
  consumption_rate_per_min: number
}

export interface ModelDecision {
  decision_id: string
  model_name: string
  model_version: string
  timestamp: string
  msisdn: string
  outputs: {
    p_repay: number
    confidence: number
    recommended_limit: number
  }
  contributions: Array<{
    feature_name: string
    contribution: number
    importance: number
  }>
}

export interface Persona {
  name: string
  msisdn: string
  profile: any
}

export interface CallSession {
  event_type: 'call_start' | 'call_end'
  session_id: string
  msisdn: string
  start_time: string
  end_time?: string
  cell_id?: string
  region?: string
}

export interface TopUpEvent {
  event_type: 'topup'
  msisdn: string
  amount: number
  timestamp: string
  channel: 'online' | 'retail' | 'ussd' | 'app'
  transaction_id?: string
}

export interface SmsMessage {
  message_id: string
  msisdn: string
  message: string
  offer_id?: string
  sent_at?: string
  delivered: boolean
  delivery_failed: boolean
}

export interface KPIs {
  offers: {
    total: number
    accepted: number
    declined: number
    acceptance_rate: number
  }
  loans: {
    total: number
    active: number
    repaid: number
    repayment_rate: number
  }
  sms: {
    total: number
    delivered: number
    delivery_rate: number
  }
  metrics: {
    avg_time_to_consent_seconds: number
  }
  company?: {
    total_customers: number
    active_customers: number
    offers_today: number
    active_exposure: number
    acceptance_rate: number
    repayment_rate: number
  }
}

export interface CustomerSummary {
  persona: string
  label: string
  msisdn: string
  profile: any
  stats: {
    totalLoans: number
    activeLoans: number
    totalOffers: number
    offersToday: number
    acceptanceRate: number
    repaymentRate: number
    totalExposure: number
    avgLoanAmount: number
  }
  behavior: {
    tenureDays: number
    avgTopupAmount: number
    topupFrequency: number
    riskTier: 'low' | 'medium' | 'high'
  }
  state: {
    value: 'on_call' | 'offer_pending' | 'loan_active' | 'repaid' | 'idle'
    label: string
    hint: string
  }
  balance: {
    latest: number
    previous: number | null
    change: number
    lastUpdated?: string
  }
  activity: {
    lastOfferAt?: string
    lastTopUpAt?: string
    lastLoanAt?: string
  }
  activeCall?: CallSession
  activeOffer?: Offer
  activeLoan?: Loan
}

export interface UserSnapshot {
  user: any
  balance: number
  balanceHistory: BalanceHistoryPoint[]
  activeCall?: CallSession
  activeOffer?: Offer
  activeLoan?: Loan
  loans: Loan[]
  offers: Offer[]
  topUps: TopUpEvent[]
  smsMessages: SmsMessage[]
  timeline: JourneyEvent[]
}
