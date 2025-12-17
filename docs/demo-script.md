# Demo Script for Airtime Micro-Loans POC

## Pre-Demo Setup

1. Start the servers:
   ```bash
   npm run dev
   ```

2. Open two browser windows:
   - Window 1: http://localhost:3000/cockpit (Operations Dashboard)
   - Window 2: http://localhost:3000/consent?token=<token> (User Screen - will be opened via link)

## Demo Flow

### Step 1: Initialize Persona
- In Cockpit, select "onTimeRepayer" persona
- System seeds user data and sets initial balance to $2.00

### Step 2: Start Call Simulation
- Click "Start Call" button
- Observe:
  - User status shows "Active Call: Active"
  - Live timeline shows "call_start" event
  - Balance starts at $2.00

### Step 3: Watch Balance Deplete
- Balance updates every 5 seconds
- Timeline shows "balance_update" events
- Balance decreases: $2.00 → $1.50 → $1.00 → $0.50 → $0.30...

### Step 4: Low Balance Trigger
- When balance drops below $0.50:
  - Timeline shows "low_balance_trigger" event
  - System checks eligibility
  - Timeline shows "offer_created" event
  - Timeline shows "sms_sent" event

### Step 5: View Explainability
- In "Recent Offers" panel, click on the offer
- Explainability panel shows:
  - Model: airtime_risk_v1 v1.0.0
  - Repayment Probability: ~85-95%
  - Confidence: ~75-90%
  - Recommended Limit: $5 or $10
  - Approved Amount: $5 or $10 (bucketed)
  - Top Feature Contributions:
    * tenure_days: +0.15
    * on_time_repay_rate: +0.20
    * topup_frequency_30d: +0.12
    * etc.
  - User-Facing Reasons:
    * "You've been with us for X months"
    * "Excellent repayment history"
    * "You recharge X times per month"
    * etc.

### Step 6: View User Screen
- Copy the consent_token from the offer
- Open: http://localhost:3000/consent?token=<token>
- Or click the SMS link (if you have the token)
- User sees:
  - Loan amount: $5 or $10
  - 0% fee
  - Benefit estimate: "~50 minutes" or "~10 days data"
  - Why this offer: 3-5 reasons
  - Terms: No fees, auto-repayment, opt-out option
  - Expiry timer: 10 minutes

### Step 7: Accept Offer
- Click "Accept Offer"
- User sees confirmation screen:
  - "Loan Approved!"
  - Amount, fee ($0), total to repay
  - "What happens next?" timeline
- Cockpit updates:
  - Timeline shows "offer_accepted"
  - Timeline shows "loan_disbursed"
  - User status shows "Active Loan: $X"
  - Balance increases by loan amount

### Step 8: Simulate Top-Up
- In Cockpit, click "Top-up $10" or "Top-up $20"
- Timeline shows:
  - "topup_processed" event
  - "repayment_initiated" event
  - "repayment_completed" event
- User status updates:
  - "Active Loan" becomes "None"
  - Balance shows remaining after repayment

### Step 9: View KPIs
- Check KPI panel:
  - Acceptance Rate: Updates based on offers
  - Repayment Rate: Updates based on loans
  - Total Offers: Count of all offers
  - Active Loans: Current active loans

### Step 10: View Audit Ledger
- Scroll to "Audit Ledger" section
- See immutable event log:
  - offer_created
  - sms_sent
  - link_opened
  - offer_accepted
  - disbursal_initiated
  - disbursal_completed
  - topup_detected
  - repayment_initiated
  - repayment_completed

## Advanced Demo Scenarios

### Scenario 1: User Declines
- Follow steps 1-6
- Click "Decline" instead of "Accept"
- Cockpit shows "offer_declined" event
- No loan is created

### Scenario 2: Different Personas
- Try "riskyUser" persona
- May not get an offer (low P_repay)
- Or get a lower amount ($1 instead of $5/$10)

### Scenario 3: Opted-Out User
- Select "optedOut" persona
- Start call, balance depletes
- No offer is created (user opted out)

### Scenario 4: Multiple Offers
- Start call for one user
- Wait for offer
- Start call for another user
- See multiple offers in "Recent Offers"

## Key Points to Highlight

1. **Real-time**: Everything updates live via WebSocket
2. **Transparency**: User sees clear reasons, no ML jargon
3. **Explainability**: Cockpit shows full model decision trace
4. **Dynamic Amounts**: Based on risk, not fixed
5. **Automatic Repayment**: Seamless on next top-up
6. **Audit Trail**: Complete immutable ledger
7. **Professional UI**: Premium look and feel

## Troubleshooting

- If WebSocket disconnects: Refresh cockpit page
- If offer not created: Check user eligibility (tenure, opt-out, active loan)
- If balance not updating: Check console for errors
- If consent link doesn't work: Verify token is correct


