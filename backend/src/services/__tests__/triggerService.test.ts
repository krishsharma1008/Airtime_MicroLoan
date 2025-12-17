/**
 * Basic unit tests for TriggerService
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { triggerService } from '../triggerService.js'
import { store } from '../../store/inMemoryStore.js'
import { PERSONAS } from '../../data/personas.js'
import type { BalanceUpdateEvent } from '../../types/schemas.js'

describe('TriggerService', () => {
  beforeEach(() => {
    store.clear()
    // Seed a user
    const user = PERSONAS.onTimeRepayer
    store.setUser(user.msisdn, user)
  })

  it('should not trigger if balance is above threshold', () => {
    let triggered = false
    triggerService.onTrigger(() => {
      triggered = true
    })

    const balanceUpdate: BalanceUpdateEvent = {
      event_type: 'balance_update',
      msisdn: PERSONAS.onTimeRepayer.msisdn,
      session_id: 'test-session',
      balance: 1.0, // Above $0.50 threshold
      timestamp: new Date(),
      consumption_rate_per_min: 0.1,
    }

    triggerService.checkBalanceUpdate(balanceUpdate)
    expect(triggered).toBe(false)
  })

  it('should trigger if balance is below threshold during active call', () => {
    let triggered = false
    triggerService.onTrigger(() => {
      triggered = true
    })

    // Create active call session
    const sessionId = 'test-session'
    store.setCallSession(sessionId, {
      event_type: 'call_start',
      session_id: sessionId,
      msisdn: PERSONAS.onTimeRepayer.msisdn,
      start_time: new Date(),
    })

    const balanceUpdate: BalanceUpdateEvent = {
      event_type: 'balance_update',
      msisdn: PERSONAS.onTimeRepayer.msisdn,
      session_id: sessionId,
      balance: 0.3, // Below $0.50 threshold
      timestamp: new Date(),
      consumption_rate_per_min: 0.1,
    }

    triggerService.checkBalanceUpdate(balanceUpdate)
    expect(triggered).toBe(true)
  })
})


