/**
 * SMS Gateway Mock
 * Simulates SMS sending and delivery
 */

import { v4 as uuidv4 } from 'uuid';
import type { SmsMessage, Offer } from '../types/schemas.js';
import { store } from '../store/inMemoryStore.js';
import { ledgerService } from './ledgerService.js';
import { offerService } from './offerService.js';

export class SmsGatewayMock {
  private deliveryFailureRate = 0; // Can be set to simulate failures (0-1)

  /**
   * Set delivery failure rate for testing
   */
  setDeliveryFailureRate(rate: number): void {
    this.deliveryFailureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Send an SMS with offer link
   */
  sendOfferSms(offer: Offer): SmsMessage {
    const baseUrl = process.env.CONSENT_BASE_URL || 'http://localhost:3000';
    const consentUrl = `${baseUrl}/consent?token=${offer.consent_token}`;

    // Generate user-friendly message
    const benefitText = this.generateBenefitText(offer);
    const message = `You're running low on balance. Want a free $${offer.amount} airtime advance to keep your call/data running? ${benefitText} Repays automatically on next top-up. Tap to review: ${consentUrl}`;

    const sms: SmsMessage = {
      message_id: uuidv4(),
      msisdn: offer.msisdn,
      message,
      offer_id: offer.offer_id,
      sent_at: new Date(),
      delivered: false,
      delivery_failed: false,
    };

    store.addSmsMessage(sms);

    // Simulate delivery (with optional failure)
    setTimeout(() => {
      if (Math.random() < this.deliveryFailureRate) {
        sms.delivery_failed = true;
        sms.delivered = false;
      } else {
        sms.delivered = true;
        sms.delivery_failed = false;
      }
      store.addSmsMessage(sms); // Update
    }, 1000); // Simulate 1 second delivery delay

    // Log SMS sent
    ledgerService.logEvent({
      type: 'sms_sent',
      entity_id: offer.offer_id,
      entity_type: 'offer',
      payload: {
        msisdn: offer.msisdn,
        message_id: sms.message_id,
      },
    });

    // Update offer status
    offerService.updateOfferStatus(offer.offer_id, 'sms_sent');

    return sms;
  }

  /**
   * Generate benefit text for SMS
   */
  private generateBenefitText(offer: Offer): string {
    if (!offer.benefit_estimate) return '';

    const parts: string[] = [];
    if (offer.benefit_estimate.voice_minutes) {
      parts.push(`~${offer.benefit_estimate.voice_minutes} min`);
    }
    if (offer.benefit_estimate.data_days) {
      parts.push(`~${offer.benefit_estimate.data_days} days data`);
    }

    return parts.length > 0 ? `(${parts.join(' or ')})` : '';
  }

  /**
   * Get SMS messages for a user
   */
  getMessagesForUser(msisdn: string): SmsMessage[] {
    return store.getSmsMessagesByMsisdn(msisdn);
  }

  /**
   * Get all SMS messages (for demo inbox)
   */
  getAllMessages(): SmsMessage[] {
    return store.getAllSmsMessages();
  }
}

export const smsGateway = new SmsGatewayMock();


