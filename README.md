# AgriFund Protocol 🚀

AgriFund is a decentralized, institutional-grade Real-World Asset (RWA) agricultural lending protocol built on Solana. It seamlessly bridges global Web3 liquidity with real-world farming cooperatives, utilizing Program Derived Address (PDA) escrow vaults, 1:1 composable SPL receipt tokens, linear time-locked capital drawdown guardrails, and mock parametric insurance oracle overrides.

---

## 🏗️ Protocol Architecture & State Machine

AgriFund governs the entire lifecycle of an agricultural loan through a strict, on-chain state machine bound to individual `YieldPool` accounts:

      [ INITIALIZE ] 
            │
            ▼
        ┌───────┐         Early Refund (Burn Receipts -> Reclaim USDC)
        │ Open  │ ◄───────────────────────────────────────────────────────┐
        └───┬───┘                                                         │
            │ (100% Funded Goal Achieved)                                 │
            ▼                                                             │
        ┌─────────┐                                                       │
        │ Farming │ ───► [ 180s Linear Vesting Drawdown for Farmer ]      │
        └───┬─┬───┘                                                       │
            │ │                                                           │
            │ └──────────────┐ (Catastrophic Weather Event)               │
            │                ▼                                            │
            │         ┌───────────┐                                       │
            │         │ Defaulted │ ───► [ Parametric Insurance Trigger ] ───┤
            │         └───────────┘      [ Investors Burn Receipts to  ]  │
            │                            [ Reclaim Remaining Capital   ]  │
            │ (Harvest Profits Deposited)                                 │
            ▼                                                             │
        ┌─────────┐                                                       │
        │ Settled │ ──────────────────────────────────────────────────────┘
        └─────────┘   [ Investors Burn Receipts to Claim Principal + Yield ]

---

## 🔒 Security & Tokenomic Guardrails

* **Anti-Rug Vesting:** Capital is never handed over to a farmer upfront. Once a pool transitions to `Farming`, funds are drawn down linearly using Solana's on-chain `Clock` sysvar, restricting access to verified tranches.
* **1:1 Asset Composability:** When investors fund a pool, the protocol mints an exact 1:1 proportional SPL token (e.g., `agriTOKEN`) directly to their wallet via a PDA mint authority. This token serves as a cryptographic claim ticket.
* **Early-Stage Liquidity (Refunds):** If a pool is still in the `Open` funding phase, investors retain complete sovereignty over their capital. They can trigger an early refund, which safely burns their receipt tokens and returns their USDC from the vault.
* **Parametric Insurance Simulation:** To handle physical-world agricultural risks, an administrative mock oracle can transition the pool into a `Defaulted` state. This freezes the farmer's vesting access instantly and unlocks immediate residual asset reclamation for investors.

---

## 🛠️ Smart Contract Layout (`programs/agrifund/src/lib.rs`)

The core Solana program exposes seven primary instructional endpoints:
1.  `initialize_pool`: Establishes the target capital goal, initializes the unique PDA token vault, and derives the localized receipt token mint PDA.
2.  `fund_yield`: Deposits investor USDC into the secure PDA vault and mints the exact equivalent amount of receipt tokens to the investor's ATA.
3.  `refund_investment`: Allows an investor to pull capital out of an `Open` pool, restoring pool capacity and burning the associated receipt tokens.
4.  `withdraw_capital`: Governs the linear time-locked capital drawdown for the verified farm authority once farming has commenced.
5.  `settle_pool`: Allows the farm authority to return the principal plus generated crop profits to the vault, changing the status to `Settled`.
6.  `trigger_default`: Acts as a mock weather oracle, locking the pool and enabling immediate parametric insurance claim pathways.
7.  `claim_yield`: Allows investors to burn their receipt tokens post-harvest (or post-default) to claim their exact mathematical share of the USDC vault.

---

## 🚀 Verification & Local Deployment

### Prerequisites
* Rust v1.75+
* Solana CLI v1.18+
* Anchor CLI v0.29.0
* Node.js v18+ & npm/yarn

### 1. Run Local Ledger Tests
```bash
# Clone the repository
git clone https://github.com/your-username/agrifund.git
cd agrifund

# Run anchor test suite (Spins up local validator, deploys, and verifies instructions)
anchor test
```

### 2. Live Frontend Interaction
```bash
# Navigate to web application
cd app

# Install dependencies
npm install

# Run type validation check
npx tsc --noEmit

# Spin up local development server
npm run dev
```

## 🌐 On-Chain Deployment Details
* **Network:** Solana Devnet
* **Program ID:** `CpfKbjko2E5QRizDfhionhFW3awEfEvK6CKe1KZwQEiB`
* **Explorer Link:** [https://explorer.solana.com/address/CpfKbjko2E5QRizDfhionhFW3awEfEvK6CKe1KZwQEiB?cluster=devnet](https://explorer.solana.com/address/CpfKbjko2E5QRizDfhionhFW3awEfEvK6CKe1KZwQEiB?cluster=devnet)
