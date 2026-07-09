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
│   ├── CompanyProfile.daml       # Company on-chain profile
│   └── EmployeeRecord.daml       # Employee-company link
├── JPYC/
│   ├── Types.daml                # Token constants
│   ├── Asset.daml                # Token holding (Split/Transfer/Merge)
│   ├── Issuer.daml               # Admin mints tokens
│   └── Faucet.daml               # Per-address claim limits
├── Attendance/
│   ├── Types.daml                # BlockStatus enum
│   ├── TimeBlock.daml            # Employee check-in block
│   └── AttendanceRecord.daml     # Immutable audit record
├── Oracle/
│   └── PriceFeed.daml            # Manual price updates
└── Tests/
    ├── JPYCTest.daml             # 7 tests
    ├── CompanyTest.daml          # 3 tests
    ├── AttendanceTest.daml       # 4 tests
    ├── OracleTest.daml           # 3 tests
    └── E2ETest.daml              # 1 test (full flow)
```

---

## Company

### CompanyProfile

Employer creates company on-chain.

| Field | Type | Description |
|-------|------|-------------|
| employer | Party | Signatory (company admin) |
| companyName | Text | Company name |
| country | Text | Country code |

**Choices:** None (immutable — archive and recreate to update)

### EmployeeRecord

Employer links employees to company. Employee observes.

| Field | Type | Description |
|-------|------|-------------|
| employer | Party | Signatory |
| employee | Party | Observer |
| companyName | Text | Company name |
| displayName | Text | Employee name |
| role | Optional Text | Job role |
| createdAt | Time | Creation time |

---

## JPYC Token

### Constants

| Name | Value | Notes |
|------|-------|-------|
| tokenSymbol | JPYC | |
| tokenName | JPYC Token | |
| tokenDecimals | 10 | CIP-0056 requires 10 (Daml Decimal type) |
| instrumentIdText | JPYC | |

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

### Faucet

Per-address claim limits. Admin creates, users claim.

| Field | Type | Description |
|-------|------|-------------|
| admin | Party | Signatory |
| issuer | Party | Token issuer for minting |
| publicObserver | Party | Public party for visibility |
| instrumentId | Text | Token identifier |
| perClaimLimit | Decimal | Max per address |
| totalClaimed | Decimal | Running total |
| claims | TextMap Decimal | Address → amount claimed |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `Claim` | claimant | Claim JPYC from faucet (nonconsuming) |
| `GetFaucetInfo` | admin | Get faucet stats |

**Note:** In production, requires a public observer party so claimants can see the Faucet contract.

---

## Attendance

### BlockStatus

```
data BlockStatus = Open | Confirmed | Rejected
```

### TimeBlock

Employee check-in block. Employee creates, employer confirms/rejects.

| Field | Type | Description |
|-------|------|-------------|
| employee | Party | Signatory (checks in) |
| employer | Party | Observer (reviews later) |
| blockStart | Time | Block start time |
| blockEnd | Time | Always blockStart + 1 hour |
| status | BlockStatus | Current status |
| note | Optional Text | Optional description |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `ConfirmBlock` | employer | Confirm attendance |
| `RejectBlock` | employer | Reject with reason |
| `CloseBlock` | employee | Self-close after block ends |

**Flow:**
```
Employee check-in → TimeBlock (Open)
                    ↓
Employer reviews → ConfirmBlock/RejectBlock
                    ↓
                 Status updated (Open → Confirmed/Rejected)
```

### AttendanceRecord

Immutable audit record created on confirm/reject.

| Field | Type | Description |
|-------|------|-------------|
| employee | Party | Observer |
| employer | Party | Signatory |
| blockStart | Time | Block start |
| blockEnd | Time | Block end |
| status | BlockStatus | Confirmed or Rejected |
| recordedAt | Time | When confirmed/rejected |

---

## Oracle

### PriceFeed

Manual price updates. Admin creates and updates.

| Field | Type | Description |
|-------|------|-------------|
| admin | Party | Signatory |
| prices | TextMap Decimal | Currency → USD rate |
| updatedAt | Time | Last update time |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `UpdatePrices` | admin | Replace all prices (nonconsuming) |
| `SetPrice` | admin | Add/update single price (nonconsuming) |
| `GetPrices` | admin | Get all prices (nonconsuming) |

---

## Tests

### JPYCTest (7 tests)

| Test | Description |
|------|-------------|
| testMint | Mint 1000 JPYC to Alice |
| testMintToMultiple | Mint to Alice and Bob |
| testSplitAndTransfer | Split 10000, transfer 1000 |
| testTransfer | Transfer 500 from Alice to Bob |
| testFaucetClaim | Claim 500 from faucet |
| testFaucetClaimLimit | Claim 800, verify tracking |
| testFaucetMultipleUsers | Alice and Bob claim |

### CompanyTest (3 tests)

| Test | Description |
|------|-------------|
| testCreateCompany | Employer creates company |
| testAddEmployee | Employer adds employee |
| testMultipleEmployees | Add Alice and Bob |

### AttendanceTest (4 tests)

| Test | Description |
|------|-------------|
| testCheckIn | Employee creates block |
| testConfirmBlock | Employer confirms |
| testRejectBlock | Employer rejects |
| testMultipleBlocks | Create 3 blocks |

### OracleTest (3 tests)

| Test | Description |
|------|-------------|
| testCreatePriceFeed | Create with initial prices |
| testUpdatePrices | Update all prices |
| testSetSinglePrice | Set one currency price |

### E2ETest (1 test)

Full employee lifecycle:
1. Employer creates company
2. Employer adds employee
3. Employee lists companies
4. Employee does 4 time check-ins
5. Employer mints 100,000 JPYC
6. Employer sends 10,000 JPYC to employee
7. Employee checks balance

---

## Deployment

### Canton DevNet

1. Build: `dpm build`
2. Upload DAR to Canton DevNet
3. Allocate parties: admin, employee, employer
4. Create `JPYCIssuer` with admin party
5. Mint initial JPYC: `Mint`

### Integration with Desktop App

The existing FlowBuilder/Worker handles settlement. To use JPYC:

1. Replace CC with JPYC in payment calculations
2. Worker uses JPYC Asset Split/Transfer for payments
3. Attendance blocks feed into payroll calculations
4. Oracle PriceFeed replaces hardcoded priceProvider.ts

---

## Future Improvements

- [ ] Add expiration/timeout to Faucet claims
- [ ] Add attendance summary/aggregation contract
- [ ] Add project/task tracking to TimeBlock
- [ ] Connect Oracle to desktop app priceProvider
- [ ] Add Company update choice (archive + recreate pattern)
