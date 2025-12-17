# Airtime Micro-Loans POC

A proof-of-concept for real-time, transparent airtime micro-loans with ML-driven dynamic amounts and explainability.

## Features

- **Real-time event simulation**: Call sessions, balance depletion, top-ups
- **ML-driven eligibility**: Model emulator with feature contributions and explainability
- **Dynamic loan amounts**: Bucketed amounts ($1/$5/$10) based on risk assessment
- **Two-screen demo**:
  - **User Screen**: Mobile-friendly consent page with transparency
  - **Cockpit Screen**: Real-time monitoring, explainability, and audit trail
- **Automatic repayment**: Simulated repayment on next top-up
- **WebSocket real-time updates**: Live event streaming to cockpit

## Tech Stack

- **Backend**: Node.js, TypeScript, Express, WebSocket
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Data Store**: In-memory (POC-ready, easily swappable for real DB)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Running the POC

```bash
# Start both backend and frontend
npm run dev
```

- Backend API: http://localhost:3001
- Frontend: http://localhost:3000
- WebSocket: ws://localhost:3001/ws

### Demo Flow

1. Open http://localhost:3000/cockpit
2. Select a persona (e.g., "onTimeRepayer")
3. Click "Start Call" to simulate a call
4. Watch balance deplete in real-time
5. When balance drops below $0.50, system triggers offer
6. SMS is "sent" (visible in timeline)
7. Click the offer in "Recent Offers" to see explainability
8. Open User Screen via SMS link (or manually: `/consent?token=<token>`)
9. Accept/decline offer
10. If accepted, loan is disbursed immediately
11. Simulate top-up to trigger automatic repayment

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── data/          # Personas/seeded data
│   │   ├── services/      # Core business logic
│   │   ├── store/         # In-memory data store
│   │   ├── types/         # TypeScript schemas
│   │   └── index.ts       # API server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── screens/       # User & Cockpit screens
│   │   ├── types.ts       # Frontend types
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/personas` - List personas
- `POST /api/personas/:name/init` - Initialize persona
- `POST /api/calls/start` - Start call simulation
- `POST /api/calls/end` - End call
- `POST /api/topup` - Simulate top-up
- `GET /api/offers/:token` - Get offer by consent token
- `POST /api/consent` - Accept/decline offer
- `GET /api/users/:msisdn` - Get user data
- `GET /api/offers` - List all offers
- `GET /api/offers/:offerId/explain` - Get explainability data
- `GET /api/kpis` - Get KPIs
- `GET /api/ledger` - Get audit ledger

## Personas

- **onTimeRepayer**: Excellent repayment history, high tenure
- **frequentUser**: Active user, good repayment
- **newUser**: Low tenure, no history
- **riskyUser**: Poor repayment history
- **optedOut**: User who opted out

## Model Decision Flow

1. Feature extraction from user profile
2. Model emulator calculates P_repay, confidence, recommended_limit
3. Feature contributions calculated (SHAP-like)
4. Policy constraints applied (buckets, caps)
5. User-facing reasons generated
6. Offer created with explainability artifacts

## Notes

- All data is in-memory (resets on server restart)
- SMS delivery is simulated
- Airtime credit application is simulated
- Repayment is simulated (no real payment processing)


# Airtime_MicroLoan
