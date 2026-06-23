# AgriFund Protocol 🌾

> **Decentralizing Real-World Agricultural Yields on Solana.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Network: Devnet](https://img.shields.io/badge/Network-Solana%20Devnet-9945FF)](https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Built%20With-Anchor%20v0.29-blue)](https://www.anchor-lang.com/)
[![Live on Vercel](https://img.shields.io/badge/Live%20Demo-agrifund--rwa.vercel.app-black?logo=vercel)](https://agrifund-rwa.vercel.app)

**🌐 Live App:** [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app) · **🔍 On-Chain:** [View on Solana Explorer →](https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet)

---

## 🌱 The Problem

**For Indian farmers:** Agricultural credit in India is gatekept by geography and bureaucracy. Rural cooperatives — the backbone of India's food supply — pay predatory interest rates of 18–36% APR to informal lenders, simply because they lack access to borderless, institutional-grade capital.

**For DeFi investors:** Most on-chain yield is circular and speculative. There is no credible on-ramp to stable, real-world returns that create tangible, verifiable impact — especially in high-growth emerging markets.

**The trust gap:** You cannot put a physical farm on a blockchain. How do global investors fund a cooperative without counterparty risk and the threat of a rug-pull?

---

## 💡 The Solution

AgriFund is a decentralized, institutional-grade **Real-World Asset (RWA) agricultural lending protocol** built on Solana. It solves the trust gap through three cryptographic primitives:

1. **PDA Escrow Vaults** — Capital is held in mathematically verifiable Program Derived Address vaults, not centralized multi-sigs. No single party can access funds unilaterally.
2. **Composable Receipt Tokens** — Every 1 USDC deposited mints exactly 1 pool-specific SPL receipt token to the investor. This token is a cryptographic, transferable claim on the vault — burn it to reclaim your capital + yield.
3. **Linear Vesting Drawdown** — Farmers cannot withdraw capital upfront. Funds unlock linearly over a configurable farming season, enforced entirely on-chain via Solana's `Clock` sysvar.

---

## ⚡ Why Solana

| Requirement | Why Solana Wins |
|---|---|
| **Settlement speed** | ~400ms finality — essential for real-time yield distribution |
| **Transaction cost** | Sub-cent fees make micro-investment positions economically viable |
| **SPL Tokens** | Native composable token standard enables per-pool receipt tokens without external infrastructure |
| **Anchor Framework** | Rust-based safety constraints and IDL generation for trustless, auditable contracts |
| **Ecosystem depth** | Access to Chainlink oracles, Metaplex metadata, Circle USDC — all first-class on Solana |

---

## ✅ Traction

- **100% feature-complete MVP** live on Solana Devnet
- **7 core instructions** deployed and verified on-chain at `3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5`
- **Full frontend** live at [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app) — Estate Portal, Investor Dashboard, real-time pool state machine
- **Complete test suite** — `anchor test` covers the full protocol lifecycle (init → fund → farm → settle → claim)
- **Metaplex token metadata** — each pool mints a uniquely named, symbolized SPL receipt token (e.g., `agriGRAIN`, `agriOIL`)
- **Partial refund support** — investors can burn receipts and reclaim USDC at any point before farming starts

---

## 🏗️ Protocol Architecture & State Machine

AgriFund governs the entire lifecycle of an agricultural loan through a strict, on-chain state machine bound to individual `YieldPool` accounts:

```
      [ INITIALIZE ]
            │
            ▼
        ┌───────┐         Early Refund (Burn Receipts → Reclaim USDC)
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
```

---

## 🔒 Security & Tokenomic Guardrails

* **Anti-Rug Vesting:** Capital is never handed over to a farmer upfront. Once a pool transitions to `Farming`, funds are drawn down linearly using Solana's on-chain `Clock` sysvar, restricting access to verified tranches.
* **1:1 Asset Composability:** When investors fund a pool, the protocol mints an exact 1:1 proportional SPL token (e.g., `agriGRAIN`) directly to their wallet via a PDA mint authority seeded to that specific yield pool. This token serves as a cryptographic claim ticket.
* **Early-Stage Liquidity (Refunds):** If a pool is still in the `Open` funding phase, investors retain complete sovereignty over their capital — burn receipt tokens to return exact USDC from the vault.
* **Parametric Insurance Simulation:** An administrative oracle can transition the pool into a `Defaulted` state, instantly freezing the farmer's vesting access and unlocking immediate residual asset reclamation for investors.

---

## 🛠️ Smart Contract Layout (`programs/agrifund/src/lib.rs`)

The core Solana program exposes seven primary instructional endpoints:

| Instruction | Description |
|---|---|
| `initialize_pool` | Establishes target capital goal, initializes PDA token vault, derives receipt token mint PDA + Metaplex metadata |
| `fund_yield` | Deposits investor USDC into the PDA vault; mints exact 1:1 receipt tokens to investor's ATA |
| `refund_investment` | Allows investor to pull capital from an `Open` pool; burns associated receipt tokens |
| `withdraw_capital` | Linear time-locked capital drawdown for the verified farm authority once farming commences |
| `settle_pool` | Farm authority returns principal + crop profits to vault; transitions status to `Settled` |
| `trigger_default` | Mock weather oracle — locks the pool and enables parametric insurance claim pathways |
| `claim_yield` | Investors burn receipt tokens post-harvest (or post-default) to claim their proportional USDC share |

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
git clone https://github.com/jigglu/agrifund.git
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

---

## 🌐 On-Chain Deployment Details

* **Network:** Solana Devnet
* **Program ID:** `3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5`
* **Explorer Link:** [View on Solana Explorer →](https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet)
* **Live Frontend:** [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app)

---

## 🧪 Testing the Live Protocol

To interact with AgriFund on Devnet without real funds:

1. **Set your wallet to Devnet** in Phantom/Backpack: Settings → Developer Settings → Change Network → Devnet.
2. **Get free Devnet SOL** for gas: Visit the [Solana Faucet](https://faucet.solana.com/) and airdrop SOL to your wallet.
3. **Get test USDC**: The app ships with a built-in "Fund Pool" button that mints AgriUSD (the devnet mock USDC) directly into the pool vault for testing the full estate-side flow.
4. **Run the full lifecycle**: Initialize Pool → Investor Deposits → Farmer Withdraws Capital → Estate Settles → Investor Claims Yield.

---

## 🤝 Contributing

AgriFund is fully open-source. Contributions, audits, and feedback are welcome.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
