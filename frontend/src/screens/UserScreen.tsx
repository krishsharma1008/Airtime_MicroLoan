import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Smartphone, Wifi, AlertCircle } from 'lucide-react'
import type { Offer } from '../types'

export default function UserScreen() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'idle' | 'accepting' | 'declining' | 'accepted' | 'declined'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid link')
      setLoading(false)
      return
    }

    fetch(`/api/offers/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setOffer(data.offer)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load offer')
        setLoading(false)
      })
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setAction('accepting')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'accept' }),
      })
      const data = await res.json()
      if (data.success) {
        setAction('accepted')
      } else {
        setError(data.message || 'Failed to accept offer')
        setAction('idle')
      }
    } catch (err) {
      console.error('Failed to accept offer', err)
      setError('Failed to accept offer')
      setAction('idle')
    }
  }

  const handleDecline = async () => {
    if (!token) return
    setAction('declining')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'decline' }),
      })
      const data = await res.json()
      if (data.success) {
        setAction('declined')
      } else {
        setError(data.message || 'Failed to decline offer')
        setAction('idle')
      }
    } catch (err) {
      console.error('Failed to decline offer', err)
      setError('Failed to decline offer')
      setAction('idle')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-700">Loading offer...</p>
        </div>
      </div>
    )
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Offer Not Available</h1>
          <p className="text-gray-600">{error || 'This offer is no longer available'}</p>
        </div>
      </div>
    )
  }

  if (action === 'accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Loan Approved!</h1>
          <p className="text-gray-600 text-center mb-6">Your airtime credit has been applied.</p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold">${offer.amount}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Fee:</span>
              <span className="font-semibold text-green-600">$0.00</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total to repay:</span>
                <span className="font-bold">${offer.amount}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Airtime credit applied immediately</li>
              <li>• Your call/data can continue</li>
              <li>• Repayment automatically deducted on next top-up</li>
              <li>• No action needed from you</li>
            </ul>
          </div>

          <div className="text-center text-sm text-gray-500">
            Offer ID: {offer.offer_id.slice(0, 8)}...
          </div>
        </div>
      </div>
    )
  }

  if (action === 'declined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Offer Declined</h1>
          <p className="text-gray-600 mb-6">You've declined this offer. No charges will be applied.</p>
          <button
            onClick={() => navigate('/cockpit')}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            View Dashboard
          </button>
        </div>
      </div>
    )
  }

  const timeRemaining = Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 1000 / 60))

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Airtime Advance</h1>
            <p className="text-primary-100">Keep your connection going</p>
          </div>

          {/* Amount Card */}
          <div className="p-6 border-b">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary-600 mb-2">${offer.amount}</div>
              <p className="text-gray-600">0% fee • Repays on next top-up</p>
            </div>
          </div>

          {/* Benefit Estimate */}
          {offer.benefit_estimate && (
            <div className="p-6 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Based on your usage patterns:</h3>
              <div className="space-y-2">
                {offer.benefit_estimate.voice_minutes && (
                  <div className="flex items-center text-gray-700">
                    <Smartphone className="h-5 w-5 text-primary-600 mr-2" />
                    <span>This should keep your call running for ~{offer.benefit_estimate.voice_minutes} minutes</span>
                  </div>
                )}
                {offer.benefit_estimate.data_days && (
                  <div className="flex items-center text-gray-700">
                    <Wifi className="h-5 w-5 text-primary-600 mr-2" />
                    <span>Or your data active for ~{offer.benefit_estimate.data_days} days</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Why This Offer */}
          <div className="p-6 border-b">
            <h3 className="font-semibold text-gray-900 mb-3">Why you're seeing this offer:</h3>
            <ul className="space-y-2">
              {offer.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Terms */}
          <div className="p-6 border-b bg-gray-50">
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>No fees or interest</span>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Automatic repayment on your next top-up</span>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>You can opt out anytime</span>
              </div>
            </div>
          </div>

          {/* Expiry Timer */}
          {timeRemaining > 0 && (
            <div className="p-4 bg-yellow-50 border-b flex items-center justify-center text-sm text-yellow-800">
              <Clock className="h-4 w-4 mr-2" />
              <span>Offer expires in {timeRemaining} minutes</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border-b flex items-center text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 space-y-3">
            <button
              onClick={handleAccept}
              disabled={action !== 'idle' || timeRemaining === 0}
              className="w-full bg-primary-600 text-white py-4 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action === 'accepting' ? 'Processing...' : 'Accept Offer'}
            </button>
            <button
              onClick={handleDecline}
              disabled={action !== 'idle'}
              className="w-full bg-gray-200 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action === 'declining' ? 'Processing...' : 'Decline'}
            </button>
            <button
              onClick={() => {
                // In real app, this would update user preferences
                alert('Opt-out preference saved. You won\'t receive future offers.')
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Opt out of future offers
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
