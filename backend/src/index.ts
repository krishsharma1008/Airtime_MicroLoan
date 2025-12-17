/**
 * Main API server
 * Express API + WebSocket server for real-time updates
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { orchestrator } from './services/orchestrator.js';
import { store } from './store/inMemoryStore.js';
import { PERSONAS, getAllPersonaNames } from './data/personas.js';
import { ledgerService } from './services/ledgerService.js';
import { offerService } from './services/offerService.js';
import { journeyService } from './services/journeyService.js';
import { seedInitialData, seedPersonaData } from './data/seed.js';
import { customerService } from './services/customerService.js';
import type { Offer } from './types/schemas.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// Seed initial mock data so dashboard is populated on load
seedInitialData();

// Initialize orchestrator
orchestrator.initialize();

function buildUserSnapshot(msisdn: string) {
  const user = store.getUser(msisdn);
  if (!user) {
    return null;
  }

  const balance = store.getLatestBalance(msisdn);
  const balanceHistory = store.getBalanceHistory(msisdn, 50);
  const activeCall = store.getActiveCallForUser(msisdn);
  const activeOffer = store.getActiveOfferForUser(msisdn);
  const activeLoan = store.getActiveLoanForUser(msisdn);
  const loans = store.getLoansByMsisdn(msisdn);
  const offers = store.getOffersByMsisdn(msisdn);
  const topUps = store.getTopUps(msisdn);
  const smsMessages = store.getSmsMessagesByMsisdn(msisdn);
  const timeline = journeyService.getTimeline(msisdn, 50);

  return {
    user,
    balance: balance?.balance || 0,
    balanceHistory,
    activeCall,
    activeOffer,
    activeLoan,
    loans,
    offers,
    topUps,
    smsMessages,
    timeline,
  };
}

// WebSocket connection handling
const clients = new Set<any>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast events to all WebSocket clients
orchestrator.onEvent((event) => {
  const message = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
});

// ============================================================================
// API Routes
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all personas
app.get('/api/personas', (req, res) => {
  res.json({
    personas: getAllPersonaNames().map((name) => ({
      name,
      msisdn: PERSONAS[name].msisdn,
      profile: PERSONAS[name],
    })),
  });
});

// Initialize persona (seed user data)
app.post('/api/personas/:name/init', (req, res) => {
  const { name } = req.params;
  const persona = PERSONAS[name];
  if (!persona) {
    return res.status(404).json({ error: 'Persona not found' });
  }

  seedPersonaData(name);

  res.json({ success: true, msisdn: persona.msisdn });
});

// Start a call
app.post('/api/calls/start', (req, res) => {
  const { msisdn } = req.body;
  if (!msisdn) {
    return res.status(400).json({ error: 'msisdn required' });
  }

  const sessionId = orchestrator.startCall(msisdn);
  res.json({ success: true, session_id: sessionId });
});

// End a call
app.post('/api/calls/end', (req, res) => {
  const { session_id } = req.body;
  if (!session_id) {
    return res.status(400).json({ error: 'session_id required' });
  }

  orchestrator.endCall(session_id);
  res.json({ success: true });
});

// Simulate top-up
app.post('/api/topup', (req, res) => {
  const { msisdn, amount, channel } = req.body;
  if (!msisdn || !amount) {
    return res.status(400).json({ error: 'msisdn and amount required' });
  }

  orchestrator.simulateTopUp(msisdn, amount, channel || 'online');
  res.json({ success: true });
});

// Get offer by token (for consent page)
app.get('/api/offers/:token', (req, res) => {
  const { token } = req.params;
  const offer = offerService.getOfferByToken(token);

  if (!offer) {
    return res.status(404).json({ error: 'Offer not found or expired' });
  }

  // Mark link as opened
  orchestrator.markLinkOpened(token);

  res.json({ offer });
});

// Handle consent
app.post('/api/consent', (req, res) => {
  const { token, action } = req.body;
  if (!token || !action) {
    return res.status(400).json({ error: 'token and action required' });
  }

  if (action !== 'accept' && action !== 'decline') {
    return res.status(400).json({ error: 'action must be accept or decline' });
  }

  const result = orchestrator.handleConsent(token, action);
  res.json(result);
});

// Get user data (for cockpit)
app.get('/api/users/:msisdn', (req, res) => {
  const { msisdn } = req.params;
  const snapshot = buildUserSnapshot(msisdn);
  if (!snapshot) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(snapshot);
});

// Customer summaries
app.get('/api/customers', (req, res) => {
  const customers = customerService.getCustomerSummaries();
  res.json({
    customers,
    updated_at: new Date().toISOString(),
  });
});

app.get('/api/customers/:msisdn', (req, res) => {
  const { msisdn } = req.params;
  const summary = customerService.getCustomerSummary(msisdn);
  const detail = buildUserSnapshot(msisdn);

  if (!summary || !detail) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json({
    summary,
    detail,
  });
});

// Get all offers (for cockpit)
app.get('/api/offers', (req, res) => {
  const offers = store.getAllOffers();
  res.json({ offers });
});

// Get all loans (for cockpit)
app.get('/api/loans', (req, res) => {
  const loans = store.getAllLoans();
  res.json({ loans });
});

// Get ledger events
app.get('/api/ledger', (req, res) => {
  const { entity_id, entity_type, limit, msisdn } = req.query;
  let events;

  if (entity_id) {
    events = ledgerService.getEventsForEntity(
      entity_id as string,
      entity_type as string | undefined
    );
  } else if (msisdn) {
    events = ledgerService
      .getAllEvents(Number(limit) || 100)
      .filter((event) => event.payload?.msisdn === msisdn);
  } else {
    events = ledgerService.getAllEvents(Number(limit) || 100);
  }

  res.json({ events });
});

// Get SMS messages (for demo inbox)
app.get('/api/sms', (req, res) => {
  const { msisdn } = req.query;
  const messages = msisdn
    ? store.getSmsMessagesByMsisdn(msisdn as string)
    : store.getAllSmsMessages();
  res.json({ messages });
});

// Get model decision
app.get('/api/decisions/:decisionId', (req, res) => {
  const { decisionId } = req.params;
  const decision = store.getModelDecision(decisionId);
  if (!decision) {
    return res.status(404).json({ error: 'Decision not found' });
  }
  res.json({ decision });
});

// Get offer with full explainability
app.get('/api/offers/:offerId/explain', (req, res) => {
  const { offerId } = req.params;
  const offer = store.getOffer(offerId);
  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  const decision = store.getModelDecision(offer.model_decision_id);
  if (!decision) {
    return res.status(404).json({ error: 'Model decision not found' });
  }

  res.json({
    offer,
    modelDecision: decision,
    explainability: {
      model_name: decision.model_name,
      model_version: decision.model_version,
      p_repay: decision.outputs.p_repay,
      confidence: decision.outputs.confidence,
      recommended_limit: decision.outputs.recommended_limit,
      approved_amount: offer.amount,
      contributions: decision.contributions,
      features: decision.features_snapshot,
      user_reasons: offer.reasons,
    },
  });
});

// Get KPIs (for cockpit dashboard)
app.get('/api/kpis', (req, res) => {
  const offers = store.getAllOffers();
  const loans = store.getAllLoans();
  const smsMessages = store.getAllSmsMessages();
  const users = store.getAllUsers();

  const totalOffers = offers.length;
  const acceptedOffers = offers.filter((o) => o.status === 'accepted' || o.status === 'disbursed').length;
  const declinedOffers = offers.filter((o) => o.status === 'declined').length;
  const acceptanceRate = totalOffers > 0 ? acceptedOffers / totalOffers : 0;

  const activeLoanList = loans.filter((l) => ['pending', 'disbursed'].includes(l.status));
  const activeLoans = activeLoanList.length;
  const repaidLoans = loans.filter((l) => l.status === 'repaid').length;
  const repaymentRate = loans.length > 0 ? repaidLoans / loans.length : 0;
  const activeExposure = activeLoanList.reduce((sum, loan) => sum + loan.amount, 0);

  const offersToday = offers.filter(
    (offer) => Date.now() - offer.created_at.getTime() < 24 * 60 * 60 * 1000
  ).length;

  const activeCustomerSet = new Set<string>();
  users.forEach((user) => {
    if (
      store.getActiveCallForUser(user.msisdn) ||
      store.getActiveOfferForUser(user.msisdn) ||
      store.getActiveLoanForUser(user.msisdn)
    ) {
      activeCustomerSet.add(user.msisdn);
    }
  });

  const deliveredSms = smsMessages.filter((m) => m.delivered).length;
  const deliveryRate = smsMessages.length > 0 ? deliveredSms / smsMessages.length : 0;

  // Calculate average time to consent (mock - would need timestamps)
  const avgTimeToConsent = 45; // seconds (mock)

  res.json({
    offers: {
      total: totalOffers,
      accepted: acceptedOffers,
      declined: declinedOffers,
      acceptance_rate: acceptanceRate,
    },
    loans: {
      total: loans.length,
      active: activeLoans,
      repaid: repaidLoans,
      repayment_rate: repaymentRate,
    },
    sms: {
      total: smsMessages.length,
      delivered: deliveredSms,
      delivery_rate: deliveryRate,
    },
    metrics: {
      avg_time_to_consent_seconds: avgTimeToConsent,
    },
    company: {
      total_customers: users.length,
      active_customers: activeCustomerSet.size,
      offers_today: offersToday,
      active_exposure: activeExposure,
      acceptance_rate: acceptanceRate,
      repayment_rate: repaymentRate,
    },
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
});
