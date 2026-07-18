# TamaFlow - Private Payroll for Global Teams

> **Paying salaries is easy. Running compliant payroll is not**

<img width="808" height="413" alt="Screenshot 2026-07-18 112651" src="https://github.com/user-attachments/assets/d1ca7194-3c5e-4f4c-aeca-9c082a890ca6" />

---

## What is TamaFlow?

TamaFlow combines **Local AI**, **Hyperswarm**, and **Canton** to modernize payroll for global teams.

- **Local AI** generates localized payslips and powers a private knowledge base without exposing sensitive data.
- **Hyperswarm** securely delivers payslips, shares company knowledge, and enables peer-to-peer collaboration.
- **Canton** provides private, atomic, and auditable payroll settlement.

### Applications

- **Employer Desktop** — Payroll management, local AI, and Canton settlement.
- **Employee Portal** — Payroll self-service, payslips, assets, and knowledge search.
- **Employee CLI Wallet** — Canton wallet with Hyperswarm connectivity.

---

## Key Differentiator

| Other Crypto Payroll | TamaFlow |
|----------------------|----------|
| Just send salary | Withholding tax, social security, legal compliance |
| No compliance | Ready for accountants in Japan, Thailand, and beyond |
| No local AI | Local AI generates payslips from settlement data |
| No team collaboration | P2P Hyperswarm for team chat and knowledge sharing |

**TamaFlow is not just about sending crypto — it's about compliant, auditable payroll that accountants can trust.**

---

## Highlighted Features

* **Privacy-First Payroll** — Process sensitive payroll data locally with AI without exposing it to cloud services.
* **AI-Powered Payslip Generation** — Local AI generates formatted payslips from settlement data, supporting Standard, Japanese (給与明細書), and Detailed styles.
* **Payslip Template Manager** — Create, edit, and manage payslip HTML templates with AI assistance. Templates use exact placeholder variables (`{{grossPay}}`, `{{taxAmount}}`, etc.) for accurate data binding.
* **Legal Compliance** — Payment templates encode jurisdiction-specific withholding tax and social security rules (Japan, Thailand, and more).
* **Canton Settlement** — Atomic settlement of multi-route payroll with on-ledger audit trail.
* **Asset Transfer** — Employees can send Canton Coin (CC) to other parties via P2P.
* **Knowledge Base** — RAG-powered document search with P2P relay. Employers manage documents; employees search via the portal.
* **P2P Hyperswarm** — Team chat, payslip delivery, and knowledge sharing via decentralized P2P.
* **Employee Self-Service** — Employees view assets, receive payslips, check in attendance, and claim reward points.
* **Rewards Hub** — Track reward points earned from attendance check-ins.
* **Multi-Currency** — Configure payroll in local fiat while settling securely on Canton.

---

## Quick Start

TamaFlow ships as **three components**: the Employer Client (desktop), the Employee CLI (Node.js), and the Employee Portal (web).

### 1. Employee CLI (local)

The CLI connects to the Canton network and provides P2P Hyperswarm connectivity.

```bash
cd employee-cli
npm install
npm start        # http://localhost:3001
```

### 2. Employer Client (desktop app)

The desktop app is where payroll flows are built and where the on-device Canton wallet lives.

```bash
cd desktop-app
npm install
npm run dev      # launches Electron with hot reload
```

### 3. Employee Portal (web)

The frontend is a Next.js app — run locally or visit the deployed version.

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

---

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  EMPLOYER CLIENT    │    │   EMPLOYEE CLI      │    │  EMPLOYEE PORTAL    │
│  (Desktop App)      │    │   (Node.js)         │    │  (Next.js Web)      │
│                     │    │                     │    │                     │
│ • Flow Builder      │    │ • Canton Wallet     │    │ • View Assets       │
│ • Local AI (QVAC)   │◄──►│ • P2P Hyperswarm    │◄──►│ • View Payslips     │
│ • Payslip Templates │    │ • Team Chat         │    │ • Attendance        │
│ • Knowledge Base    │    │ • Faucet            │    │ • Rewards Hub       │
│ • Canton Settlement │    │ • Asset Transfer    │    │ • Knowledge Search  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    ▼
                    ┌──────────────────────────────┐
                    │      CANTON NETWORK           │
                    │  FiveNorth Seaport DevNet      │
                    │  • Atomic settlement           │
                    │  • On-ledger audit trail        │
                    │  • Withholding tax compliance   │
                    └──────────────────────────────┘
```

---

## Desktop App Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview with company info, stat cards, recent activity, quick actions |
| **Employees** | Manage employee roster with type/status filters, import/export |
| **Flow Builder** | Visual payroll flow canvas with source → payee → payment cards |
| **Payment Settings** | Configure payment templates with withholding tax and social security |
| **Payslips** | 3-panel template manager with AI generation and HTML preview |
| **Assets** | Canton wallet holdings, pending transfers, send CC to others |
| **Attendance** | Daily timesheet check-in with reward points |
| **Knowledge Base** | Manage documents, start/stop embedding model, search test |
| **Settings** | Company profile, contracts, wallet, P2P hyperswarm config |

---

## Employee Portal Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Welcome card, onboarding steps, recent payslips, quick actions |
| **Assets** | View holdings, accept/reject pending transfers, send CC |
| **Attendance** | Check-in timesheet, view check-in history |
| **Payslips** | View received payslips with HTML preview |
| **Rewards Hub** | Track reward points from attendance check-ins |
| **Knowledge Base** | Search company documents via P2P relay |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop runtime | Electron 39 |
| Desktop bundler | electron-vite 5 + Vite 7 |
| Desktop UI | React 19 + Tailwind 3 + framer-motion 11 |
| Desktop wallet | @canton-network/wallet-sdk 1.3 |
| Desktop local AI | @qvac/sdk 0.13 |
| Desktop RAG | @qvac/rag (vector search with GTE-Large embeddings) |
| CLI | Node.js + Express + @canton-network/wallet-sdk |
| CLI P2P | Pear Runtime (Hyperswarm + Autobase) |
| Web framework | Next.js 16 (App Router) |
| Web UI | React 19 + Tailwind v4 + framer-motion 12 |
| Ledger | Canton Network (FiveNorth DevNet) |
| Language | TypeScript 5 |

---

## Knowledge Base

The Knowledge Base uses RAG (Retrieval-Augmented Generation) for document search:

1. **Start Service** — Load the embedding model (GTE-Large) on the desktop app
2. **Add Documents** — Import text content or fetch from URLs
3. **Search** — Employees search via the portal; queries relay through P2P

```
Desktop App (Employer)          Employee Portal
┌─────────────────┐            ┌─────────────────┐
│ Start Service   │            │ Search Query    │
│ Add Documents   │            │ Results Display │
│ Search Test     │            └────────┬────────┘
└────────┬────────┘                     │
         │                              │ P2P Relay
         ▼                              ▼
┌─────────────────────────────────────────────────┐
│              P2P Hyperswarm                      │
│  rag-search frame → rag-search-result frame      │
└─────────────────────────────────────────────────┘
```

---

## Payslip Templates

Templates use `{{placeholder}}` syntax for data binding:

| Placeholder | Description |
|-------------|-------------|
| `{{companyName}}` | Company name |
| `{{period}}` | Pay period (e.g., "June 2026") |
| `{{employeeName}}` | Employee name |
| `{{grossPay}}` | Gross pay before deductions |
| `{{netPay}}` | Net pay after deductions |
| `{{taxAmount}}` | Tax deduction amount |
| `{{socialSecurity}}` | Social security deduction |
| `{{withholding}}` | Withholding deduction |
| `{{currency}}` | Currency code (JPY, USD, etc.) |
| `{{fxRate}}` | FX conversion rate |

---

## API Endpoints (Employee CLI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/wallet/status` | Wallet status |
| POST | `/api/wallet/create` | Create wallet |
| POST | `/api/wallet/faucet` | Mint test tokens |
| GET | `/api/holdings` | List holdings |
| POST | `/api/transfer` | Send CC to another party |
| GET | `/api/pending-transfers` | List pending transfers |
| POST | `/api/contracts/accept` | Accept pending transfer |
| POST | `/api/contracts/reject` | Reject pending transfer |
| GET | `/api/payslips` | List received payslips |
| POST | `/api/rag/search` | Search knowledge base |

---

## Coming Soon

* **AI Chat** — Employees ask questions about their compensation, benefits, and company policies.
* **Global Teams** — Multi-country payroll with jurisdiction-specific compliance.
* **Reward Redemption** — Exchange reward points for benefits and perks.

---

## License

TBD.
