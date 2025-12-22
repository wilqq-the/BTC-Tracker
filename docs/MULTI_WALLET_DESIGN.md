# Multi-Wallet Feature Design

## Overview

Replace the current fixed Hot/Cold wallet system with flexible, user-defined wallets.

---

## 1. Wallet Model

### Properties

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Int | Auto | Primary key |
| `userId` | Int | Yes | Owner of wallet |
| `name` | String | Yes | User-defined name (e.g., "Ledger Nano X", "Strike") |
| `type` | Enum | Yes | `HARDWARE`, `SOFTWARE`, `EXCHANGE`, `MOBILE`, `CUSTODIAL`, `PAPER` |
| `temperature` | Enum | Yes | `HOT` or `COLD` - security classification |
| `emoji` | String | No | Visual identifier (e.g., "🔐", "📱") |
| `color` | String | No | Hex color for UI charts |
| `notes` | String | No | User notes about this wallet |
| `includeInTotal` | Boolean | Yes | Include in portfolio total? (default: true) |
| `isDefault` | Boolean | Yes | Default destination for new BUYs (default: false) |
| `sortOrder` | Int | Yes | Display order in lists |

### Wallet Types

| Type | Description | Default Temperature |
|------|-------------|---------------------|
| `HARDWARE` | Hardware wallets (Ledger, Trezor, Coldcard) | COLD |
| `SOFTWARE` | Desktop/browser wallets (Sparrow, Electrum) | HOT |
| `MOBILE` | Phone wallets (Muun, BlueWallet, Phoenix) | HOT |
| `EXCHANGE` | Exchange accounts (Strike, River, Kraken) | HOT |
| `CUSTODIAL` | Third-party custody (Swan, Unchained) | COLD |
| `PAPER` | Paper wallets, seed backups | COLD |

### Temperature (Hot/Cold)

Simple security classification:
- **HOT** = Connected to internet, more accessible, higher risk
- **COLD** = Offline storage, more secure, lower risk

User can override the default temperature based on their setup.

---

## 2. Default Wallet Setup

### First-Time User Flow

When a new user creates an account:

```
┌─────────────────────────────────────────────────────┐
│  🏦 Set Up Your First Wallet                        │
│                                                      │
│  Before you can track transactions, create at least  │
│  one wallet. You can add more later.                │
│                                                      │
│  Wallet Name: [My Bitcoin Wallet_______]            │
│                                                      │
│  Type: [● Hardware  ○ Exchange  ○ Mobile  ○ Other]  │
│                                                      │
│  Temperature: [● Cold (secure)  ○ Hot (accessible)] │
│                                                      │
│                              [Skip] [Create Wallet] │
└─────────────────────────────────────────────────────┘
```

**Skip Option**: Creates a generic "Default Wallet" (SOFTWARE, HOT) so user can start immediately.

### Existing Users Migration

For users upgrading from v0.6.x:
1. Auto-create "Hot Wallet" (SOFTWARE, HOT)
2. Auto-create "Cold Storage" (HARDWARE, COLD)
3. Map existing transfers:
   - `TO_COLD_WALLET` → Hot → Cold
   - `FROM_COLD_WALLET` → Cold → Hot
   - `BETWEEN_WALLETS` → Hot → Hot (or prompt user to clarify)

---

## 3. External Transfers

External transfers are movements IN/OUT of your portfolio (not between your own wallets).

### External IN (Receiving BTC)
- Gift received, payment for work, mining rewards, inheritance
- **No source wallet** - BTC comes from outside your portfolio
- **Destination wallet required** - Where did you put it?

### External OUT (Sending BTC)
- Gift given, payment to someone, donation
- **Source wallet required** - Where did it come from?
- **No destination wallet** - BTC leaves your portfolio

### UI for External Transfers

```
┌─────────────────────────────────────────────────────┐
│ Transfer Type: [External ▼]                         │
│                                                      │
│ Direction: [● Receiving (IN)  ○ Sending (OUT)]      │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ [For Receiving IN]                                  │
│ To Wallet: [Ledger Nano X ▼]                        │
│ Source: [Gift from friend____________]  (note)      │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ [For Sending OUT]                                   │
│ From Wallet: [Strike ▼]                             │
│ Recipient: [Donation to OpenSats_____]  (note)      │
│                                                      │
│ Amount: [0.001_____] BTC                            │
│ Network Fee: [0.00001___] BTC                       │
└─────────────────────────────────────────────────────┘
```

**Key Point**: External transfers don't need a wallet on the external side - just a note for tracking.

---

## 4. Historical Balance Tracking (Future Feature)

### What it means

Track wallet balances over time to enable:
- "How much BTC was in my Ledger on January 1st?"
- "Show me balance trends per wallet"
- Balance charts per wallet (similar to portfolio chart)

### How it would work

**Option A: Snapshot Table**
```
WalletBalanceHistory:
  - walletId
  - date
  - btcBalance
  - snapshotType ('daily', 'transaction')
```

**Option B: Calculate on demand**
- Query transactions up to date X
- Sum up movements per wallet
- More accurate but slower

### Recommendation

**Start without historical tracking** - calculate current balance from transactions.
Add historical snapshots later if users want trend analysis per wallet.

---

## 5. Transaction Changes

### Updated Transaction Fields

```
BitcoinTransaction:
  // Existing fields stay...
  
  // NEW: Replace transferType strings with wallet references
  sourceWalletId      Int?    // Where BTC came FROM (null = external/buy)
  destinationWalletId Int?    // Where BTC went TO (null = external/sell)
  
  // Simplified transfer classification
  transferCategory    String? // 'INTERNAL' | 'EXTERNAL_IN' | 'EXTERNAL_OUT' | null
  
  // Keep for backward compat during migration
  transferType        String? // Legacy: TO_COLD, FROM_COLD, etc. (deprecated)
```

### Transaction Logic

| Type | sourceWalletId | destinationWalletId | transferCategory |
|------|----------------|---------------------|------------------|
| BUY | null | User's wallet | null |
| SELL | User's wallet | null | null |
| Transfer (internal) | Wallet A | Wallet B | INTERNAL |
| Transfer IN | null | User's wallet | EXTERNAL_IN |
| Transfer OUT | User's wallet | null | EXTERNAL_OUT |

---

## 6. Portfolio Calculations

### Per-Wallet Balance

```typescript
// Calculate balance for each wallet
for (wallet of user.wallets) {
  const incoming = sum(transactions where destinationWalletId = wallet.id)
  const outgoing = sum(transactions where sourceWalletId = wallet.id)
  const fees = sum(btc fees for outgoing transfers)
  
  wallet.balance = incoming - outgoing - fees
}
```

### Total Portfolio

```typescript
// Only include wallets with includeInTotal = true
const totalBtc = sum(wallet.balance for wallet in wallets where includeInTotal)
```

### Hot/Cold Distribution

```typescript
const hotBtc = sum(wallet.balance for wallet in wallets where temperature = 'HOT')
const coldBtc = sum(wallet.balance for wallet in wallets where temperature = 'COLD')
```

---

## 7. UI Components

### Wallet Manager (Profile Page)

```
┌─────────────────────────────────────────────────────┐
│ 💼 My Wallets                              [+ Add]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🔐 Ledger Nano X                      0.35421 BTC   │
│    Hardware • Cold              ☑ Include  [Edit]   │
│                                                      │
│ 📱 Muun Wallet                        0.00842 BTC   │
│    Mobile • Hot                 ☑ Include  [Edit]   │
│                                                      │
│ 🏦 Strike                             0.02156 BTC   │
│    Exchange • Hot               ☐ Exclude  [Edit]   │
│    └─ Note: DCA account, not part of main stack     │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Portfolio Total (included only):      0.36263 BTC   │
│ Hot: 0.00842 BTC (2.3%)                             │
│ Cold: 0.35421 BTC (97.7%)                           │
└─────────────────────────────────────────────────────┘
```

### Add Transaction Modal

```
┌─────────────────────────────────────────────────────┐
│ Add Transaction                                      │
├─────────────────────────────────────────────────────┤
│ Type: [BUY ▼]                                       │
│                                                      │
│ Wallet: [Ledger Nano X ▼]  ← NEW: Wallet selector   │
│                                                      │
│ Amount: [0.01________] BTC                          │
│ Price:  [$95,000_____] per BTC                      │
│ Fees:   [$1.50_______]                              │
│ Date:   [2024-12-22__]                              │
│                                                      │
│                          [Cancel] [Add Transaction] │
└─────────────────────────────────────────────────────┘
```

### Transfer Modal (Internal)

```
┌─────────────────────────────────────────────────────┐
│ Transfer Bitcoin                                     │
├─────────────────────────────────────────────────────┤
│ From: [Strike ▼]                     Balance: 0.05  │
│   ↓                                                 │
│ To:   [Ledger Nano X ▼]                             │
│                                                      │
│ Amount:      [0.05______] BTC  [Max]                │
│ Network Fee: [0.00001___] BTC                       │
│                                                      │
│ Arriving: 0.04999 BTC                               │
│                                                      │
│                              [Cancel] [Transfer]    │
└─────────────────────────────────────────────────────┘
```

---

## 8. Database Schema (Prisma)

```prisma
model Wallet {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Identity
  name            String
  type            String   // HARDWARE, SOFTWARE, EXCHANGE, MOBILE, CUSTODIAL, PAPER
  temperature     String   @default("HOT") // HOT, COLD
  emoji           String?
  color           String?
  notes           String?
  
  // Settings
  includeInTotal  Boolean  @default(true) @map("include_in_total")
  isDefault       Boolean  @default(false) @map("is_default")
  sortOrder       Int      @default(0) @map("sort_order")
  
  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  transactionsFrom BitcoinTransaction[] @relation("SourceWallet")
  transactionsTo   BitcoinTransaction[] @relation("DestinationWallet")

  @@map("wallets")
  @@index([userId])
  @@unique([userId, name]) // No duplicate names per user
}

// Add to BitcoinTransaction model:
model BitcoinTransaction {
  // ... existing fields ...
  
  // Wallet references
  sourceWalletId      Int?     @map("source_wallet_id")
  sourceWallet        Wallet?  @relation("SourceWallet", fields: [sourceWalletId], references: [id], onDelete: SetNull)
  destinationWalletId Int?     @map("destination_wallet_id")
  destinationWallet   Wallet?  @relation("DestinationWallet", fields: [destinationWalletId], references: [id], onDelete: SetNull)
  
  // Simplified category (replaces transferType for clarity)
  transferCategory    String?  @map("transfer_category") // INTERNAL, EXTERNAL_IN, EXTERNAL_OUT
  
  // DEPRECATED: Keep for migration, remove in future version
  // transferType     String?  @map("transfer_type")
}
```

---

## 9. Migration Plan

### Phase 1: Database (v0.7.0)
1. Create `wallets` table
2. Add `sourceWalletId`, `destinationWalletId`, `transferCategory` to transactions
3. Keep `transferType` for backward compatibility

### Phase 2: Data Migration
1. For each user with existing transfers:
   - Create "Hot Wallet" (SOFTWARE, HOT, isDefault=true)
   - Create "Cold Storage" (HARDWARE, COLD)
2. Update existing transactions:
   - BUY → destinationWalletId = Hot Wallet
   - SELL → sourceWalletId = Hot Wallet
   - TO_COLD_WALLET → source=Hot, dest=Cold, category=INTERNAL
   - FROM_COLD_WALLET → source=Cold, dest=Hot, category=INTERNAL
   - BETWEEN_WALLETS → source=Hot, dest=Hot, category=INTERNAL
   - TRANSFER_IN → dest=Hot, category=EXTERNAL_IN
   - TRANSFER_OUT → source=Hot, category=EXTERNAL_OUT

### Phase 3: UI
1. Add Wallet Manager to Profile page
2. Update AddTransactionModal with wallet selector
3. Update TransferModal with source/destination selectors
4. Update portfolio calculations
5. Add first-time wallet setup flow

### Phase 4: Cleanup (v0.8.0)
1. Remove `transferType` field (deprecated)
2. Remove legacy hot/cold calculation code

---

## 10. Design Decisions (Finalized)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Hot/Cold classification | `temperature` field separate from `type` | Clean separation of concerns |
| Default wallet | First-time setup flow with skip option | Good UX, doesn't block onboarding |
| External transfers | No wallet on external side, just notes | Simpler, matches real-world usage |
| Historical tracking | Defer to future version | Calculate from transactions for now |
| **Wallet deletion** | **Force reassignment before deletion** | Data integrity, user control |
| **CSV Import** | **Ask user with default pre-selected** | Flexibility with convenience |
| Multi-wallet per exchange | Naturally supported | Each wallet is unique entity |

---

## 11. Wallet Deletion Flow

When user attempts to delete a wallet with linked transactions:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Cannot Delete "Strike"                           │
│                                                      │
│ This wallet has 15 transactions linked to it.       │
│                                                      │
│ To delete this wallet, first move all transactions  │
│ to another wallet:                                  │
│                                                      │
│ Move transactions to: [Ledger Nano X ▼]             │
│                                                      │
│ This will update:                                   │
│   • 12 BUY transactions                             │
│   • 2 transfers (source)                            │
│   • 1 transfer (destination)                        │
│                                                      │
│              [Cancel] [Move & Delete Wallet]        │
└─────────────────────────────────────────────────────┘
```

**Rules:**
- Cannot delete wallet with transactions without reassignment
- Cannot delete the last/only wallet
- Cannot delete default wallet (must set another as default first)
- Soft delete option: Mark as "archived" instead (future feature)

---

## 12. CSV Import Flow

Enhanced import dialog with wallet selection:

```
┌─────────────────────────────────────────────────────┐
│ 📥 Import Transactions                              │
│                                                      │
│ File: Strike_export_2024.csv                        │
│ Format detected: Strike                             │
│ Transactions found: 47                              │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Import to wallet: [Strike ▼]  ← Default pre-selected│
│                                                      │
│ ☑ Skip duplicates (recommended)                     │
│ ☐ Dry run (preview without saving)                  │
│                                                      │
│              [Cancel] [Import 47 Transactions]      │
└─────────────────────────────────────────────────────┘
```

**Import Logic:**
- BUY → `destinationWalletId` = selected wallet
- SELL → `sourceWalletId` = selected wallet  
- TRANSFER → Both source and destination = selected wallet (internal)
- TRANSFER_IN → `destinationWalletId` = selected wallet
- TRANSFER_OUT → `sourceWalletId` = selected wallet

---

## 13. API Endpoints

### Wallet Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallets` | List user's wallets with balances |
| POST | `/api/wallets` | Create new wallet |
| GET | `/api/wallets/:id` | Get wallet details |
| PUT | `/api/wallets/:id` | Update wallet |
| DELETE | `/api/wallets/:id` | Delete wallet (with reassignment) |
| POST | `/api/wallets/:id/set-default` | Set as default wallet |
| POST | `/api/wallets/:id/reassign` | Move transactions to another wallet |

### Request/Response Examples

**GET /api/wallets**
```json
{
  "wallets": [
    {
      "id": 1,
      "name": "Ledger Nano X",
      "type": "HARDWARE",
      "temperature": "COLD",
      "emoji": "🔐",
      "color": "#3B82F6",
      "includeInTotal": true,
      "isDefault": false,
      "balance": 0.35421,
      "transactionCount": 45
    },
    {
      "id": 2,
      "name": "Strike",
      "type": "EXCHANGE", 
      "temperature": "HOT",
      "emoji": "⚡",
      "color": "#10B981",
      "includeInTotal": true,
      "isDefault": true,
      "balance": 0.02156,
      "transactionCount": 67
    }
  ],
  "summary": {
    "totalBalance": 0.37577,
    "includedBalance": 0.37577,
    "hotBalance": 0.02156,
    "coldBalance": 0.35421,
    "walletCount": 2
  }
}
```

**POST /api/wallets**
```json
{
  "name": "Muun Wallet",
  "type": "MOBILE",
  "temperature": "HOT",
  "emoji": "📱",
  "color": "#8B5CF6",
  "includeInTotal": true,
  "isDefault": false,
  "notes": "Lightning-enabled mobile wallet"
}
```

**DELETE /api/wallets/:id**
```json
{
  "reassignToWalletId": 1
}
```

---

## 14. Implementation Phases

### Phase 1: Database & Backend (Week 1-2)
- [ ] Create Prisma migration for `Wallet` model
- [ ] Add wallet fields to `BitcoinTransaction`
- [ ] Create `/api/wallets` CRUD endpoints
- [ ] Create data migration script for existing users
- [ ] Update portfolio calculation service
- [ ] Update transaction API to handle wallet references

### Phase 2: Core UI (Week 2-3)
- [ ] Create `WalletSelector` component (dropdown)
- [ ] Create `WalletManager` component (list with CRUD)
- [ ] Create `WalletForm` modal (add/edit)
- [ ] Create `WalletDeleteDialog` (with reassignment)
- [ ] Add Wallet Manager section to Profile page
- [ ] Update `AddTransactionModal` with wallet selector

### Phase 3: Transaction Integration (Week 3-4)
- [ ] Update transaction list to show wallet info
- [ ] Update transaction filters (filter by wallet)
- [ ] Update transfer UI (source → destination wallets)
- [ ] Update CSV import with wallet selection
- [ ] Update portfolio metrics endpoint

### Phase 4: Dashboard & Polish (Week 4-5)
- [ ] Update `WalletDistributionWidget` for multiple wallets
- [ ] Add per-wallet balance display
- [ ] Create wallet balance pie chart
- [ ] First-time wallet setup flow
- [ ] Testing & bug fixes
- [ ] Documentation

---

## 15. Database Migration Script

```typescript
// scripts/migrate-wallets.ts

async function migrateToMultiWallet() {
  const users = await prisma.user.findMany({
    include: { transactions: true }
  });

  for (const user of users) {
    // Create default wallets
    const hotWallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        name: 'Hot Wallet',
        type: 'SOFTWARE',
        temperature: 'HOT',
        emoji: '🔥',
        isDefault: true,
        includeInTotal: true,
        sortOrder: 0
      }
    });

    const coldWallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        name: 'Cold Storage',
        type: 'HARDWARE',
        temperature: 'COLD',
        emoji: '🔐',
        isDefault: false,
        includeInTotal: true,
        sortOrder: 1
      }
    });

    // Migrate transactions
    for (const tx of user.transactions) {
      const updates: any = {};

      if (tx.type === 'BUY') {
        updates.destinationWalletId = hotWallet.id;
      } else if (tx.type === 'SELL') {
        updates.sourceWalletId = hotWallet.id;
      } else if (tx.type === 'TRANSFER') {
        switch (tx.transferType) {
          case 'TO_COLD_WALLET':
            updates.sourceWalletId = hotWallet.id;
            updates.destinationWalletId = coldWallet.id;
            updates.transferCategory = 'INTERNAL';
            break;
          case 'FROM_COLD_WALLET':
            updates.sourceWalletId = coldWallet.id;
            updates.destinationWalletId = hotWallet.id;
            updates.transferCategory = 'INTERNAL';
            break;
          case 'BETWEEN_WALLETS':
            updates.sourceWalletId = hotWallet.id;
            updates.destinationWalletId = hotWallet.id;
            updates.transferCategory = 'INTERNAL';
            break;
          case 'TRANSFER_IN':
            updates.destinationWalletId = hotWallet.id;
            updates.transferCategory = 'EXTERNAL_IN';
            break;
          case 'TRANSFER_OUT':
            updates.sourceWalletId = hotWallet.id;
            updates.transferCategory = 'EXTERNAL_OUT';
            break;
        }
      }

      if (Object.keys(updates).length > 0) {
        await prisma.bitcoinTransaction.update({
          where: { id: tx.id },
          data: updates
        });
      }
    }

    console.log(`Migrated user ${user.id}: ${user.transactions.length} transactions`);
  }
}
```

---

## 16. Testing Strategy

### Unit Tests
- Wallet CRUD operations
- Balance calculation per wallet
- Transaction-wallet linking
- Migration script validation

### Integration Tests
- API endpoint responses
- Wallet deletion with reassignment
- CSV import with wallet selection
- Portfolio totals with include/exclude

### E2E Tests
- Create wallet flow
- Edit wallet flow
- Delete wallet with reassignment
- Add transaction with wallet selection
- Transfer between wallets

---

## 17. Security Considerations

- **Authorization**: All wallet operations scoped to authenticated user
- **Validation**: Wallet IDs validated against user ownership
- **Cascade**: Wallet deletion requires explicit transaction reassignment
- **Audit**: Log wallet creation/deletion/reassignment events

---

## Summary

This design provides:
- ✅ Unlimited user-defined wallets
- ✅ Hot/Cold security classification (temperature)
- ✅ Type categorization (hardware, exchange, mobile, etc.)
- ✅ Include/exclude from portfolio total
- ✅ Default wallet for convenience
- ✅ External transfers without wallet requirement
- ✅ Safe wallet deletion with transaction reassignment
- ✅ CSV import with wallet selection
- ✅ Backward compatible migration path
- ✅ Clean database schema with proper relations
- ✅ Comprehensive API design
- ✅ Phased implementation plan
- ✅ Testing strategy

**Target version**: v0.7.0 (major feature release)
**Estimated effort**: 4-5 weeks

