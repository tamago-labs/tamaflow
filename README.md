# TamaFlow - AI Auto-Payroll on Canton for Global Teams

> **Paying salaries is easy. Running compliant payroll is not**

<img width="810" height="463" alt="Screenshot 2026-07-19 091331" src="https://github.com/user-attachments/assets/16dbbe0a-2f06-443b-9a4f-289b7f693cc1" />

---

## What is TamaFlow?

TamaFlow is a privacy-first, decentralized payroll platform built to bridge the gap between Web3 settlement and real-world payroll compliance. Most crypto payroll solutions stop at Wallet A → Wallet B. They transfer salaries but leave companies to manually handle withholding tax, social security, localized payslips, and jurisdiction-specific payroll requirements.

TamaFlow combines **Local AI**, **Canton**, and **P2P Hyperswarm** into a unified payroll platform:

1. **Local AI** — Generate localized payslips, manage AI-assisted HTML templates, and power a private knowledge base without exposing sensitive payroll data to cloud services.
2. **Canton** — Facilitates private payroll settlements using DAML smart contracts to manage daily attendance check-ins and reward point tracking.
3. **P2P Hyperswarm** — Provides a secure, peer-to-peer network layer for distributing payslips, sharing corporate data, and enabling direct collaboration.

### Components

- **Employer Client** — Electron desktop app for payroll management, local AI, and Canton settlements.
- **Employee CLI Wallet** — Node.js CLI for P2P Hyperswarm connectivity, Canton wallet, and employee self-service.
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

## Why Canton?

| Feature | Without Canton | With Canton | Status |
|---------|---------------|-------------|--------|
| Atomic payroll settlement | Multiple txs + risk | Single atomic transaction | ✅ Live |
| Privacy of salary data | Public or centralized | Selective disclosure (employer/employee only) | ✅ Live |
| Compliance audit trail | Off-chain logs | On-ledger immutable records | ✅ Live |
| Multi-token support | Fragile | Native Splice/CIP-56 compatible | CC, JPYC  |

**Privacy Proof:** Employee parties only see their own `EmployeeRecord` and `PayslipRecord` contracts.

---

## Deployment (Canton Devnet)

| Module | Party ID / URL |
|--------|---------------------|
| Employee Demo Wallet | [`employee::12203ca86b7046226e7e69797ac81501e6e585c5e7574db9b34133ac27bd5def150a`](https://lighthouse.devnet.cantonloop.com/party/employee%3A%3A12203ca86b7046226e7e69797ac81501e6e585c5e7574db9b34133ac27bd5def150a) |
| Employer Demo Wallet | [`ohm-ohm::1220efe57cb13a797e531d4ad1b24c6b15e9b4fd02d77feddccde8ec06af7dd9e080`](https://lighthouse.devnet.cantonloop.com/party/ohm-ohm%3A%3A1220efe57cb13a797e531d4ad1b24c6b15e9b4fd02d77feddccde8ec06af7dd9e080) |
| Employee CLI Wallet | [d3pgy5i52ev547.cloudfront.net](https://d3pgy5i52ev547.cloudfront.net/api/health) |
| Company Contract | `00ff8857228d7f5f372ee72716f1e0ef30d958e6a1bdd49c1c3ab43f73d5a8a491ca121220d7df1d1bc05edadc3ba23f39700482694fa67dd29740f1741010ac674f4aba31` |
| JPYC Contract | `004e69cbb45b5eefbd0aea9c25b08e0c9ab0c939465edd37a682186742f22f8251ca121220aa7b12404e511df0ce86ad6357329790ee8f77add1507b781874fa8ba826f93f`  | 

Custom contracts are not available on the Lighthouse block explorer. You may need to use Seaport and provide contract IDs manually.

### Template IDs

```js
const PACKAGE_ID = '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48'

const TEMPLATES = {
  COMPANY_PROFILE: `${PACKAGE_ID}:TamaFlow.Company.CompanyProfile:CompanyProfile`,
  EMPLOYEE_RECORD: `${PACKAGE_ID}:TamaFlow.Company.EmployeeRecord:EmployeeRecord`,
  JPYC_ASSET: `${PACKAGE_ID}:TamaFlow.JPYC.Asset:JPYCAsset`,
  PAYSIP_RECORD: `${PACKAGE_ID}:TamaFlow.Company.PayslipRecord:PayslipRecord`,
}
```

---

## Quick Start

### Employee

<img width="674" height="398" alt="Screenshot 2026-07-18 114242" src="https://github.com/user-attachments/assets/330e174e-7ec7-4ee8-8741-f446a8371a8b" />

1. **Open the Portal** — Visit the live demo at [tamaflow.vercel.app](https://tamaflow.vercel.app)
2. **Setup Your Wallet** — Use the Employee CLI wallet locally or use the [pre-hosted demo wallet](https://d3pgy5i52ev547.cloudfront.net/api/health) on AWS for faster testing
3. **View Payslips** — Open the Payslips page to access payroll documents sent by your employer
4. **Manage Assets** — Review payroll payments and transfer Canton Coin (CC) to external wallets when needed
5. **Daily Check-In** — Perform your daily check-in on-chain to verify your attendance and earn reward points.
6. **Chat & Search Knowledge** — Chat with your team or search the company handbook with AI. *The employer's desktop app needs to be online.*

<img width="402" height="187" alt="Screenshot 2026-07-18 114348" src="https://github.com/user-attachments/assets/b6a233c8-95f3-4791-b185-d0a5848d2be9" />

### Employer

<img width="477" height="266" alt="Screenshot 2026-07-18 195618" src="https://github.com/user-attachments/assets/7e63df8f-3a83-4fe7-b214-8af0598f4d89" />

1. **Launch the App** — Open the desktop app on your computer
2. **Configure Your Company** — Use the default Tamago Labs or deploy your own contracts and update the settings
3. **Add Employees** — Configure salary, tax, pension, and social security information
4. **Create Payment Rules** — Build payment templates for direct salary, withholding tax, and social security deductions
5. **Build the Payroll Flow** — Connect wallets, employees, and payment rules using the visual flow builder
6. **Review Payroll** — Verify net salary, deductions, and live fiat conversion before settlement
7. **Run Payroll** — Click Start. The system will process payments one by one. If one employee's payment fails, you can retry just that step without duplicating successful payments
8. **Generate Payslips** — Use Local AI to generate localized HTML payslips and customize them when needed

### How to Setup

#### Prerequisites

- **Node.js** v22+ (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- **Java 17+** and **Daml SDK 3.5.1** (only needed for smart contract development)
- **Git** for cloning the repository

```bash
git clone https://github.com/tamago-labs/tamaflow.git
cd tamaflow
```

#### 1. Employee CLI Wallet

The CLI wallet provides Canton wallet management and P2P Hyperswarm connectivity. Run it locally or deploy to a server.

```bash
cd employee-cli
npm install
npm start                    # Starts on http://localhost:3001

# Optional: connect to a P2P room
npm run connect              # Connects with invite code
```

The CLI wallet stores its data in `.wallet.json` and `~/.tamaflow-cli/` (Pear Corestore). On first run, it creates a new Canton wallet automatically.

#### 2. Employer Desktop App

The Electron desktop app is where payroll flows are built, employees are managed, and Canton settlements are processed.

```bash
cd desktop-app
npm install
npm run dev                  # Launches Electron with hot reload
```

**First-time setup:**
1. Open Settings → Company Profile and configure your company details
2. Open Settings → Wallet to create or import your Canton wallet
3. The embedding model for AI features downloads automatically on first use

#### 3. Employee Portal

The employee portal is a web app for viewing payslips, assets, attendance, and rewards.

```bash
cd frontend
npm install
npm run dev                  # Starts on http://localhost:3000
```

The portal connects to the Employee CLI wallet. Either run the CLI locally or use the demo wallet for testing.

---

## Data Structure

Following data structure is GDPR clean by design — sensitive data stays local or on-chain with selective disclosure.

| Data | Local Storage | On-Chain (Canton) | P2P Sync |
|------|--------------|-------------------|----------|
| **Company** | Full profile (name, country, templates, settings) | Company name, country | — |
| **Employee** | Full record (salary, tax, pension, role) | Name, role | — |
| **Attendance** | — | Block count, status, timestamps | — |
| **Reward Points** | — | Running total | — |
| **Payslip Content** | HTML template + rendered payslip | Reference ID, period, status | ✅ Hyperswarm |
| **Chat Messages** | — | — | ✅ Hyperswarm |
| **Knowledge Base** | Full documents (employer) | — | ✅ P2P relay |
| **Wallet** | Encrypted keys + UTXOs | — | — |
| **Room State** | Corestore + invites | — | ✅ Hyperswarm |

---

## Architecture

<img width="2720" height="1800" alt="canton_payroll_architecture_v3" src="https://github.com/user-attachments/assets/db5900c8-d6e4-496d-bea1-081d34645ab6" />

---

## Smart Contracts

### Package Structure

```
contracts/daml/TamaFlow/
├── Company/
│   ├── Types.daml                # BlockStatus, BlockInfo types
│   ├── CompanyProfile.daml       # Company on-chain profile + payslip creation
│   ├── EmployeeRecord.daml       # Employee-company link + attendance + points
│   └── PayslipRecord.daml        # Lightweight payslip reference on-ledger
├── JPYC/
│   ├── Types.daml                # Token constants
│   ├── Asset.daml                # Token holding (Split/Transfer/Merge)
│   └── Issuer.daml               # Admin mints tokens
└── Tests/
    ├── JPYCTest.daml             # JPYC token tests
    ├── CompanyTest.daml          # Company + attendance tests
    └── E2ETest.daml              # Full employee lifecycle test
```


### CompanyProfile

Employer creates company on-chain. Admin creates, employer manages.

| Field | Type | Description |
|-------|------|-------------|
| admin | Party | Signatory (company admin) |
| employer | Party | Observer (manages employees) |
| companyName | Text | Company name |
| country | Text | Country code |

**Choices:**

| Choice | Controller | Return | Description |
|--------|------------|--------|-------------|
| `AddEmployee` | employer | `ContractId EmployeeRecord` | Link employee to company (nonconsuming) |
| `CreatePayslip` | employer | `ContractId PayslipRecord` | Register payslip on-ledger (nonconsuming) |

### EmployeeRecord

Employer links employees to company. Employee observes. Contains attendance blocks and reward points.

| Field | Type | Description |
|-------|------|-------------|
| employer | Party | Signatory |
| employee | Party | Observer |
| companyName | Text | Company name |
| displayName | Text | Employee name |
| role | Optional Text | Job role |
| blocks | TextMap BlockInfo | Attendance blocks (keyed by timestamp) |
| points | Int | Reward points (starts at 0) |

**Choices:**

| Choice | Controller | Return | Description |
|--------|------------|--------|-------------|
| `CheckIn` | employee | `ContractId EmployeeRecord` | Add attendance block + award points |
| `ConfirmBlock` | employer | `ContractId EmployeeRecord` | Confirm a block |
| `RejectBlock` | employer | `ContractId EmployeeRecord` | Reject a block |

**Points Logic:**

| Event | Points Added | Running Total |
|-------|-------------|---------------|
| First CheckIn (points == 0) | +1000 | 1000 |
| Subsequent CheckIn | +10 | 1000 + (n × 10) |

**Note:** All choices are consuming — each exercise archives the old contract and creates a new one with updated blocks and points.

### PayslipRecord

Lightweight payslip reference on-ledger. Employer creates via CompanyProfile.

| Field | Type | Description |
|-------|------|-------------|
| employer | Party | Signatory |
| employee | Party | Observer |
| payslipId | Text | Unique payslip identifier |
| period | Text | Pay period (e.g. "2026-07") |
| status | PayslipStatus | Sent or Viewed |
| createdAt | Time | Creation time |

### JPYCAsset

Token holding with UTXO model.

| Field | Type | Description |
|-------|------|-------------|
| issuer | Party | Signatory (minted by) |
| owner | Party | Observer (current holder) |
| amount | Decimal | Balance |
| instrumentId | Text | Always "JPYC" |
| observers | [Party] | Additional observers |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `Split` | owner | Split into payment + change UTXOs |
| `TransferAsset` | owner | Transfer to new owner |
| `MergeWith` | owner | Merge two same-owner UTXOs |

### Integration

1. **Attendance:** EmployeeRecord stores attendance blocks and reward points
2. **Payslips:** CompanyProfile.CreatePayslip creates on-ledger reference. Actual content sent via P2P
3. **Rewards:** Points embedded in EmployeeRecord — 1000 on first check-in, 10 each subsequent
4. **Payments:** JPYC Asset Split/Transfer for token payments

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

## License

MIT
