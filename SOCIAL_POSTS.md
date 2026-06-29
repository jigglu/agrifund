# AgriFund — Social Media Posts

> Ready-to-paste copy for Superteam Discord and Twitter/X.
> Replace `[your name]` and `[your handle]` with your own.

---

## Superteam Discord — #projects / #showcase

**Post this in the Superteam Discord `#projects` or `#showcase` channel:**

```
🌾 Built something for Indian farmers on Solana — shipping it today.

AgriFund is a decentralized RWA agricultural lending protocol that bridges global Web3 capital with Indian farming cooperatives through trustless PDA escrow vaults + composable SPL receipt tokens.

Here's the problem: Indian cooperatives pay 18–36% APR to informal moneylenders not because they're bad borrowers — but because they can't access global capital. AgriFund fixes that.

Here's how it works on-chain:
→ Estate creates a yield pool (hard USDC target, vesting duration, crop metadata)
→ Investors fund in USDC, receive 1:1 receipt tokens (per-pool SPL tokens via Metaplex)
→ Farmer draws capital linearly via Solana Clock — anti-rug vesting built-in
→ At harvest, estate settles. Investors burn receipts to claim principal + yield
→ If a weather disaster hits, parametric insurance override unlocks immediate reclaim

All 7 instructions live on Devnet → 3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5

🖥 Live app: https://agrifund-rwa.vercel.app
💻 GitHub: https://github.com/jigglu/agrifund
🔍 On-chain: https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet

Have applied to the Solana Foundation India Grants. Would love feedback from the community 🙏
```

---

## Twitter/X — Main Thread

**Tweet 1 (hook):**
```
Indian farmers pay 18–36% APR to moneylenders not because they're bad borrowers — but because they can't access global capital.

I built something to fix that.

🌾 AgriFund — decentralized agricultural RWA lending on @solana

Thread 🧵
```

**Tweet 2 (what it does):**
```
AgriFund creates trustless yield pools for farming cooperatives.

Investors fund in USDC → receive 1:1 receipt tokens (SPL, per-pool)
Farmers draw capital linearly via on-chain vesting (no rug)
At harvest → investors burn tokens to claim principal + yield

All enforced by a Rust smart contract. No admin key.
```

**Tweet 3 (the anti-rug mechanism):**
```
The biggest risk in agricultural lending: farmers disappearing with the capital.

AgriFund's solution: linear vesting via Solana's on-chain Clock.

The smart contract literally won't let you withdraw more than your vested tranche.

This is institutional-grade DeFi disbursement — built for real-world agriculture.
```

**Tweet 4 (parametric insurance):**
```
What happens if a drought wipes out the harvest?

AgriFund has a parametric insurance override.

An oracle can set the pool to "Defaulted" → immediately freezes farmer vesting → unlocks investor claims proportional to vault balance.

V2 replaces the mock oracle with a live Chainlink weather feed.
```

**Tweet 5 (proof / traction):**
```
It's not a deck. It's deployed.

→ 7 instructions live on Solana Devnet
→ Full frontend: agrifund-rwa.vercel.app
→ Metaplex receipt tokens (agriGRAIN, agriOIL) per pool
→ Anchor test suite covering the full lifecycle
→ Fully open source: github.com/jigglu/agrifund

Program ID: 3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5
```

**Tweet 6 (CTA):**
```
Applied to the @superteam @SolanaFndn India Grants to fund:
→ Chainlink weather oracle integration
→ Independent smart contract audit
→ Live India cooperative pilot

Would love your feedback, a star on the repo, or a RT if you think RWA lending on Solana matters 🙏

🌾 https://agrifund-rwa.vercel.app
💻 https://github.com/jigglu/agrifund
```

---

## Twitter/X — Single Tweet (if no thread)

```
I built a decentralized agricultural lending protocol on @solana for Indian farming cooperatives 🌾

AgriFund uses PDA escrow + SPL receipt tokens + linear vesting to give farmers access to global DeFi capital — without counterparty risk.

Live on Devnet → agrifund-rwa.vercel.app
GitHub → github.com/jigglu/agrifund

Applied to @superteam India grants. Feedback welcome 🙏
```

---

## LinkedIn Post (optional)

```
I've been building a decentralized RWA protocol for Indian agricultural cooperatives on Solana — and it's now live on Devnet.

The problem: Indian farming cooperatives pay 18–36% APR to informal moneylenders simply because they lack access to global capital markets. DeFi investors, on the other hand, have no credible on-ramp to stable, real-world yield.

AgriFund bridges the two through:
• Trustless PDA escrow vaults — no admin key, no multi-sig
• Composable SPL receipt tokens — 1 USDC deposited = 1 receipt token, burn to reclaim
• Linear capital vesting — farmers can't withdraw upfront, funds unlock over the farming season via on-chain Clock

The protocol is fully feature-complete, deployed on Solana Devnet, and open source.

Live app: agrifund-rwa.vercel.app
GitHub: github.com/jigglu/agrifund

I've applied to the Superteam Solana Foundation India Grants to fund the next three milestones: Chainlink weather oracle integration, a security audit, and a live cooperative pilot.

Would appreciate any feedback, especially from anyone working in agricultural finance, DeFi infrastructure, or the Solana ecosystem.
```

---

## Ask Peers (DM template)

```
Hey [name] — I just shipped AgriFund, a DeFi protocol on Solana for agricultural lending. Would mean a lot if you could:

1. Star the GitHub repo: https://github.com/jigglu/agrifund
2. Try the live app (Devnet): https://agrifund-rwa.vercel.app
3. RT my Twitter thread if you think it's worth sharing: [your tweet URL]

Applied to the Solana Foundation India Grants — community engagement really helps reviewers take it seriously. Takes 30 seconds 🙏
```
