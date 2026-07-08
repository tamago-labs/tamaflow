# TamaFlow Smart Contracts

Canton/Daml smart contracts for JPYC token and attendance tracking.

## Setup

```bash
cd contracts
daml build
daml test
```

Requires Daml SDK 3.5.1.

---

## Package Structure

```
contracts/daml/
├── CIP0056/                    # Token standard interfaces
│   ├── TokenMetadata.daml
│   ├── Holdings.daml
│   └── TransferInstruction.daml
├── JPYC/                       # JPYC token implementation
│   ├── Types.daml
│   ├── Asset.daml
│   ├── Issuer.daml
│   ├── TransferFactory.daml
│   └── TransferInstruction.daml
├── Attendance/                  # Time tracking
│   ├── Types.daml
│   ├── TimeBlock.daml
│   └── AttendanceRecord.daml
└── Tests/
    ├── JPYCTest.daml
    └── AttendanceTest.daml
```

---

## CIP-0056 Interfaces

Standard token interfaces adapted from RentyVast reference implementation.

### TokenMetadata

| Field | Type | Description |
|-------|------|-------------|
| instrumentAdmin | Party | Token admin party |
| instrumentId | Text | Token identifier |
| name | Text | Human-readable name |
| symbol | Text | Token symbol |
| decimals | Int | Decimal places |
| totalSupply | Optional Decimal | Current supply |
| meta | Metadata | Extensible metadata |

### Holding

| Field | Type | Description |
|-------|------|-------------|
| owner | Party | Current holder |
| instrumentId | InstrumentId | Token identifier (admin + id) |
| amount | Decimal | Balance |
| lock | Optional Lock | Lock info (if locked) |
| meta | Metadata | Extensible metadata |

### TransferFactory

Creates transfer instructions. Choices:
- `TransferFactory_Transfer` — sender-initiated transfer
- `TransferFactory_PublicFetch` — read factory metadata

### TransferInstruction

Pending transfer awaiting receiver action. Choices:
- `Accept` — receiver accepts, mints holding to receiver
- `Reject` — receiver rejects, refund to sender
- `Withdraw` — sender cancels, refund to sender

---

## JPYC Token

CIP-0056 compliant token. No decimals (JPY has no cents).

### Constants

| Name | Value |
|------|-------|
| tokenSymbol | JPYC |
| tokenName | JPYC Token |
| tokenDecimals | 0 |
| instrumentIdText | JPYC |

### JPYCAsset

Primary holding contract. Implements `Holding` interface.

| Field | Type | Description |
|-------|------|-------------|
| issuer | Party | Minted by |
| owner | Party | Current holder |
| amount | Decimal | Balance |
| instrumentId | InstrumentId | Always JPYC |
| lock | Optional Lock | Lock status |
| meta | Metadata | Extensible metadata |
| observers | [Party] | Additional observers |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `Split` | owner | Split into payment + change UTXOs |
| `TransferAsset` | owner | Transfer to new owner |
| `MergeWith` | owner | Merge two same-owner UTXOs |

**Constraints:**
- `amount > 0` (ensure)
- Both issuer and owner are signatories
- Locked holdings cannot be split/transferred/merged

### JPYCIssuer

Platform minter. Anyone can mint — no admin restriction.

| Field | Type | Description |
|-------|------|-------------|
| admin | Party | Issuer signatory |
| instrumentId | InstrumentId | JPYC instrument |
| totalSupply | Decimal | Running total |
| meta | Metadata | Extensible metadata |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `Mint` | **anyone** | Mint JPYC to any owner |
| `JPYCIssuer_BootstrapFactories` | admin | Create transfer factory |
| `PublicFetch` | **anyone** | Read token metadata |

**Note:** `Mint` has no admin restriction — anyone can mint unlimited JPYC for testing.

### JPYCTransferFactory

CIP-0056 transfer factory. Creates `JPYCTransferInstruction` on transfer.

| Field | Type | Description |
|-------|------|-------------|
| admin | Party | Factory admin |
| instrumentId | InstrumentId | JPYC instrument |
| meta | Metadata | Extensible metadata |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `TransferFactory_Transfer` | sender | Create transfer instruction |
| `TransferFactory_PublicFetch` | **anyone** | Read factory metadata |

**Transfer flow:**
1. Sender exercises `TransferFactory_Transfer`
2. Factory validates sender's holdings, archives input UTXOs
3. Creates `JPYCTransferInstruction` with escrowed amount
4. Receiver exercises `Accept` to receive tokens
5. Or `Reject`/`Withdraw` to refund sender

### JPYCTransferInstruction

Pending transfer awaiting receiver acceptance.

| Field | Type | Description |
|-------|------|-------------|
| issuer | Party | Factory admin |
| transfer | Transfer | Transfer details |
| escrowedAmount | Decimal | Amount in escrow |
| status | TransferInstructionStatus | Current status |
| meta | Metadata | Extensible metadata |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `Accept` | receiver | Mint tokens to receiver |
| `Reject` | receiver | Refund to sender |
| `Withdraw` | sender | Cancel and refund |

---

## Attendance

Time tracking with 1-hour blocks.

### BlockStatus

```
data BlockStatus = Open | Confirmed | Rejected
```

### TimeBlock

1-hour attendance block. Employee checks in, employer reviews later.

| Field | Type | Description |
|-------|------|-------------|
| employee | Party | Signatory (checks in) |
| employer | Party | Observer (reviews later) |
| blockStart | Time | Block start time |
| blockEnd | Time | Always blockStart + 1 hour |
| status | BlockStatus | Open/Confirmed/Rejected |
| note | Optional Text | Optional description |

**Choices:**

| Choice | Controller | Description |
|--------|------------|-------------|
| `ConfirmBlock` | employer | Confirm attendance, create record |
| `RejectBlock` | employer | Reject with reason, create record |
| `CloseBlock` | employee | Auto-confirm after block ends |

**Constraints:**
- `blockEnd == blockStart + 1 hour` (ensure)
- Only employee signs at creation (employer is observer)
- Employer confirms/reviews later (no real-time coordination needed)
- Employee can self-close after block time passes

**Flow:**
```
Employee check-in → TimeBlock (Open)
                    ↓
Employer reviews → ConfirmBlock/RejectBlock
                    ↓
                 AttendanceRecord (immutable audit)
```

### AttendanceRecord

Immutable audit record created on confirm/reject.

| Field | Type | Description |
|-------|------|-------------|
| employee | Party | Employee |
| employer | Party | Employer |
| blockStart | Time | Block start |
| blockEnd | Time | Block end |
| status | BlockStatus | Confirmed or Rejected |
| recordedAt | Time | When confirmed/rejected |

**Signatories:** Both employee and employer

---

## Tests

### JPYCTest (6 tests)

| Test | Description |
|------|-------------|
| testMint | Mint 1000 JPYC to Alice |
| testSplitAndMerge | Split 1000 → 300 + 700, merge back |
| testTransfer | Transfer 200 from Alice to Bob |
| testMintRequiresPositiveAmount | Reject minting 0 |
| testAnyoneCanMint | Non-admin can mint |
| testPublicFetch | Anyone can read metadata |

### AttendanceTest (8 tests)

| Test | Description |
|------|-------------|
| testCheckIn | Employee creates 1hr block |
| testConfirmBlock | Employer confirms, creates record |
| testRejectBlock | Employer rejects, creates record |
| testEmployeeCannotConfirm | Employee cannot confirm own block |
| testCannotConfirmAlreadyConfirmed | Cannot double-confirm |
| testCloseBlockByEmployee | Employee closes after block ends |
| testCannotCloseBeforeBlockEnds | Cannot close early |
| testMultipleBlocks | 3 blocks in sequence |

---

## Deployment

### Canton DevNet

1. Build: `daml build`
2. Upload DAR to Canton DevNet
3. Allocate parties: admin, employee, employer
4. Create `JPYCIssuer` with admin party
5. Bootstrap transfer factory: `JPYCIssuer_BootstrapFactories`
6. Mint initial JPYC: `Mint`

### Integration with Desktop App

The existing FlowBuilder/Worker handles settlement. To use JPYC:

1. Replace CC with JPYC in payment calculations
2. Worker uses `JPYCTransferFactory.TransferFactory_Transfer` instead of CC transfers
3. Attendance blocks feed into payroll calculations

---

## Future Improvements

- [ ] Add expiration/timeout to TransferInstruction
- [ ] Add compliance lock support to JPYCAsset
- [ ] Add attendance summary/aggregation contract
- [ ] Add project/task tracking to TimeBlock
- [ ] Limit minting per address (if needed for production)
- [ ] Add multi-sig or threshold authorization
