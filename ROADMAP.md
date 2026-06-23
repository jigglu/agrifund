# AgriFund — Protocol Roadmap

## Current Status

**AgriFund V1 is 100% feature-complete and live on Solana Devnet.**

- **Program ID:** `3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5`
- **Live App:** [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app)
- **Explorer:** [View on Solana Explorer →](https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet)

---

## What's Shipped (V1)

| Feature | Details | Status |
|---|---|---|
| Core protocol | PDA vaults, receipt token minting, vesting drawdown, parametric default state machine | ✅ Live on Devnet |
| 7 on-chain instructions | `initialize_pool`, `fund_yield`, `refund_investment`, `withdraw_capital`, `settle_pool`, `trigger_default`, `claim_yield` | ✅ Deployed |
| SPL token metadata | Metaplex Metadeta V3 integration — per-pool named tokens (`agriGRAIN`, `agriOIL`) | ✅ Complete |
| Partial refunds | Investors can exit and reclaim USDC before farming starts | ✅ Complete |
| Estate Portal | Frontend for farming cooperatives to create and manage yield pools | ✅ Live |
| Investor Dashboard | Frontend for investors to fund pools, track positions, and claim yield | ✅ Live |
| Full test suite | Anchor TypeScript tests covering the complete protocol lifecycle | ✅ Complete |

---

## Roadmap

### V2 — Chainlink Weather Oracle Integration *(Next)*

**Goal:** Replace the current admin-triggered `trigger_default` with a live Chainlink weather oracle feed that automatically sets pools to `Defaulted` based on verifiable on-chain weather data (drought, flood, frost).

**Deliverables:**
- Chainlink oracle account integrated into the `trigger_default` instruction
- On-chain verification of weather threshold (e.g., rainfall below X mm/month)
- Updated Devnet deployment
- New test coverage for oracle-triggered defaults

**Impact:** This is the single highest-value technical upgrade — it transforms the parametric insurance model from simulated to real, making AgriFund production-ready for mainnet.

---

### V3 — Independent Security Audit *(Next)*

**Goal:** Commission an independent security audit from a Solana-specialized firm before mainnet deployment.

**Scope:**
- All 7 on-chain instructions in `programs/agrifund/src/lib.rs`
- PDA derivation security (vault seeds, receipt mint seeds)
- Integer overflow / underflow checks
- Signer and account constraint validation
- Vesting math correctness

**Deliverables:**
- Published audit report (linked in GitHub repo)
- Remediation of all critical and high-severity findings

---

### V4 — India Cooperative Pilot *(Next)*

**Goal:** Onboard 1 verified Indian farming cooperative for a complete end-to-end simulation on Devnet — from KYC/documentation through pool initialization, investor funding, capital drawdown, harvest, and settlement.

**Deliverables:**
- Pilot documentation published in GitHub (`/docs/pilot/`)
- On-chain transaction log of the full lifecycle
- Learnings report for V5 mainnet parameterization (vesting duration, yield targets, region data)

---

### V5 — Mainnet Deployment *(Planned)*

**Goal:** Deploy AgriFund to Solana Mainnet-Beta with real USDC and live cooperative integration.

**Prerequisites:**
- V3 audit complete, all critical findings resolved
- V4 pilot complete, mainnet parameters validated
- Legal review of cooperative onboarding structure

---

## Grant Funding

The V2, V3, and V4 milestones are being pursued through the [Superteam Solana Foundation India Grants](https://superteam.fun/earn/grants/solana-foundation-india-grants) program.

See [GRANT_APPLICATION.md](GRANT_APPLICATION.md) for the full application and milestone budget breakdown.

---

## Open Source Commitment

AgriFund is fully open source. All smart contracts, IDL, and frontend code are publicly available at [github.com/jigglu/agrifund](https://github.com/jigglu/agrifund). All future milestones will remain open source to contribute reusable infrastructure to the Solana India developer ecosystem.
