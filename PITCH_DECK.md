# AgriFund: Superteam Grant Pitch Deck

---

## Slide 1: Title & Hook

**AgriFund 🌾**
*Decentralizing Real-World Agricultural Yields on Solana*

Indian farming cooperatives pay 18–36% APR to informal moneylenders.
Global DeFi capital earns speculative, circular yields with no real-world impact.

AgriFund is the trustless bridge between the two — a live, on-chain RWA protocol on Solana.

**Live now:** [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app)

---

## Slide 2: The Problem

**For Indian Farmers**
- Traditional agricultural credit is slow, localized, and controlled by informal lenders
- Cooperative farms lack access to borderless, global capital markets
- Predatory rates (18–36% APR) erode margins before the first harvest

**For Web3 Investors**
- DeFi yields are largely circular and disconnected from the physical world
- There is no credible, trustless on-ramp to stable Real-World Asset returns
- Emerging market agriculture — one of the highest-yield asset classes globally — is inaccessible on-chain

**The Trust Gap**
- You cannot put a physical farm on a blockchain
- Without trustless escrow, investors face counterparty risk and rug-pull exposure
- Without verifiable drawdown controls, farmers can misappropriate capital

---

## Slide 3: The Solution

**Trustless Agricultural Escrow — Built on Solana**

Three primitives that eliminate the trust gap:

1. **PDA Vault Escrow** — Capital held in mathematically verifiable Program Derived Address vaults. No admin key. No multi-sig. No trust required.

2. **Composable Receipt Tokens** — Every 1 USDC deposited mints exactly 1 pool-specific SPL receipt token to the investor's wallet. Burn the token, reclaim the capital + yield. Cryptographic, transferable, and composable.

3. **Linear Vesting Drawdown** — Farmers cannot withdraw capital upfront. Funds unlock linearly over a configurable farming season via Solana's on-chain `Clock` sysvar. This is the on-chain equivalent of a tranche-based disbursement.

---

## Slide 4: Why Solana

| Requirement | Why Solana |
|---|---|
| Settlement speed | ~400ms finality — critical for real-time yield events |
| Transaction cost | Sub-cent fees make micro-investment positions economically viable for rural cooperatives |
| SPL Token standard | Native composable tokens enable per-pool receipt instruments without external infrastructure |
| Anchor Framework | Rust-enforced safety constraints, declarative account validation, and IDL generation for trustless contracts |
| Oracle ecosystem | Chainlink weather data + Pyth price feeds available natively — essential for V2 parametric insurance |
| USDC on Solana | Circle's native USDC enables institutional-grade settlement without bridging friction |

Solana is the only L1 where all of these components — speed, cost, SPL tokens, Anchor, Chainlink, and Circle USDC — exist as first-class citizens in a single ecosystem.

---

## Slide 5: Proof of Work (The MVP)

**Status: 100% Feature-Complete & Live on Solana Devnet**

**What's shipped:**
- ✅ 7 on-chain instructions deployed at `3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5`
- ✅ Full frontend live at [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app)
- ✅ Estate Portal — create and manage yield pools
- ✅ Investor Dashboard — fund pools, track positions, claim yield
- ✅ Full lifecycle: Initialize → Fund → Farm → Settle → Claim, all on-chain
- ✅ Metaplex token metadata — each pool mints a uniquely named SPL receipt token (`agriGRAIN`, `agriOIL`)
- ✅ Partial refund support — investors can exit before farming starts
- ✅ Complete Anchor test suite covering all 7 instructions

**Tech Stack:**
- Smart Contracts: Rust / Anchor v0.29
- Frontend: Next.js / TypeScript / Tailwind CSS
- Web3: `@solana/web3.js` / Anchor TS / Phantom/Backpack wallet adapters
- Devnet USDC: AgriUSD mock SPL token for permissionless testing

---

## Slide 6: The Security Model (Parametric Insurance)

**Anti-Rug Time-Locks**
Farmers cannot withdraw 100% of funds upfront. Capital unlocks via strict linear vesting driven by Solana's on-chain `Clock`. *(Vesting duration set to 180s on Devnet for live demonstration; production values reflect a full farming season.)*

**Early-Stage Investor Liquidity**
Investors can burn their receipt tokens to reclaim exact USDC principal at any time before farming starts (`PoolStatus::Open`). Once farming begins and capital vests, early refunds are disabled.

**Climate-Resilient Parametric Override**
If a verifiable natural disaster occurs, an administrative oracle sets the pool to `Defaulted`. This immediately unlocks investor claims — investors burn receipts to withdraw their proportional share of remaining vault capital. The V2 roadmap replaces this mock oracle with a live Chainlink weather feed.

---

## Slide 7: The Financial Lifecycle

1. **Initialize** — Estate sets a hard USDC target (`total_yield_kg × price_per_kg`) and yield price on-chain
2. **Fund** — Investors deposit USDC and receive 1:1 Pool Receipt Tokens, minted by a per-pool PDA-controlled mint
3. **[Optional] Early Refund** — Before farming begins, investors can burn receipt tokens to reclaim exact USDC principal
4. **Farm** — Pool locks when estate triggers the first drawdown; funds vest linearly via on-chain `Clock`
5. **Settle** — Harvest profits deposited back into vault by the estate via `settle_pool`
6. **Claim** — Investors burn receipt tokens to withdraw their proportional share of the vault (principal + crop yield)

---

## Slide 8: Roadmap

| Phase | Feature | Status |
|---|---|---|
| V1 | Core protocol — PDA vaults, receipt tokens, vesting, parametric default | ✅ Live on Devnet |
| V1.1 | Metaplex on-chain SPL token metadata per pool | ✅ Complete |
| V1.2 | Partial withdrawal / refund before pool locks | ✅ Complete |
| V2 | Chainlink Weather Oracle — automated parametric default triggers | 🔜 Next |
| V3 | Independent smart contract security audit | 🔜 Next |
| V4 | India cooperative pilot — onboard 1 real farming cooperative | 🔜 Next |
| V5 | Mainnet deployment & real USDC integration | 🔜 Planned |

---

## Slide 9: The Ask

**Grant Amount:** $5,000 – $8,000 USD (in SOL or USDC)

**What this funds — 3 milestone-gated deliverables:**

| Milestone | Deliverable | Estimated Cost |
|---|---|---|
| M1 | Chainlink Weather Oracle integration — live automated parametric default triggers on Devnet | $2,000 |
| M2 | Independent smart contract security audit (Solana-specialized firm) | $3,000 |
| M3 | India cooperative pilot — onboard 1 verified farming cooperative for a live Devnet simulation | $2,000–$3,000 |

**Why milestone-gated?**
Each milestone delivers a concrete, verifiable output. The Solana Foundation can verify on-chain progress before each tranche is released.

**Why AgriFund?**
- It's already built and deployed — this grant accelerates maturation, not inception
- It targets the highest-impact use case for Solana in India: agricultural finance for 600M+ farmers
- It is fully open source — every line of code, IDL, and frontend will remain public

---

## Slide 10: Open Source Commitment

AgriFund's full protocol — smart contracts, IDL, and frontend — is already publicly available at [github.com/jigglu/agrifund](https://github.com/jigglu/agrifund).

All core infrastructure will remain open source to support the broader Solana developer ecosystem in India and beyond.
