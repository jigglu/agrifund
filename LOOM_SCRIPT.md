# AgriFund — Loom Demo Recording Script

> **Target length:** 2 minutes 30 seconds – 3 minutes
> **Tool:** Loom (loom.com) or QuickTime Screen Recording
> **Setup before recording:**
> - Phantom/Backpack wallet connected to **Devnet**
> - Tab 1: [agrifund-rwa.vercel.app](https://agrifund-rwa.vercel.app)
> - Tab 2: [Solana Explorer — Program](https://explorer.solana.com/address/3AKoohaxhVPTUNuQAdXPFHf3wAQ5JngY5FnksSuptrp5?cluster=devnet)
> - Tab 3: [GitHub Repo](https://github.com/jigglu/agrifund)
> - Mic check done, browser zoom at 110% for clarity
> - Close Slack/notifications

---

## Section 1: Hook (0:00 – 0:20)

**[Start on the landing page: agrifund-rwa.vercel.app]**

> "Indian farming cooperatives pay 18 to 36% APR to informal moneylenders — not because their yield is bad, but because they can't access global capital.
>
> AgriFund fixes that. It's a live, on-chain agricultural lending protocol on Solana that gives DeFi investors trustless exposure to real-world farm yield — and gives farmers access to global capital at fair rates.
>
> This is fully deployed on Solana Devnet. Let me show you how it works."

**[Slowly scroll down the landing page as you talk — don't rush]**

---

## Section 2: Show the Live On-Chain Proof (0:20 – 0:45)

**[Switch to Tab 2: Solana Explorer]**

> "Before we touch the app — here's the on-chain proof. This is the AgriFund program deployed on Solana Devnet. Program ID: 3AKo... — you can verify this yourself. The program is active. All seven instructions are live."

**[Hover over the program ID, show the transaction history, point to recent activity]**

> "Every single interaction — pool creation, investor funding, capital drawdown, settlement, yield claim — is recorded here on-chain. Immutable. Verifiable. No trust required."

**[Switch back to the app]**

---

## Section 3: Estate Portal — Create a Pool (0:45 – 1:20)

**[Navigate to Estate Portal: /dashboard/estate]**

> "Let's walk through the full lifecycle. First — I'm acting as a farming estate. I connect my wallet — set to Devnet — and I create a yield pool."

**[Click "Create Pool" or "Initialize Pool" button — fill in the form if not pre-filled]**

> "I set the estate name, crop type — let's say Basmati Rice — the total yield in kilograms, price per kilogram, and the vesting duration for capital drawdown.
>
> When I submit this, the protocol does three things on-chain simultaneously: it creates a YieldPool account, initializes a PDA token vault, and derives a unique SPL receipt token — in this case, an `agriGRAIN` token — with Metaplex metadata attached."

**[Wait for the transaction to confirm — show the wallet approval popup]**

> "Transaction confirmed. Pool is now open for investor funding."

---

## Section 4: Investor Dashboard — Fund the Pool (1:20 – 1:50)

**[Navigate to Investor Dashboard: /dashboard/investor]**

> "Now I switch roles — I'm an investor. I can see the open pool. Let me fund it."

**[Click "Fund Pool" — enter an amount]**

> "I'm depositing AgriUSD — the mock USDC on Devnet. The protocol transfers my tokens into the PDA vault and mints an exact 1:1 amount of receipt tokens back to my wallet. These receipt tokens are my cryptographic claim on the vault — burn them to get your capital and yield back."

**[Show wallet approval — wait for confirmation]**

> "The pool is now funded. Notice the vault balance has updated. The receipt token balance in my wallet has updated. All on-chain, all verifiable."

---

## Section 5: Farmer Drawdown — Linear Vesting (1:50 – 2:10)

**[Back to Estate Portal or trigger the withdrawal]**

> "The estate authority can now start drawing down capital — but not all at once. This is the anti-rug guardrail. Capital unlocks linearly over time using Solana's on-chain Clock. The farmer can only withdraw what's vested at any given moment."

**[Trigger withdraw_capital — show the amount limited by vesting]**

> "Notice the system enforces the drawdown cap automatically — no manual oversight required. This is the smart contract enforcing institutional-grade disbursement controls."

---

## Section 6: Settlement & Yield Claim (2:10 – 2:35)

**[If pool has settled, show settle and claim — or narrate if you need to skip for time]**

> "After the harvest, the estate calls `settle_pool` and deposits the principal plus crop yield back into the vault.
>
> Now — the investor burns their receipt tokens and claims their proportional share. The math is on-chain: vault balance times your share of total receipt supply.
>
> No intermediary. No manual calculation. No trust in a counterparty."

**[Show the final transaction or narrate over the UI]**

---

## Section 7: Close & CTA (2:35 – 2:55)

**[Switch to GitHub repo tab briefly]**

> "The full protocol — smart contracts, IDL, frontend — is open source on GitHub. Apache test suite is included. You can clone and run `anchor test` to verify everything locally."

**[Switch back to the landing page]**

> "AgriFund is live on Solana Devnet today. The next step is Chainlink oracle integration for automated parametric insurance, a security audit, and a live pilot with a real Indian farming cooperative.
>
> This is what real-world asset infrastructure looks like on Solana. Links in the description."

**[End recording]**

---

## Post-Recording Checklist

- [ ] Trim any dead air or fumbles in Loom editor
- [ ] Add a title card at the start: "AgriFund Protocol — Live on Solana Devnet"
- [ ] Add captions if Loom supports it (accessibility + silent autoplay)
- [ ] Set Loom video to **Anyone with the link can view** (no sign-in required)
- [ ] Copy the Loom share URL
- [ ] Paste the Loom URL into your GitHub README (under a `## 🎬 Demo` section) and into your Superteam grant application

## Where to Use This Video

| Destination | Notes |
|---|---|
| **GitHub README** | Embed as a Loom link or animated GIF of the first frame + link |
| **Superteam grant application** | Paste the Loom URL in the "Demo / Video" field — this is the #1 trust signal for reviewers |
| **Superteam Discord #showcase** | Share with the link + 1-line hook |
| **Twitter/X** | Post as a thread with the video attached |
