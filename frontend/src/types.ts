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
}


