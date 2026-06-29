# TamaFlow - AI Auto-Payroll on Canton


> **Stop leaking corporate finances to third-party cloud LLMs.** Import sensitive data locally, verify employees with 5N ID, and let AI run payroll end-to-end on Canton.

<img width="953" height="499" alt="Screenshot 2026-06-29 115350" src="https://github.com/user-attachments/assets/3b88dd84-b61e-4806-9d8a-bcaacc618446" />

---

## What is TamaFlow?

TamaFlow is a **privacy-first AI payroll platform** built for modern companies operating on Canton. It keeps sensitive payroll data entirely within the employer's local environment while using AI to automate payroll workflows and Canton to coordinate secure, auditable settlements.

TamaFlow consists of two applications: an **Employer Client** for managing payroll operations with local AI, and an **Employee Portal** where employees verify their identity with 5N ID, receive payments, and access payroll statements. Together, they provide an end-to-end payroll experience without exposing confidential financial data to third-party cloud AI services.

- **Employer Client** — Electron desktop app for payroll management, AI-powered workflows, and Canton settlements.
- **Employee Portal** — Next.js web app for employee identity verification, payment history, assets, and statements.
- **Settlement** — Canton Network (FiveNorth Seaport Validator DevNet by default).
- **Identity** — 5N ID SDK for secure employee identity verification on Canton.

---

## Highlighted Features

* **Privacy-First Payroll** — Process sensitive payroll data entirely within the employer's local environment without exposing it to third-party cloud LLMs.
* **AI-Powered Payroll Automation** — Local AI reviews payroll documents, extracts employee data, flags anomalies, and automates approval workflows while keeping data on-device.
* **Visual Flow Builder** — Design payroll workflows with a drag-and-drop canvas, defining approval steps and payment routing before execution.
* **Atomic Settlement on Canton** — Execute payroll as a single atomic settlement on Canton, ensuring every payment succeeds together or none are processed.
* **Employee Identity Verification** — Verify employees using 5N ID before payroll is approved and settled.
* **Employee Self-Service Portal** — Employees can verify their identity, view assets, receive payroll, and download payroll statements through a dedicated web portal.
* **Multi-Currency Payroll** — Configure payroll in local fiat currencies while settling securely on Canton.
* **Auditable Payment Records** — Every payroll settlement is recorded on Canton, providing a transparent and verifiable audit trail.

---

## Why It Matters

| The problem | What TamaFlow does about it |
| --- | --- |
| Cloud LLMs ingest sensitive payroll documents — a single breach exposes every employee's compensation. | Parsing happens on-device via a local LLM (`@qvac/sdk`). No document ever leaves the operator's machine. |
| Cross-border payroll relies on banks and SWIFT, with multi-day delays and opaque fees. | Settlement is on Canton — atomic, near-instant, and visible to all parties in real time. |
| Tax withholding and social-security remittance are manually calculated and easy to get wrong. | Payment Templates encode the jurisdiction's withholding rules; the worker applies them per route automatically. |
| Audit trails live inside vendor databases you don't control. | Every settled route is an on-ledger transaction with a Canton tx hash — verifiable by anyone with read access. |
| One bad leg in a payroll run leaves employees partially paid. | All routes in a flow settle in a single atomic transaction; either every employee gets paid or none of them do. |
| Recipients have no portable view of what they were paid or why. | The Employee Portal (browser, Loop wallet) gives each recipient a Canton-party-scoped statement. |

---

## Quick Start

TamaFlow ships as **two apps**. The desktop Employer Client is where payroll is built; the web Employee Portal is where recipients view what they were paid. You can run either one independently, but the full loop is best demonstrated with both running.

### 1. Employer Client (desktop app)

The desktop app is the primary surface — it's where payroll flows are built and where the on-device Canton wallet lives.

```bash
cd desktop-app
npm install
npm run dev      # launches Electron with hot reload
```

For a production-style build:

```bash
npm run build
npm run build:win    # Windows .exe
npm run build:mac    # macOS .dmg
npm run build:linux  # Linux AppImage / .deb
```

Once the app is open:

1. **Settings → Wallet** — create or import your Canton wallet. The desktop app holds the key (encrypted with `safeStorage`); the app derives your party ID locally.
2. **Drag a roster onto the canvas** — drop a CSV or PDF; the local parser populates Employee cards (full AI parsing ships in v2 — for now the manual entry / CSV path is the supported flow).
3. **Drop Payment Templates** from the palette — choose Direct, US 27%, JP withholding, Bonus, or a custom template.
4. **Wire Employee → Template** with a connector — each connector becomes a *route* in the flow.
5. **Press Run** — the worker submits the flow to Canton; settled routes appear in the table with their tx hash.

Releases are published on the GitHub repo: **https://github.com/tamago-labs/tamaflow**.

### 2. Employee Portal (web app)

The frontend is a Next.js app — run it locally for development or visit the deployed version.

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

Open **http://localhost:3000** and:

1. Land on the public landing page — read the value prop and watch the demo screenshot.
2. Click **I'm an Employee** to enter the Employee Portal at `/app`.
3. The dashboard opens with a welcome modal explaining the dev environment.
4. Connect your **Loop wallet** (top-right) — once connected, your Canton party ID appears under **Settings → Wallet**.
5. Once an Employer Client run has settled a payment to your party, it shows up under **Statement** and on the dashboard's **Recent Activity**.

The deployed version lives at the URL in the footer of `frontend/components/landing/Footer.tsx`.

---

## Architecture / How It Works

TamaFlow is split into three layers: the **Employer Client** (desktop, signs locally), the **Employee Portal** (browser, signs via Loop), and the **Canton Network** (ledger, settles atomically).

```
┌───────────────────────────────┐         ┌───────────────────────────────┐
│   EMPLOYER CLIENT (desktop)   │         │   EMPLOYEE PORTAL (browser)   │
│   Electron + React + Vite     │         │   Next.js + React             │
│                               │         │                               │
│  • Drag-and-drop flow canvas  │         │  • Loop wallet connect        │
│  • Local AI (QVAC)            │         │  • Canton party ID display    │
│  • On-device Canton wallet    │         │  • Statement / activity feed  │
│  • Worker: settle on Canton   │         │  • Quick actions (download)   │
└──────────────┬────────────────┘         └────────────────┬──────────────┘
               │                                           │
               │  signs locally with                        │  signs via Loop
               │  safeStorage-encrypted key                 │  browser popup
               │                                           │
               ▼                                           ▼
        ┌──────────────────────────────────────────────────────────┐
        │                  CANTON NETWORK                          │
        │  FiveNorth Seaport Validator DevNet (default network)    │
        │                                                          │
        │  • Atomic settlement — one transaction per payroll run   │
        │  • On-ledger UTXOs (CC / Amulet) — parties' balances     │
        │  • tx hash per route → auditable                         │
        └──────────────────────────────────────────────────────────┘
```

### Employer Client (desktop-app)

- **Stack** — Electron 39 + electron-vite 5 + React 19 + TypeScript 5. Built with Vite 7 for the renderer, esbuild for the main process.
- **Wallet** — `@canton-network/wallet-sdk`. The on-device key is encrypted with Electron's `safeStorage` and persisted to `<userData>/wallet.json`. Two-step Splice transfers are handled by a hand-rolled `transfer.ts` that bypasses the SDK's `token.transfer.create()` (FiveNorth's DevNet doesn't expose the metadata registry endpoints that path needs).
- **Local AI** — `@qvac/sdk`. v1 ships the wiring; the actual roster/document parsing UI surfaces in v2 (see the "Coming soon" badge on the AI feature card).
- **Flow worker** — `flows:onProgress` IPC event pushes route status transitions to the renderer; no polling needed.
- **Routing** — `react-router-dom` 7.
- **Persistence** — Flows, routes, employees, and company profiles are JSON files under `<userData>/` (see `routeStore.ts`, `flowStore.ts`, `EmployeeStore`, `CompanyStore`).

### Employee Portal (frontend)

- **Stack** — Next.js 16 (App Router) + React 19 + Tailwind v4 + framer-motion.
- **Wallet** — `@fivenorth/loop-sdk`. The browser wallet signs via popup (`requestSigningMode: 'popup'`).
- **Pages** — `/` (public landing), `/app/*` (portal: dashboard, statement, payments, identification, settings).
- **State** — React Context only; no external state library. Most pages are mock-data for v1 (no backend) — the production wiring is the desktop app's actual ledger.

### Canton Network

- **Network** — FiveNorth Seaport Validator DevNet (default). Switchable via env var.
- **Settlement** — Each payroll run submits one Canton `prepare/execute` cycle that exercises every route atomically.
- **CC / Amulet** — Canton's native coin (10-decimal). User-input amounts are zero-padded to `100.0000000000` before submission.
- **UTXOs** — A party's balance is the sum of its `Holding` contracts; there is no `getBalance()` call. The wallet aggregates UTXOs by `instrumentId` for display.

---

## Project Layout

```
tamaflow/
├── desktop-app/        # Electron Employer Client (Vite + React 19)
│   ├── src/
│   │   ├── main/       # Node-side: wallet, flows, routes, workers
│   │   ├── preload/    # IPC bridge to the renderer
│   │   └── renderer/   # React UI (flow canvas, modals, pages)
│   └── package.json
├── frontend/           # Next.js 16 Employee Portal (Tailwind v4)
│   ├── app/            # App Router pages (/, /app/*)
│   ├── components/     # Shared + per-section components
│   └── package.json
└── scripts/            # Canton smoke-test scripts (01-faucet, 02-wallet, 03-transfer)
```

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Desktop runtime | Electron 39 |
| Desktop bundler | electron-vite 5 + Vite 7 |
| Desktop UI | React 19 + react-router-dom 7 + Tailwind 3 + framer-motion 11 |
| Desktop wallet | `@canton-network/wallet-sdk` 1.3 |
| Desktop local AI | `@qvac/sdk` 0.13 |
| Web framework | Next.js 16 (App Router) |
| Web UI | React 19 + Tailwind v4 + framer-motion 12 + lucide-react |
| Web wallet | `@fivenorth/loop-sdk` 0.13 |
| Ledger | Canton Network (FiveNorth DevNet) |
| Language | TypeScript 5 |

---

## Status

- ✅ Desktop flow builder (drag-and-drop canvas, payment templates, multi-route flows)
- ✅ On-device Canton wallet (create / transfer / accept / holdings view)
- ✅ Atomic settlement of multi-route payroll runs
- ✅ Employee Portal (landing + dashboard + wallet connect + statement mock)
- 🚧 AI-assisted payroll (QVAC SDK wired; UI surfaces in v2 — see "Coming soon" pill)
- 🚧 5N ID KYC verification (credential issuance + on-ledger proof — in progress)

---

## License

TBD.
