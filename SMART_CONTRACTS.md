# TamaFlow Smart Contracts

Canton/Daml smart contracts for the TamaFlow payroll platform.

## Setup

```bash
cd contracts
dpm build
dpm test
```

Requires Daml SDK 3.5.1 and Java 17+.

---

## Package Structure

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

---

## Company

### Types

```daml
data BlockStatus = Open | Confirmed | Rejected

data BlockInfo = BlockInfo
  with
    blockStart : Time
    blockEnd : Time
    status : BlockStatus
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

**Flow:**
```
Employer creates EmployeeRecord (points = 0)
                    ↓
Employee check-in → +1000 points (first) or +10 points (subsequent)
                    ↓
EmployeeRecord (new version with block + updated points)
                    ↓
Employer reviews → ConfirmBlock/RejectBlock
```

**Note:** All choices are consuming (default) — each exercise archives the old contract and creates a new one with updated blocks and points. Only one EmployeeRecord per employee exists at any time.

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

**PayslipStatus:** `Sent | Viewed`

**Note:** This is a reference only — actual payslip content (markdown, amounts) is sent via P2P. Uniqueness enforced off-chain.

---

## JPYC Token

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

### JPYCIssuer

Admin mints unlimited JPYC tokens.

| Field | Type | Description |
|-------|------|-------------|
| admin | Party | Signatory |
| instrumentId | Text | Token identifier |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `Mint` | admin | Mint JPYC to any owner (nonconsuming) |

---

## Tests

### CompanyTest

| Test | Description |
|------|-------------|
| testCreateCompany | Employer creates company |
| testAddEmployee | Employer adds employee |
| testListCompanies | Query all companies |
| testMultipleEmployees | Add Alice and Bob |
| testCheckIn | Employee creates block |
| testConfirmBlock | Employer confirms |

### JPYCTest

| Test | Description |
|------|-------------|
| testMint | Mint JPYC tokens |
| testSplitAndTransfer | Split and transfer tokens |
| testMerge | Merge two UTXOs |

### E2ETest

Full employee lifecycle:
1. Employer creates company
2. Employer adds employee
3. Employee does check-ins (earns points)
4. Employer mints and sends JPYC
5. Employee checks balance

---

## Deployment

### Canton DevNet

1. Build: `dpm build`
2. Upload DAR to Canton DevNet
3. Allocate parties: admin, employee, employer
4. Create `JPYCIssuer` with admin party
5. Mint initial JPYC: `Mint`

### Integration with Desktop App

1. **Attendance:** EmployeeRecord stores attendance blocks and reward points. Desktop app reads blocks for payroll calculations.
2. **Payslips:** CompanyProfile.CreatePayslip creates on-ledger reference. Actual content sent via P2P.
3. **Rewards:** Points are embedded in EmployeeRecord. First check-in awards 1000 points, subsequent check-ins award 10 points each.
4. **Payments:** JPYC Asset Split/Transfer for token payments.

---

## Future Improvements

- [ ] Upgrade to LF 2.3+ for contract keys (uniqueness on-ledger)
- [ ] Add attendance summary/aggregation contract
- [ ] Connect Oracle to desktop app priceProvider
- [ ] Add Company update choice (archive + recreate pattern)
