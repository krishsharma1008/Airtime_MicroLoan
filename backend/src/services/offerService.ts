/**
 * Offer Service
 * Creates offers, generates consent tokens, and manages offer lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import type { Offer, OfferStatus, LedgerEventType } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';
import { eligibilityService } from './eligibilityService.js';
import { ledgerService } from './ledgerService.js';
import { buildOfferContextReasons } from './insightService.js';

const OFFER_EXPIRY_MINUTES = 10; // Offers expire in 10 minutes

export class OfferService {
  /**
   * Create an offer for a user based on eligibility check
   */
  createOffer(msisdn: string, sessionId: string): Offer | null {
    // Check eligibility
    const eligibility = eligibilityService.checkEligibility(msisdn);

    if (!eligibility.eligible || !eligibility.approvedAmount || !eligibility.modelDecision) {
      // Log that we checked but didn't offer
      ledgerService.logEvent({
        type: 'offer_created',
        entity_id: sessionId,
        entity_type: 'offer',
        payload: {
          msisdn,
          eligible: false,
          reason: eligibility.reasons.join(', '),
        },
      });
      return null;
    }

    // Check if there's already an active offer
    const existingOffer = store.getActiveOfferForUser(msisdn);
    if (existingOffer) {
      return existingOffer;
    }

    // Create offer
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OFFER_EXPIRY_MINUTES * 60 * 1000);

    const offer: Offer = {
      offer_id: uuidv4(),
      msisdn,
      session_id: sessionId,
      amount: eligibility.approvedAmount,
      status: 'created',
      created_at: now,
      expires_at: expiresAt,
      reasons: eligibility.reasons,
      model_decision_id: eligibility.modelDecision.decision_id,
      consent_token: uuidv4(), // Short-lived token
      benefit_estimate: eligibility.benefitEstimate,
      context_reasons: buildOfferContextReasons(msisdn),
    };

    store.setOffer(offer);

    // Log offer creation
    ledgerService.logEvent({
      type: 'offer_created',
      entity_id: offer.offer_id,
      entity_type: 'offer',
      payload: {
        msisdn,
        amount: offer.amount,
        model_decision_id: offer.model_decision_id,
        reasons: offer.reasons,
      },
    });

    return offer;
  }

  /**
   * Get offer by consent token
   */
  getOfferByToken(token: string): Offer | null {
    const offers = store.getAllOffers();
    const offer = offers.find((o) => o.consent_token === token);
    if (!offer) return null;

    // Check if expired
    if (offer.expires_at < new Date()) {
      this.updateOfferStatus(offer.offer_id, 'expired');
      return null;
    }

    return offer;
  }

  /**
   * Update offer status
   */
  updateOfferStatus(offerId: string, status: OfferStatus): void {
    const offer = store.getOffer(offerId);
    if (!offer) return;

    offer.status = status;
    store.setOffer(offer);

    // Log status change
    const eventType = this.getLedgerEventTypeForStatus(status);
    if (eventType) {
      ledgerService.logEvent({
        type: eventType,
        entity_id: offerId,
        entity_type: 'offer',
        payload: { msisdn: offer.msisdn, previous_status: offer.status },
      });
    }
  }

  private getLedgerEventTypeForStatus(status: OfferStatus): LedgerEventType | null {
    switch (status) {
      case 'link_opened':
        return 'link_opened';
      case 'accepted':
        return 'offer_accepted';
      case 'declined':
        return 'offer_declined';
      case 'expired':
        return 'offer_expired';
      default:
        return null;
    }
  }

  /**
   * Mark offer as link opened (user clicked SMS link)
   */
  markLinkOpened(offerId: string): void {
    this.updateOfferStatus(offerId, 'link_opened');
  }

  /**
   * Accept an offer
   */
  acceptOffer(offerId: string): boolean {
    const offer = store.getOffer(offerId);
    if (!offer) return false;

    if (offer.status !== 'link_opened' && offer.status !== 'sms_sent') {
      return false; // Can only accept from these states
    }

    if (offer.expires_at < new Date()) {
      this.updateOfferStatus(offerId, 'expired');
      return false;
    }

    this.updateOfferStatus(offerId, 'accepted');
    return true;
  }

  /**
   * Decline an offer
   */
  declineOffer(offerId: string): boolean {
    const offer = store.getOffer(offerId);
    if (!offer) return false;

    this.updateOfferStatus(offerId, 'declined');
    return true;
  }
}

export const offerService = new OfferService();
