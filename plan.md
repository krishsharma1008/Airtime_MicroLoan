### Company dashboard concept

- **1) Multi-customer layout**
  - **Customer list (left column)**: one card per customer/persona (e.g. OnTimeRepayer, FrequentUser, RiskyUser, etc.) showing:
    - Name + MSISDN
    - Current state pill: `On call`, `Idle`, `Offer pending`, `Loan active`, `Repaid`
    - Key stats: total loans, acceptance rate, total exposure
  - **Global KPIs (top strip)**: company-level tiles (Total active customers, Offers today, Acceptance rate, Active exposure, Repayment rate) computed across all customers from the mock data.

- **2) Spotlight customer “micro-loan journey” (center panel)**
  - When you click a customer card, the center shows a **visual flow for their latest transaction**:
    - Timeline with labeled steps: `Call start → Balance low → Offer created → SMS sent → Link opened → Accepted/Declined → Disbursed → Top-up → Repaid`
    - Each step animates + highlights in real time as events come in for that customer.
    - A small balance graph under the timeline: balance vs time, with vertical markers for `offer`, `disbursal`, and `repayment`.
    - Status header like: “Customer is currently **on call** and **offer pending**” or “Loan **repaid** on last top-up”.

- **3) Per-customer detail view (right panel)**
  - Tabs for the **selected customer**:
    - **Overview**: profile summary (tenure, top-up frequency, avg top-up, risk tier badge).
    - **Offers & loans**: table of their past offers and loans with statuses.
    - **Explainability**: model decision card (model version, P_repay, confidence, top features, user-facing reasons) specific to their last offer.
    - **Audit**: ledger events filtered only to that customer (offer_created, sms_sent, link_opened, etc).

- **4) Mock data model**
  - Extend the existing personas so **each persona == one “customer”** in the dashboard, each with seeded:
    - Profile (tenure, top-ups, repayment history).
    - A small history of past mock loans/offers (pre-populated), so KPIs and tables don’t look empty at start.
  - Keep one persona (e.g. `OnTimeRepayer`) as the **live spotlight**:
    - Start a simulated call on this persona during the demo.
    - Watch their card change status and the journey timeline animate as they accept or decline the offer.

- **5) Visual emphasis for the POC demo**
  - Use clear, color-coded chips and progress bars so the flow is understandable at a glance:
    - Green = successful steps (accepted, disbursed, repaid).
    - Red = declined/expired.
    - Amber = pending (offer created, waiting for consent).
  - Add subtle animations when key events happen (e.g., the “Offer created” node pulses, the “Loan disbursed” node fills in).
  - Ensure the dashboard can be screen-shared: one tab shows the **company dashboard**, another tab (or a mobile frame) shows the **subscriber User Screen** when you open the consent link.

### How this maps to your current POC

- Backend already has multiple personas and per-user events; we’d:
  - Add a **“customers” endpoint** that returns all personas plus their aggregated KPIs.
  - Add a **per-customer events endpoint** (or filter) to drive the journey timeline.
- Frontend cockpit would be refactored from a primarily single-user view into:
  - Left: **customer list + state badges**.
  - Center: **spotlight journey timeline + balance graph**.
  - Right: **explainability + audit tabs** for the selected customer.

### Commands to run/verify (after we implement this enhancement)

```bash
# From the project root
npm run dev

# Then in the browser:
# - Open the company dashboard: http://localhost:3000/cockpit
# - Select different customers to see their own KPIs and micro-loan journeys
# - Start a call on the spotlight customer and watch their journey animate live
```


