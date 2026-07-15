# TamaFlow - AI Auto-Payroll on Canton for Global Teams


> **Legal, regulatory-compliant crypto payroll with withholding tax, social security, and local AI — ready for accountants in Japan, Thailand, and beyond.**

<img width="953" height="499" alt="Screenshot 2026-06-29 115350" src="https://github.com/user-attachments/assets/3b88dd84-b61e-4806-9d8a-bcaacc618446" />

---

## What is TamaFlow?

TamaFlow is an **AI-powered payroll platform** built for global teams operating on Canton. Unlike other crypto payroll solutions that simply send salary, TamaFlow handles **withholding tax, social security, and legal/regulatory compliance** — ready for accountants in Japan, Thailand, and other countries.

TamaFlow uses **local AI** to generate payslips, automates payroll workflows, and settles atomically on Canton. Employees receive their payslips via P2P Hyperswarm and can chat with AI about their compensation through a shared knowledge base.

- **Employer Client** — Electron desktop app for payroll management, local AI, and Canton settlements.
- **Employee CLI** — Node.js CLI for P2P Hyperswarm connectivity, Canton wallet, and employee self-service.
- **Employee Portal** — Next.js web app for viewing assets, payslips, attendance, and rewards.
- **Settlement** — Canton Network (FiveNorth Seaport Validator DevNet).

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
* **Legal Compliance** — Payment templates encode jurisdiction-specific withholding tax and social security rules (Japan, Thailand, and more).
* **Canton Settlement** — Atomic settlement of multi-route payroll with on-ledger audit trail.
* **P2P Hyperswarm** — Team chat, payslip delivery, and knowledge sharing via decentralized P2P.
* **Employee Self-Service** — Employees view assets, receive payslips, check in attendance, and claim reward points.
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
│ • Payslip Generation│    │ • Team Chat         │    │ • Attendance        │
│ • Canton Settlement │    │ • Faucet            │    │ • Rewards Hub       │
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

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop runtime | Electron 39 |
| Desktop bundler | electron-vite 5 + Vite 7 |
| Desktop UI | React 19 + Tailwind 3 + framer-motion 11 |
| Desktop wallet | @canton-network/wallet-sdk 1.3 |
| Desktop local AI | @qvac/sdk 0.13 |
| CLI | Node.js + Express + @canton-network/wallet-sdk |
| CLI P2P | Pear Runtime (Hyperswarm + Autobase) |
| Web framework | Next.js 16 (App Router) |
| Web UI | React 19 + Tailwind v4 + framer-motion 12 |
| Ledger | Canton Network (FiveNorth DevNet) |
| Language | TypeScript 5 |

---

## Coming Soon

* **Knowledge Base** — Team-shared documents that employees can chat with via AI.
* **AI Chat** — Employees ask questions about their compensation, benefits, and company policies.
* **Global Teams** — Multi-country payroll with jurisdiction-specific compliance.

---

## License

TBD.
