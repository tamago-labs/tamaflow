# TamaFlow

## AI Auto-Payroll on Canton

---

> **Stop leaking corporate finances to third-party cloud LLMs.** Import sensitive data locally, verify employees with 5N ID, and let AI run payroll end-to-end on Canton.

---

## What is TamaFlow?

TamaFlow is a **privacy-first payroll stack** for companies that pay people across borders. Sensitive employee data — rosters, compensation, tax IDs — never leaves the operator's machine, yet settlement happens on a public, auditable ledger (the Canton Network). Two apps ship together: a desktop **Employer Client** where the operator builds payment flows, and a web **Employee Portal** where recipients can see what they were paid and why.

The desktop app is the workhorse: a drag-and-drop canvas where you wire **Employee cards → Payment Templates** (direct pay, US-style withholding, JP-style withholding, bonus, custom) into a single atomic flow. When you press **Run**, every route settles in **one Canton transaction** — either every employee gets paid or none of them do. There is no partial state, no manual reconciliation, and no third-party LLM has ever read a payroll file.

The Employee Portal is a thin, browser-based wallet view. An employee connects their **Loop wallet** (a Canton-compatible browser wallet), sees their **Canton party ID**, and can later see incoming payments, download statements, and (eventually) bridge out to Ethereum. v1 of the portal is intentionally minimal — it shows what's already settled on-ledger and tells you what you can do next.

- **Employer Client** — Electron desktop app. Drag-and-drop flow builder, local AI roster parsing (in v2), on-device Canton wallet.
- **Employee Portal** — Next.js web app. Browser-wallet connect, statement view, payment alerts.
- **Ledger** — Canton Network (FiveNorth Seaport Validator DevNet by default).
- **Wallet** — Local Canton wallet in the desktop app; Loop wallet in the browser.

---

## Highlighted Features

- **🔒 Private Payroll** — Compensation is visible only to the parties authorised to see it; no third-party LLM, no intermediary, no leak surface.
- **⚡ Atomic Settlement on Canton** — Every payroll run settles in a single on-ledger transaction; all parties commit or none do.
- **🤖 AI-Assisted Payroll** — Local AI parses payroll documents, flags anomalies, and surfaces what needs review — sensitive data never leaves your machine. *(Coming soon)*
- **🧩 Drag-and-Drop Flow Builder** — Compose multi-step payroll runs visually: drop Employees, attach Payment Templates, wire them with intent-carrying connectors.
- **🪪 5N ID KYC** — Verify employee identity against a Tamago Labs-issued credential before unlocking payouts.
- **💱 Multi-Currency Payroll** — Pay each route in its native currency (JPY, USD, EUR, …) and settle the underlying transfer in CC (Canton's native coin) on-ledger.
- **🧾 On-Ledger Audit Trail** — Every settled route carries a transaction hash; nothing is hidden in a vendor's database.
- **🔁 Re-Send on Failure** — A failed route can be retried in isolation without rerunning the whole flow.

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
├── scripts/            # Canton smoke-test scripts (01-faucet, 02-wallet, 03-transfer)
├── example-scripts/    # 13 reference TypeScript scripts (SDK examples)
└── example-sdk/        # Canton wallet SDK reference docs
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

## Contributing

PRs welcome. The repo is split into three independently shippable units — the **desktop app**, the **frontend**, and the **scripts/** smoke tests — so a small change usually only needs `npm install` in one of them.

```bash
git clone https://github.com/tamago-labs/tamaflow
cd tamaflow
```

Then follow the **Quick Start** steps above for whichever app you're touching.

---

## License

TBD.