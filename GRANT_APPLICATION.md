# AgriFund — Superteam Solana India Grant Application

> **Ready-to-paste application content for:**
> [superteam.fun/earn/grants/solana-foundation-india-grants](https://superteam.fun/earn/grants/solana-foundation-india-grants)

---

## Project Name

AgriFund Protocol

## Project URL / Live Demo

https://agrifund-rwa.vercel.app

## GitHub Repository

https://github.com/jigglu/agrifund

## On-Chain Deployment

- **Network:** Solana Devnet
- **Program ID:** `3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5`
- **Explorer:** https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet

---

## About Me (Brief Intro)

*(Paste your personal introduction here — 3–4 sentences maximum. Suggested template:)*

> I'm [your name], a [developer/builder] based in India. I built AgriFund as a decentralized RWA agricultural lending protocol on Solana that bridges global Web3 capital with Indian farming cooperatives through trustless PDA escrow vaults and composable SPL receipt tokens. The protocol is fully feature-complete and live on Solana Devnet. I've applied to the Solana Foundation India Grant to fund the next three milestones: oracle integration, a security audit, and an India cooperative pilot.

---

## What Is AgriFund?

AgriFund is a decentralized, institutional-grade Real-World Asset (RWA) agricultural lending protocol built on Solana. It bridges the gap between global Web3 liquidity and Indian farming cooperatives through three cryptographic primitives:

1. **PDA Escrow Vaults** — Capital is held in mathematically verifiable Program Derived Address vaults. No admin key. No multi-sig. No trust required.

2. **Composable Receipt Tokens** — Every 1 USDC deposited mints exactly 1 pool-specific SPL receipt token to the investor's wallet. Burn the token, reclaim capital + yield. Cryptographic, transferable, composable.

3. **Linear Vesting Drawdown** — Farmers cannot withdraw capital upfront. Funds unlock linearly over a configurable farming season enforced entirely via Solana's on-chain `Clock` sysvar.

**The problem it solves:** Indian farming cooperatives pay 18–36% APR to informal moneylenders due to lack of access to borderless capital. DeFi investors have no credible, trustless on-ramp to stable Real-World Asset yields. AgriFund is the bridge.

---

## What's Already Built (Proof of Work)

- ✅ **7 on-chain instructions** deployed and verified on Solana Devnet
- ✅ **Full frontend** live at [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app) — Estate Portal, Investor Dashboard, real-time pool state machine
- ✅ **Complete Anchor test suite** covering the full lifecycle (init → fund → farm → settle → claim)
- ✅ **Metaplex token metadata** — each pool mints a uniquely named, symbolized SPL receipt token (`agriGRAIN`, `agriOIL`)
- ✅ **Partial refund support** — investors can burn receipts and reclaim USDC before farming starts
- ✅ **Parametric insurance simulation** — admin oracle can trigger `Defaulted` state, immediately unlocking investor claims
- ✅ **Fully open source** — all smart contracts, IDL, and frontend code are public on GitHub

---

## Grant Amount Requested

**$6,000 – $8,000 USD (in SOL or USDC)**

---

## Milestone Breakdown

| Milestone | Deliverable | Verification | Estimated Cost |
|---|---|---|---|
| **M1** | Chainlink Weather Oracle integration — automated parametric default triggers live on Devnet | On-chain program upgrade; Chainlink oracle account visible on Solana Explorer | $2,000 |
| **M2** | Independent smart contract security audit (Solana-specialized firm) | Published audit report linked in GitHub repo | $3,000 |
| **M3** | India cooperative pilot — onboard 1 verified farming cooperative for a live Devnet simulation end-to-end | GitHub documentation of the pilot run; on-chain transaction log | $2,000–$3,000 |

### Why milestone-gated?

Each milestone produces a verifiable, public output. The Solana Foundation can confirm on-chain progress before each tranche is released — no trust required from either side.

---

## Why Solana?

| Requirement | Why Solana Wins |
|---|---|
| Settlement speed | ~400ms finality — critical for real-time yield distribution to multiple investors |
| Transaction cost | Sub-cent fees make micro-investment positions viable for small cooperatives |
| SPL Tokens | Native composable token standard enables per-pool receipt instruments without external infrastructure |
| Anchor Framework | Rust-enforced safety constraints and IDL generation for trustless, auditable contracts |
| Oracle ecosystem | Chainlink weather data available natively — essential for V2 parametric insurance automation |
| USDC on Solana | Circle's native USDC enables institutional-grade settlement without bridging friction |

---

## Why This Grant?

1. **It's already built** — This grant accelerates maturation of a live, working protocol, not an idea deck.
2. **India-specific impact** — AgriFund directly targets agricultural finance for India's 600M+ farmers, the core mandate of the Solana Foundation India program.
3. **Open source** — Every deliverable will be published publicly, creating reusable infrastructure for future builders in the Solana India ecosystem.
4. **Milestone-gated** — Funds release only on verifiable on-chain delivery. Zero trust required.

---

## Contact

- **GitHub:** https://github.com/jigglu/agrifund
- **Live App:** https://agrifund-rwa.vercel.app
- **Solana Explorer:** https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet

---

*Application prepared for the Superteam Solana Foundation India Grants program.*
*Grant URL: https://superteam.fun/earn/grants/solana-foundation-india-grants*
