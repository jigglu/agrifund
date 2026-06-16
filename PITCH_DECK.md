# AgriFund: Superteam Grant Pitch Deck

## Slide 1: Title & Hook
* **Headline:** AgriFund 🌾
* **Sub-headline:** Decentralizing Real-World Agricultural Yields on Solana.
* **The Hook:** A cause-driven RWA protocol bridging the gap between global Web3 liquidity and real-world Indian farming cooperatives through trustless, composable escrow.

---

## Slide 2: The Problem (Financial Exclusion)
* **For Farmers:** Traditional agricultural loans in India are slow, localized, and plagued by predatory interest rates. Farmers lack access to borderless capital.
* **For Web3 Investors:** DeFi yields are often circular and speculative. Investors lack access to stable, tangible Real-World Asset (RWA) returns that positively impact the physical world.
* **The Trust Gap:** You cannot put a physical farm on the blockchain. How do investors fund a cooperative without the risk of a rug-pull?

---

## Slide 3: The Solution (AgriFund Architecture)
* **Decentralized Escrow:** Capital is secured in mathematically verifiable Program Derived Address (PDA) vaults, not centralized multi-sigs.
* **Composable Receipt Tokens:** Every 1 USDC deposited mints exactly 1 **Pool Receipt Token** — a per-pool SPL token controlled by a PDA mint authority seeded to that specific yield pool. Investors hold cryptographic proof of their yield position, fully transferable on Solana.
* **Institutional-Grade Smart Contracts:** Built entirely on Solana using the Anchor framework for micro-cent precision and hyper-fast settlement.

---

## Slide 4: Proof of Work (The MVP)
* **Status:** 100% Feature Complete & Live on Solana Devnet. *(Speed > Perfection)*.
* **The Tech Stack:**
  * Smart Contracts: Rust / Anchor Framework
  * Frontend: Next.js / React / Tailwind CSS
  * Web3 Integration: `@solana/web3.js` / Anchor TS
* **Devnet Token:** USDC is simulated using a custom AgriUSD SPL token on Devnet for permissionless testing without requiring real funds.
* **Live Deployment:** Full functional frontend hosted on Vercel, demonstrating immediate Product-Founder fit.

---

## Slide 5: The Security Guardrails (Parametric Insurance)
* **Anti-Rug Time-Locks:** Farmers cannot withdraw 100% of the funds upfront. Capital unlocks via a strict linear vesting schedule driven by Solana's on-chain `Clock`. *(Vesting duration is set to 180 seconds on Devnet for live demonstration purposes; production values will reflect a full farming season.)*
* **Early-Stage Liquidity:** Investors can burn their receipt tokens to reclaim their exact USDC principal at any time before the farming season officially begins (while pool status is `Open`). Once farming starts and capital begins vesting, early refunds are disabled.
* **Climate-Resilient Insurance Override:** If a verifiable natural disaster (e.g., drought) occurs, an administrative oracle sets the pool status to `Defaulted`. This immediately unlocks investor claims — investors burn their receipt tokens to withdraw their proportional share of remaining vault capital.

---

## Slide 6: The Financial Lifecycle
1. **Initialize:** Estate sets a hard USDC target (`total_yield_kg × price_per_kg`) and yield price on-chain.
2. **Fund:** Investors deposit USDC and receive 1:1 Pool Receipt Tokens, minted by a per-pool PDA-controlled mint.
3. **[Optional] Early Refund:** Before farming begins, investors can burn receipt tokens to reclaim their exact USDC principal at any time.
4. **Farm:** Pool locks when the estate triggers the first drawdown. Funds vest to the farmer linearly over time via on-chain `Clock`.
5. **Settle:** Harvest profits are deposited back into the vault by the estate authority via `settle_pool`.
6. **Claim:** Investors burn their receipt tokens to withdraw their proportional share of the vault (principal + crop yield).

---

## Slide 7: Roadmap & Open Source Commitment
* **V2:** Integration of live Chainlink Weather Oracles for automated parametric insurance triggers.
* **V3:** Multisig auditor guardrails requiring agronomist sign-off before releasing massive capital tranches.
* **Open Source:** AgriFund's full protocol — smart contracts, IDL, and frontend — is already publicly available on GitHub. All core infrastructure will remain open source to support the broader Solana developer ecosystem.
