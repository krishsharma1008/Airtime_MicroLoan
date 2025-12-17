import { useEffect, useState, useRef } from 'react'
import { Play, Pause, RefreshCw, TrendingUp, TrendingDown, Activity, DollarSign, MessageSquare, Clock, Eye, BarChart3 } from 'lucide-react'
import type { Persona, Offer, Loan, LedgerEvent, KPIs, ModelDecision } from '../types'

export default function CockpitScreen() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [userData, setUserData] = useState<any>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [explainability, setExplainability] = useState<any>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [timelineEvents, setTimelineEvents] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Load personas
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data) => setPersonas(data.personas))

    // Load KPIs
    loadKPIs()

    // Connect WebSocket
    const ws = new WebSocket(`ws://${window.location.hostname}:3001/ws`)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleRealtimeEvent(data)
    }
    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (selectedPersona) {
      loadUserData(selectedPersona)
      loadOffers()
      loadLoans()
      loadLedger()
    }
  }, [selectedPersona])

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedPersona) {
        loadUserData(selectedPersona)
        loadKPIs()
      }
    }, 2000) // Refresh every 2 seconds
    return () => clearInterval(interval)
  }, [selectedPersona])

  const handleRealtimeEvent = (event: any) => {
    // Add to timeline
    setTimelineEvents((prev) => [
      ...prev.slice(-49), // Keep last 50 events
      { ...event, timestamp: new Date() },
    ])

    // Refresh data
    if (selectedPersona) {
      loadUserData(selectedPersona)
      loadOffers()
      loadLoans()
      loadLedger()
    }
    loadKPIs()
  }

  const loadUserData = async (msisdn: string) => {
    try {
      const res = await fetch(`/api/users/${msisdn}`)
      const data = await res.json()
      setUserData(data)
    } catch (err) {
      console.error('Failed to load user data', err)
    }
  }

  const loadOffers = async () => {
    try {
      const res = await fetch('/api/offers')
      const data = await res.json()
      setOffers(data.offers || [])
    } catch (err) {
      console.error('Failed to load offers', err)
    }
  }

  const loadLoans = async () => {
    try {
      const res = await fetch('/api/loans')
      const data = await res.json()
      setLoans(data.loans || [])
    } catch (err) {
      console.error('Failed to load loans', err)
    }
  }

  const loadLedger = async () => {
    try {
      const res = await fetch('/api/ledger?limit=50')
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

  const initPersona = async (personaName: string) => {
    try {
      await fetch(`/api/personas/${personaName}/init`, { method: 'POST' })
      const persona = personas.find((p) => p.name === personaName)
      if (persona) {
        setSelectedPersona(persona.msisdn)
      }
    } catch (err) {
      console.error('Failed to init persona', err)
    }
  }

  const startCall = async () => {
    if (!selectedPersona) return
    try {
      await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: selectedPersona }),
      })
      setIsSimulating(true)
    } catch (err) {
      console.error('Failed to start call', err)
    }
  }

  const endCall = async () => {
    if (!userData?.activeCall) return
    try {
      await fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: userData.activeCall.session_id }),
      })
      setIsSimulating(false)
    } catch (err) {
      console.error('Failed to end call', err)
    }
  }

  const simulateTopUp = async (amount: number) => {
    if (!selectedPersona) return
    try {
      await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msisdn: selectedPersona, amount }),
      })
    } catch (err) {
      console.error('Failed to simulate top-up', err)
    }
  }

  const viewExplainability = async (offer: Offer) => {
    try {
      const res = await fetch(`/api/offers/${offer.offer_id}/explain`)
      const data = await res.json()
      setExplainability(data)
      setSelectedOffer(offer)
    } catch (err) {
      console.error('Failed to load explainability', err)
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call_start':
      case 'mno_event':
        return '📞'
      case 'balance_update':
        return '💰'
      case 'low_balance_trigger':
        return '⚠️'
      case 'offer_created':
        return '📋'
      case 'sms_sent':
        return '📱'
      case 'link_opened':
        return '🔗'
      case 'offer_accepted':
        return '✅'
      case 'offer_declined':
        return '❌'
      case 'loan_disbursed':
        return '💸'
      case 'topup_processed':
        return '💳'
      case 'repayment_completed':
        return '💚'
      default:
        return '•'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Loan Service Cockpit</h1>
              <p className="text-sm text-gray-600">Real-time monitoring & explainability</p>
            </div>
            <div className="flex items-center space-x-4">
              {selectedPersona && (
                <div className="text-sm">
                  <span className="text-gray-600">User: </span>
                  <span className="font-semibold">{selectedPersona}</span>
                </div>
              )}
              {kpis && (
                <div className="flex items-center space-x-2 text-sm">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600">Live</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Persona Selector */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Select Persona</h2>
              <div className="grid grid-cols-2 gap-2">
                {personas.map((persona) => (
                  <button
                    key={persona.name}
                    onClick={() => initPersona(persona.name)}
                    className={`p-3 rounded-lg border text-left transition ${
                      selectedPersona === persona.msisdn
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{persona.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{persona.msisdn}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            {selectedPersona && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold text-gray-900 mb-3">Simulation Controls</h2>
                <div className="flex flex-wrap gap-2">
                  {!userData?.activeCall ? (
                    <button
                      onClick={startCall}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Call
                    </button>
                  ) : (
                    <button
                      onClick={endCall}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      End Call
                    </button>
                  )}
                  <button
                    onClick={() => simulateTopUp(10)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Top-up $10
                  </button>
                  <button
                    onClick={() => simulateTopUp(20)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Top-up $20
                  </button>
                  <button
                    onClick={() => {
                      loadUserData(selectedPersona)
                      loadOffers()
                      loadLoans()
                      loadLedger()
                      loadKPIs()
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
            )}

            {/* User Status */}
            {userData && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold text-gray-900 mb-3">User Status</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Balance</div>
                    <div className="text-2xl font-bold text-primary-600">${userData.balance?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Active Call</div>
                    <div className="text-lg font-semibold">
                      {userData.activeCall ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Active Offer</div>
                    <div className="text-lg font-semibold">
                      {userData.activeOffer ? (
                        <span className="text-blue-600">${userData.activeOffer.amount}</span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Active Loan</div>
                    <div className="text-lg font-semibold">
                      {userData.activeLoan ? (
                        <span className="text-orange-600">${userData.activeLoan.amount}</span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Timeline */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Live Event Timeline</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {timelineEvents.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No events yet. Start a call to see activity.</div>
                ) : (
                  timelineEvents.slice().reverse().map((event, idx) => (
                    <div key={idx} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                      <span className="text-xl">{getEventIcon(event.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{event.type}</div>
                        <div className="text-xs text-gray-500">
                          {event.timestamp?.toLocaleTimeString() || 'Just now'}
                        </div>
                        {event.data && (
                          <div className="text-xs text-gray-600 mt-1 truncate">
                            {JSON.stringify(event.data).slice(0, 100)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ledger Events */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Audit Ledger</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ledgerEvents.map((event) => (
                  <div key={event.event_id} className="text-xs p-2 bg-gray-50 rounded">
                    <div className="flex justify-between">
                      <span className="font-medium">{event.type}</span>
                      <span className="text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-gray-600 mt-1">{event.entity_type}: {event.entity_id.slice(0, 8)}...</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - KPIs, Offers, Explainability */}
          <div className="space-y-6">
            {/* KPIs */}
            {kpis && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Key Metrics
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Acceptance Rate</span>
                      <span className="font-semibold">{(kpis.offers.acceptance_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${kpis.offers.acceptance_rate * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Repayment Rate</span>
                      <span className="font-semibold">{(kpis.loans.repayment_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${kpis.loans.repayment_rate * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <div className="text-xs text-gray-600">Total Offers</div>
                      <div className="text-lg font-bold">{kpis.offers.total}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Active Loans</div>
                      <div className="text-lg font-bold">{kpis.loans.active}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Offers */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Recent Offers</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {offers.slice(0, 10).map((offer) => (
                  <div
                    key={offer.offer_id}
                    className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => viewExplainability(offer)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">${offer.amount}</div>
                        <div className="text-xs text-gray-600">{offer.status}</div>
                      </div>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explainability Panel */}
            {explainability && selectedOffer && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold text-gray-900 mb-3">Model Decision</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-600">Model</div>
                    <div className="font-medium">
                      {explainability.modelDecision.model_name} v{explainability.modelDecision.model_version}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Repayment Probability</div>
                    <div className="font-medium">{(explainability.modelDecision.outputs.p_repay * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Confidence</div>
                    <div className="font-medium">{(explainability.modelDecision.outputs.confidence * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Recommended Limit</div>
                    <div className="font-medium">${explainability.modelDecision.outputs.recommended_limit}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Approved Amount</div>
                    <div className="font-medium text-primary-600">${explainability.approved_amount}</div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-gray-600 mb-2">Top Feature Contributions</div>
                    <div className="space-y-1">
                      {explainability.contributions.slice(0, 5).map((c: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-gray-700">{c.feature_name}</span>
                          <span className={c.contribution > 0 ? 'text-green-600' : 'text-red-600'}>
                            {c.contribution > 0 ? '+' : ''}{c.contribution.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-gray-600 mb-2">User-Facing Reasons</div>
                    <ul className="space-y-1">
                      {explainability.user_reasons.map((r: string, idx: number) => (
                        <li key={idx} className="text-xs text-gray-700">• {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


