import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  Play,
  Pause,
  RefreshCw,
  Activity,
  Users,
  ArrowUpRight,
  PhoneCall,
  Sparkles,
  ShieldCheck,
  LineChart,
  Clock,
  AlertTriangle,
  MessageSquare,
  CircleDot,
  DollarSign,
  History,
} from 'lucide-react'
import type {
  BalanceHistoryPoint,
  CustomerSummary,
  JourneyEvent,
  KPIs,
  LedgerEvent,
  Offer,
  UserSnapshot,
} from '../types'

type TimelineStepStatus = 'done' | 'current' | 'pending'

const TIMELINE_STEPS = [
  { id: 'call_start', label: 'Call start', types: ['call_start'], tone: 'info' as const },
  { id: 'balance_low', label: 'Balance low', types: ['balance_low'], tone: 'warning' as const },
  { id: 'offer_created', label: 'Offer created', types: ['offer_created'], tone: 'info' as const },
  { id: 'sms_sent', label: 'SMS sent', types: ['sms_sent'], tone: 'info' as const },
  { id: 'link_opened', label: 'Link opened', types: ['link_opened'], tone: 'info' as const },
  { id: 'decision', label: 'Accepted / Declined', types: ['offer_accepted', 'offer_declined'], tone: 'decision' as const },
  { id: 'loan_disbursed', label: 'Disbursed', types: ['loan_disbursed'], tone: 'success' as const },
  { id: 'topup', label: 'Top-up', types: ['topup'], tone: 'info' as const },
  { id: 'repayment_completed', label: 'Repaid', types: ['repayment_completed'], tone: 'success' as const },
]

const TIMELINE_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  call_start: PhoneCall,
  balance_low: AlertTriangle,
  offer_created: Sparkles,
  sms_sent: MessageSquare,
  link_opened: CircleDot,
  decision: ShieldCheck,
  loan_disbursed: DollarSign,
  topup: RefreshCw,
  repayment_completed: History,
}

const EVENT_STEP_LOOKUP: Record<string, string> = {
  call_start: 'call_start',
  balance_low: 'balance_low',
  low_balance_trigger: 'balance_low',
  offer_created: 'offer_created',
  sms_sent: 'sms_sent',
  link_opened: 'link_opened',
  offer_accepted: 'decision',
  offer_declined: 'decision',
  loan_disbursed: 'loan_disbursed',
  topup_processed: 'topup',
  topup: 'topup',
  repayment_completed: 'repayment_completed',
}

const stateChipClasses: Record<string, string> = {
  on_call: 'bg-amber-200/20 text-amber-200 border border-amber-200/30',
  offer_pending: 'bg-orange-200/20 text-orange-100 border border-orange-200/30',
  loan_active: 'bg-indigo-200/20 text-indigo-100 border border-indigo-200/30',
  repaid: 'bg-emerald-200/20 text-emerald-100 border border-emerald-200/30',
  idle: 'bg-slate-200/10 text-slate-200 border border-slate-200/20',
}

const riskStyles: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40',
  medium: 'bg-amber-500/10 text-amber-200 border border-amber-500/40',
  high: 'bg-rose-500/10 text-rose-200 border border-rose-500/40',
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const formatCurrency = (value: number) => currencyFormatter.format(value || 0)
const formatCompactCurrency = (value: number) => compactCurrencyFormatter.format(value || 0)
const formatPercent = (value: number) => `${Math.round((value || 0) * 100)}%`

const cn = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

const formatRelativeTime = (iso?: string) => {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const formatTime = (iso?: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString()
}

const formatMetadataValue = (value: any): string => {
  if (value === null || value === undefined) return '—'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).join(', ')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${formatMetadataValue(val)}`)
      .join(', ')
  }
  return String(value)
}

interface TimelineStepData {
  id: string
  label: string
  status: TimelineStepStatus
  timestamp?: string
  tone: 'info' | 'warning' | 'decision' | 'success'
  eventType?: string
  event?: JourneyEvent
}

interface BalanceTrendGraphProps {
  history: BalanceHistoryPoint[]
  markers: {
    offer?: string
    disbursement?: string
    repayment?: string
  }
}

function BalanceTrendGraph({ history, markers }: BalanceTrendGraphProps) {
  if (!history?.length) {
    return (
      <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
        <p className="text-sm text-slate-400">No balance data yet.</p>
      </div>
    )
  }

  const points = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
  const values = points.map((p) => p.balance)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const svgPoints =
    points.length === 1
      ? ['0,50', '100,50']
      : points.map((point, idx) => {
          const x = (idx / (points.length - 1 || 1)) * 100
          const normalized = ((point.balance - min) / range) * 100
          const y = 100 - normalized
          return `${x},${y}`
        })

  const start = new Date(points[0].timestamp).getTime()
  const end = new Date(points[points.length - 1].timestamp).getTime() || Date.now()
  const markerPositions = Object.entries(markers)
    .map(([key, iso]) => {
      if (!iso) return null
      const ts = new Date(iso).getTime()
      if (ts < start || ts > end) return null
      const ratio = (ts - start) / (end - start || 1)
      return { key, x: ratio * 100 }
    })
    .filter(Boolean) as Array<{ key: string; x: number }>

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/40 to-slate-900/10 p-6">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <div>
          <p className="text-slate-200 font-medium">Balance trend</p>
          <p>
            Last update{' '}
            {points[points.length - 1]?.timestamp ? formatRelativeTime(points[points.length - 1].timestamp) : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs uppercase">Current balance</p>
          <p className="text-xl font-semibold text-white">{formatCurrency(points[points.length - 1].balance)}</p>
        </div>
      </div>
      <div className="mt-4 h-36 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="balanceLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <polyline
            points={svgPoints.join(' ')}
            fill="none"
            stroke="url(#balanceLine)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {markerPositions.map((marker) => (
            <line
              key={marker.key}
              x1={marker.x}
              x2={marker.x}
              y1={5}
              y2={95}
              stroke={
                marker.key === 'repayment'
                  ? '#34d399'
                  : marker.key === 'disbursement'
                    ? '#818cf8'
                    : '#fbbf24'
              }
              strokeWidth="0.7"
              strokeDasharray="2 4"
            />
          ))}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-6 rounded-full bg-emerald-400" />
          Balance level
        </div>
        {markerPositions.map((marker) => (
          <div key={marker.key} className="flex items-center gap-2 capitalize">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                marker.key === 'repayment'
                  ? 'bg-emerald-400'
                  : marker.key === 'disbursement'
                    ? 'bg-indigo-400'
                    : 'bg-amber-300',
              )}
            />
            {marker.key}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CockpitScreen() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [selectedMsisdn, setSelectedMsisdn] = useState<string | null>(null)
  const [selectedSummary, setSelectedSummary] = useState<CustomerSummary | null>(null)
  const [snapshot, setSnapshot] = useState<UserSnapshot | null>(null)
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'offers' | 'explainability' | 'audit'>('overview')
  const [explainPayload, setExplainPayload] = useState<any | null>(null)
  const [explainOffer, setExplainOffer] = useState<Offer | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [highlightStep, setHighlightStep] = useState<string | null>(null)
  const [selectedJourneyEvent, setSelectedJourneyEvent] = useState<JourneyEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const selectedRef = useRef<string | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    loadCustomers()
    loadKPIs()

    const ws = new WebSocket(`ws://${window.location.hostname}:3001/ws`)
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      handleRealtimeEvent(payload)
    }
    wsRef.current = ws

    const poll = setInterval(() => {
      loadCustomers()
      loadKPIs()
      if (selectedRef.current) {
        loadCustomerDetail(selectedRef.current, false)
        loadLedger(selectedRef.current)
      }
    }, 10000)

    return () => {
      ws.close()
      clearInterval(poll)
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    selectedRef.current = selectedMsisdn
  }, [selectedMsisdn])

  useEffect(() => {
    if (!selectedMsisdn) return
    loadCustomerDetail(selectedMsisdn)
    loadLedger(selectedMsisdn)
    setActiveTab('overview')
  }, [selectedMsisdn])

  useEffect(() => {
    if (!snapshot) {
      setExplainPayload(null)
      setExplainOffer(null)
      return
    }
    const sortedOffers = [...(snapshot.offers || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    if (sortedOffers.length > 0) {
      loadExplainability(sortedOffers[0], true)
    } else {
      setExplainPayload(null)
      setExplainOffer(null)
    }
  }, [snapshot?.user?.msisdn])

  const loadCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      const fetchedCustomers: CustomerSummary[] = data.customers || []
      setCustomers(fetchedCustomers)
      if (fetchedCustomers.length) {
        setSelectedMsisdn((current) => {
          if (current && fetchedCustomers.some((c) => c.msisdn === current)) {
            return current
          }
          return fetchedCustomers[0].msisdn
        })
      }
    } catch (err) {
      console.error('Failed to load customers', err)
    }
  }

  const loadCustomerDetail = async (msisdn: string, withSpinner = true) => {
    if (withSpinner) {
      setLoadingDetail(true)
    }
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(msisdn)}`)
      const data = await res.json()
      setSelectedSummary(data.summary)
      setSnapshot(data.detail)
    } catch (err) {
      console.error('Failed to load customer detail', err)
    } finally {
      if (withSpinner) {
        setLoadingDetail(false)
      }
    }
  }

  const loadLedger = async (msisdn: string) => {
    try {
      const res = await fetch(`/api/ledger?msisdn=${encodeURIComponent(msisdn)}&limit=50`)
      const data = await res.json()
      setLedgerEvents(data.events || [])
    } catch (err) {
      console.error('Failed to load ledger', err)
    }
  }

  const loadKPIs = async () => {
    try {
      const res = await fetch('/api/kpis')
      const data = await res.json()
      setKpis(data)
    } catch (err) {
      console.error('Failed to load KPIs', err)
    }
  }

  const triggerHighlight = (stepId: string) => {
    setHighlightStep(stepId)
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current)
    }
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightStep(null), 2000)
  }

  const handleRealtimeEvent = (event: any) => {
    loadCustomers()
    loadKPIs()

    let msisdn = event.data?.msisdn
    let eventType = event.type

    if (event.type === 'mno_event') {
      eventType = event.data?.event_type
      msisdn = event.data?.msisdn
    }

    const stepId = EVENT_STEP_LOOKUP[eventType]

    if (msisdn && selectedRef.current && msisdn === selectedRef.current) {
      loadCustomerDetail(msisdn, false)
      loadLedger(msisdn)
      if (stepId) {
        triggerHighlight(stepId)
      }
    }
  }

  const startCall = async () => {
    if (!selectedMsisdn) return
    try {
      await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: selectedMsisdn }),
      })
    } catch (err) {
      console.error('Failed to start call', err)
    }
  }

  const endCall = async () => {
    if (!snapshot?.activeCall?.session_id) return
    try {
      await fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: snapshot.activeCall.session_id }),
      })
    } catch (err) {
      console.error('Failed to end call', err)
    }
  }

  const simulateTopUp = async (amount: number) => {
    if (!selectedMsisdn) return
    try {
      await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: selectedMsisdn, amount }),
      })
    } catch (err) {
      console.error('Failed to simulate top-up', err)
    }
  }

  const loadExplainability = async (offer: Offer, silent = false) => {
    if (!offer) return
    if (explainOffer?.offer_id === offer.offer_id && explainPayload && silent) return
    if (!silent) {
      setExplainLoading(true)
    }
    try {
      const res = await fetch(`/api/offers/${offer.offer_id}/explain`)
      const data = await res.json()
      setExplainPayload(data)
      setExplainOffer(offer)
    } catch (err) {
      console.error('Failed to load explainability', err)
    } finally {
      if (!silent) {
        setExplainLoading(false)
      }
    }
  }

  const timeline = snapshot?.timeline || []

  useEffect(() => {
    if (!timeline.length) {
      setSelectedJourneyEvent(null)
      return
    }
    setSelectedJourneyEvent((prev: JourneyEvent | null) => {
      if (!prev) return timeline[timeline.length - 1]
      const stillExists = timeline.some((event) => event.event_id === prev.event_id)
      return stillExists ? prev : timeline[timeline.length - 1]
    })
  }, [timeline])

  const timelineSteps: TimelineStepData[] = useMemo(() => {
    const stepsWithEvents = TIMELINE_STEPS.map((step) => {
      const event = [...timeline]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .find((item) => step.types.includes(item.type))

      return {
        ...step,
        event,
      }
    })

    const firstPendingIndex = stepsWithEvents.findIndex((step) => !step.event)

    return stepsWithEvents.map((step, index) => {
      let status: TimelineStepStatus = 'pending'
      if (step.event) {
        status = 'done'
      } else if (firstPendingIndex === -1 && index === stepsWithEvents.length - 1) {
        status = 'done'
      } else if (index === firstPendingIndex) {
        status = 'current'
      }

      return {
        id: step.id,
        label: step.label,
        status,
        tone: step.tone,
        eventType: step.event?.type,
        timestamp: step.event?.timestamp,
        event: step.event,
      }
    })
  }, [timeline])

  const balanceMarkers = useMemo(() => {
    const offer = timeline.find((event) => event.type === 'offer_created')
    const disbursement = timeline.find((event) => event.type === 'loan_disbursed')
    const repayment = timeline.find((event) => event.type === 'repayment_completed')

    return {
      offer: offer?.timestamp,
      disbursement: disbursement?.timestamp,
      repayment: repayment?.timestamp,
    }
  }, [timeline])

  const selectedEventMetadata: Record<string, any> = selectedJourneyEvent?.metadata ?? {}
  const selectedEventReasons = Array.isArray(selectedEventMetadata.reasons)
    ? selectedEventMetadata.reasons
    : []
  const selectedEventContextReasons = Array.isArray(selectedEventMetadata.context_reasons)
    ? selectedEventMetadata.context_reasons
    : []
  const selectedEventMetadataEntries = Object.entries(selectedEventMetadata).filter(([key, value]) => {
    return key !== 'reasons' && key !== 'context_reasons' && value !== undefined
  })

  const primaryStatusMessage = useMemo(() => {
    if (!selectedSummary) return 'Select a customer to view their journey.'
    switch (selectedSummary.state.value) {
      case 'on_call':
        return 'Customer is currently on a live call and balance is being monitored.'
      case 'offer_pending':
        return 'Offer is awaiting consent — watch for SMS engagement.'
      case 'loan_active':
        return 'Loan is active and exposure is accruing until next top-up.'
      case 'repaid':
        return 'Loan was repaid on the last top-up — customer is eligible again.'
      default:
        return 'Customer is idle with no active offer or loan.'
    }
  }, [selectedSummary])

  const kpiCards = kpis?.company
    ? [
        {
          label: 'Active customers',
          value: kpis.company.active_customers || kpis.company.total_customers,
          sub: `${kpis.company.total_customers} total`,
          icon: Users,
        },
        {
          label: 'Offers today',
          value: kpis.company.offers_today,
          sub: 'last 24h',
          icon: Sparkles,
        },
        {
          label: 'Acceptance rate',
          value: formatPercent(kpis.company.acceptance_rate),
          sub: `${kpis.offers.total} offers`,
          icon: ArrowUpRight,
        },
        {
          label: 'Active exposure',
          value: formatCompactCurrency(kpis.company.active_exposure),
          sub: 'outstanding',
          icon: LineChart,
        },
        {
          label: 'Repayment rate',
          value: formatPercent(kpis.company.repayment_rate),
          sub: `${kpis.loans.total} loans`,
          icon: ShieldCheck,
        },
      ]
    : []

  const offersSorted = useMemo(() => {
    if (!snapshot?.offers) return []
    return [...snapshot.offers].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [snapshot?.offers])

  const currentOffer =
    snapshot?.activeOffer ||
    offersSorted.find((offer) => ['created', 'sms_sent', 'link_opened'].includes(offer.status)) ||
    offersSorted[0]
  const currentHistoryReasons = currentOffer?.context_reasons || []
  const currentModelReasons = currentOffer?.reasons || []

  const loansSorted = useMemo(() => {
    if (!snapshot?.loans) return []
    return [...snapshot.loans].sort(
      (a, b) =>
        new Date(b.disbursed_at || b.repaid_at || '').getTime() -
        new Date(a.disbursed_at || a.repaid_at || '').getTime(),
    )
  }, [snapshot?.loans])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Micro-loan cockpit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Company dashboard & live customer journeys
            </h1>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <Activity className="h-4 w-4 text-emerald-400" />
            Live orchestrator link
          </div>
        </header>

        {kpiCards.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {kpiCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/0 p-4"
              >
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{card.label}</span>
                  <card.icon className="h-4 w-4 text-slate-300" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                <p className="text-sm text-slate-500">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
          <section className="space-y-4 rounded-3xl border border-white/5 bg-white/5 p-4 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Customer roster</p>
              <p className="mt-1 text-lg font-semibold">Personas & live states</p>
            </div>
            <div className="space-y-3">
              {customers.map((customer, index) => (
                <button
                  key={customer.msisdn}
                  onClick={() => setSelectedMsisdn(customer.msisdn)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition',
                    selectedMsisdn === customer.msisdn
                      ? 'border-white/40 bg-white/10 shadow-lg shadow-primary/10'
                      : 'border-white/5 bg-white/0 hover:border-white/20',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{customer.label}</p>
                      <p className="text-xs text-slate-400">{customer.msisdn}</p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-xs font-medium', stateChipClasses[customer.state.value])}>
                      {customer.state.label}
                    </span>
                  </div>
                  {index === 0 && (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.4em] text-primary-200">
                      Spotlight
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400">Loans</p>
                      <p className="text-base font-semibold">{customer.stats.totalLoans}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Acceptance</p>
                      <p className="text-base font-semibold">{formatPercent(customer.stats.acceptanceRate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Exposure</p>
                      <p className="text-base font-semibold">{formatCompactCurrency(customer.stats.totalExposure)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span className={cn('rounded-full px-2 py-0.5', riskStyles[customer.behavior.riskTier])}>
                      {customer.behavior.riskTier.toUpperCase()} RISK
                    </span>
                    <span>Last top-up {formatRelativeTime(customer.activity.lastTopUpAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Spotlight journey</p>
                  <p className="text-2xl font-semibold">
                    {selectedSummary?.label || 'Select a customer'}
                  </p>
                  <p className="text-sm text-slate-300">{selectedSummary?.msisdn}</p>
                </div>
                <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                    <p>Balance</p>
                    <p className="text-xl font-semibold text-white">
                      {snapshot ? formatCurrency(snapshot.balance) : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                    <p>Outstanding exposure</p>
                    <p className="text-xl font-semibold text-white">
                      {selectedSummary ? formatCurrency(selectedSummary.stats.totalExposure) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Status</p>
                <p className="mt-2 text-lg font-semibold">{primaryStatusMessage}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {snapshot?.activeCall ? (
                  <button
                    onClick={endCall}
                    className="flex items-center gap-2 rounded-full bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/30"
                  >
                    <Pause className="h-4 w-4" />
                    End call
                  </button>
                ) : (
                  <button
                    onClick={startCall}
                    className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/30"
                  >
                    <Play className="h-4 w-4" />
                    Start call
                  </button>
                )}
                <button
                  onClick={() => simulateTopUp(10)}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/40"
                >
                  Top-up $10
                </button>
                <button
                  onClick={() => simulateTopUp(20)}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/40"
                >
                  Top-up $20
                </button>
                <button
                  onClick={() => selectedMsisdn && loadCustomerDetail(selectedMsisdn)}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/40"
                >
                  <RefreshCw className="mr-1 inline h-4 w-4" />
                  Refresh
                </button>
              </div>

              {currentOffer && (
                <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">History signals</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {currentHistoryReasons.length
                        ? currentHistoryReasons.map((reason) => (
                            <li key={reason} className="rounded-xl bg-white/5 px-3 py-2">
                              {reason}
                            </li>
                          ))
                        : (
                          <li className="text-slate-400">No prior information recorded.</li>
                          )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Model justification</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {currentModelReasons.length
                        ? currentModelReasons.map((reason) => (
                            <li key={reason} className="rounded-xl bg-white/5 px-3 py-2">
                              {reason}
                            </li>
                          ))
                        : (
                          <li className="text-slate-400">Awaiting current offer.</li>
                          )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Micro-loan journey</p>
                  <p className="text-lg font-semibold text-white">Latest transaction trace</p>
                </div>
                <Clock className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Follow the steps from call start to repayment. Each bubble lights up as real-time events flow in.
              </p>
              <div className="mt-6 space-y-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex min-w-max flex-row gap-6">
                      {timelineSteps.map((step, index) => {
                        const Icon = TIMELINE_ICON_MAP[step.id] || CircleDot
                        const isHighlight = highlightStep === step.id
                        const isDecisionDeclined = step.id === 'decision' && step.eventType === 'offer_declined'
                        const isSelectedEvent = step.event && selectedJourneyEvent?.event_id === step.event.event_id

                        return (
                          <div key={step.id} className="relative flex flex-col items-center text-center">
                            {index < timelineSteps.length - 1 && (
                              <span
                                className={cn(
                                  'absolute top-6 left-[55%] h-[2px] w-24',
                                  step.status === 'done' ? 'bg-emerald-400/60' : 'bg-white/10',
                                )}
                              />
                            )}
                            <button
                              type="button"
                              disabled={!step.event}
                              onClick={() => step.event && setSelectedJourneyEvent(step.event)}
                              className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-full border transition focus:outline-none',
                                step.status === 'done' && !isDecisionDeclined && 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200',
                                step.status === 'current' && 'border-white/60 bg-white/10 text-white',
                                step.status === 'pending' && 'border-white/10 text-slate-500',
                                isDecisionDeclined && 'border-rose-400/60 bg-rose-500/10 text-rose-200',
                                isHighlight && 'ring-2 ring-offset-4 ring-offset-slate-900 ring-emerald-300',
                                isSelectedEvent && 'ring-2 ring-offset-4 ring-offset-slate-900 ring-cyan-300',
                                !step.event && 'cursor-not-allowed opacity-40',
                                step.event && 'cursor-pointer hover:border-white/70',
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">{step.label}</p>
                            <p className="text-sm text-white">{step.timestamp ? formatTime(step.timestamp) : '—'}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <BalanceTrendGraph history={snapshot?.balanceHistory || []} markers={balanceMarkers} />
                {selectedJourneyEvent && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Event detail</p>
                        <p className="text-lg font-semibold text-white">{selectedJourneyEvent.label}</p>
                        <p className="text-sm text-slate-300">
                          {new Date(selectedJourneyEvent.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-xs text-slate-400 uppercase tracking-[0.3em]">
                        {selectedJourneyEvent.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                    {selectedEventReasons.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Model reasoning</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-200">
                          {selectedEventReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedEventContextReasons.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Historical signals</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-200">
                          {selectedEventContextReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedEventMetadataEntries.length > 0 && (
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Additional context</p>
                        {selectedEventMetadataEntries.map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-4">
                            <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="text-right">{formatMetadataValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Live activity feed</p>
                <span className="text-xs uppercase tracking-[0.4em] text-slate-400">Ledger lite</span>
              </div>
              <div className="mt-4 space-y-3">
                {(timeline.length ? [...timeline].reverse() : []).slice(0, 6).map((event) => {
                  const isSelected = selectedJourneyEvent?.event_id === event.event_id
                  return (
                    <button
                      key={event.event_id}
                      type="button"
                      onClick={() => setSelectedJourneyEvent(event)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-2 text-left text-sm transition focus:outline-none',
                        'hover:border-white/40',
                        isSelected && 'border-cyan-300/60 bg-cyan-500/10',
                      )}
                    >
                      <span className="font-medium text-white">{event.label}</span>
                      <span className="text-slate-400">{formatRelativeTime(event.timestamp)}</span>
                    </button>
                  )
                })}
                {!timeline.length && (
                  <p className="text-sm text-slate-400">No events yet — start a call to seed the journey.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/5 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Customer detail</p>
            </div>

            <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="mb-4 flex gap-2 rounded-full border border-white/10 bg-white/0 p-1 text-xs">
                {(['overview', 'offers', 'explainability', 'audit'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'rounded-full px-3 py-1 capitalize transition',
                      activeTab === tab ? 'bg-white/90 text-slate-900' : 'text-slate-300',
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {loadingDetail && <p className="text-sm text-slate-400">Loading detail…</p>}

              {!loadingDetail && !snapshot && (
                <p className="text-sm text-slate-400">Select a customer to see detail.</p>
              )}

              {!loadingDetail && snapshot && activeTab === 'overview' && selectedSummary && (
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Profile</p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-400">Tenure</p>
                        <p className="text-xl font-semibold text-white">
                          {selectedSummary.behavior.tenureDays} days
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Top-up frequency (30d)</p>
                        <p className="text-xl font-semibold text-white">
                          {selectedSummary.behavior.topupFrequency}x
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Avg top-up</p>
                        <p className="text-xl font-semibold text-white">
                          {formatCurrency(selectedSummary.behavior.avgTopupAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Risk tier</p>
                        <p className="text-xl font-semibold text-white capitalize">
                          {selectedSummary.behavior.riskTier}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Performance</p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-400">Acceptance rate</p>
                        <p className="text-xl font-semibold text-white">
                          {formatPercent(selectedSummary.stats.acceptanceRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Repayment rate</p>
                        <p className="text-xl font-semibold text-white">
                          {formatPercent(selectedSummary.stats.repaymentRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Active loans</p>
                        <p className="text-xl font-semibold text-white">
                          {selectedSummary.stats.activeLoans}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Exposure</p>
                        <p className="text-xl font-semibold text-white">
                          {formatCurrency(selectedSummary.stats.totalExposure)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Recent activity</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li className="flex items-center justify-between">
                        <span className="text-slate-400">Last offer</span>
                        <span>{formatRelativeTime(selectedSummary.activity.lastOfferAt)}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-slate-400">Last loan event</span>
                        <span>{formatRelativeTime(selectedSummary.activity.lastLoanAt)}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-slate-400">Last top-up</span>
                        <span>{formatRelativeTime(selectedSummary.activity.lastTopUpAt)}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {!loadingDetail && snapshot && activeTab === 'offers' && (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Offers</p>
                    <div className="mt-3 space-y-2">
                      {offersSorted.map((offer) => (
                        <div
                          key={offer.offer_id}
                          className="rounded-2xl border border-white/5 bg-white/5 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white">${offer.amount}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                                offer.status === 'declined'
                                  ? 'bg-rose-500/10 text-rose-200'
                                  : offer.status === 'disbursed'
                                    ? 'bg-emerald-500/10 text-emerald-200'
                                    : 'bg-white/10 text-white',
                              )}
                            >
                              {offer.status}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                            <span>{new Date(offer.created_at).toLocaleString()}</span>
                            <button
                              className="text-emerald-300 hover:text-emerald-200"
                              onClick={() => loadExplainability(offer)}
                            >
                              View decision
                            </button>
                          </div>
                          {offer.context_reasons?.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                              {offer.context_reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          ) : null}
                          {offer.reasons?.length ? (
                            <div className="mt-2 text-xs text-slate-400">
                              Model reasons: {offer.reasons.join(', ')}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {!offersSorted.length && (
                        <p className="text-slate-400">No offers yet.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Loans</p>
                    <div className="mt-3 space-y-2">
                      {loansSorted.map((loan) => (
                        <div
                          key={loan.loan_id}
                          className="rounded-2xl border border-white/5 bg-white/5 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white">${loan.amount}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                                loan.status === 'repaid'
                                  ? 'bg-emerald-500/10 text-emerald-200'
                                  : loan.status === 'disbursed'
                                    ? 'bg-indigo-500/10 text-indigo-200'
                                    : 'bg-white/10 text-white',
                              )}
                            >
                              {loan.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            <p>Disbursed {loan.disbursed_at ? formatRelativeTime(loan.disbursed_at) : '—'}</p>
                            <p>Repaid {loan.repaid_at ? formatRelativeTime(loan.repaid_at) : '—'}</p>
                          </div>
                        </div>
                      ))}
                      {!loansSorted.length && <p className="text-slate-400">No loans yet.</p>}
                    </div>
                  </div>
                </div>
              )}

              {!loadingDetail && snapshot && activeTab === 'explainability' && (
                <div className="space-y-4 text-sm text-slate-300">
                  {explainLoading && <p>Loading model decision…</p>}
                  {!explainLoading && !explainPayload && (
                    <p>Select an offer from the Offers tab to view model outputs.</p>
                  )}
                  {!explainLoading && explainPayload && (
                    <>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Model</p>
                        <p className="text-white">
                          {explainPayload.modelDecision.model_name} v{explainPayload.modelDecision.model_version}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-white">
                          <div>
                            <p className="text-xs text-slate-400">P(repay)</p>
                            <p className="text-2xl font-semibold">
                              {formatPercent(explainPayload.modelDecision.outputs.p_repay)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Confidence</p>
                            <p className="text-2xl font-semibold">
                              {formatPercent(explainPayload.modelDecision.outputs.confidence)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400">Recommended limit</p>
                            <p className="text-lg font-semibold text-white">
                              ${explainPayload.modelDecision.outputs.recommended_limit}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Approved amount</p>
                            <p className="text-lg font-semibold text-white">
                              ${explainPayload.offer.amount}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Top features</p>
                        <div className="mt-3 space-y-2">
                          {explainPayload.explainability.contributions.slice(0, 5).map((item: any) => (
                            <div key={item.feature_name} className="flex items-center justify-between">
                              <span>{item.feature_name}</span>
                              <span
                                className={cn(
                                  'font-medium',
                                  item.contribution >= 0 ? 'text-emerald-300' : 'text-rose-300',
                                )}
                              >
                                {item.contribution >= 0 ? '+' : ''}
                                {item.contribution.toFixed(3)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">User-facing reasons</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {explainPayload.explainability.user_reasons.map((reason: string) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      {(explainPayload.offer.context_reasons?.length || currentOffer?.context_reasons?.length) && (
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Historical context</p>
                          <ul className="mt-2 list-disc space-y-1 pl-4">
                            {(explainPayload.offer.context_reasons || currentOffer?.context_reasons || []).map(
                              (reason: string) => (
                                <li key={reason}>{reason}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!loadingDetail && snapshot && activeTab === 'audit' && (
                <div className="space-y-3 text-sm text-slate-300">
                  {ledgerEvents.map((event) => (
                    <div key={event.event_id} className="rounded-2xl border border-white/5 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white">{event.type.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {event.entity_type} - {event.entity_id.slice(0, 8)}…
                      </p>
                    </div>
                  ))}
                  {!ledgerEvents.length && <p>No ledger events yet.</p>}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
