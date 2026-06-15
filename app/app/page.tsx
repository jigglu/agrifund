'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const FEATURES = [
  {
    icon: '🛡️',
    title: 'Parametric Crop Insurance',
    desc: 'Automated weather-triggered payouts via on-chain oracle feeds. Estates are protected against flood, drought, and frost — with no manual claims process.',
    tag: 'Risk Management',
  },
  {
    icon: '🏛️',
    title: 'Admin-Whitelisted Estates',
    desc: 'Only KYC-verified farming estates can create yield pools. Each estate\'s legal title, soil analysis, and insurance policy are anchored to Arweave before minting.',
    tag: 'Compliance',
  },
  {
    icon: '💵',
    title: 'USDC Instant Settlement',
    desc: 'Investors fund pools in USDC. Yield accrues on-chain as produce is harvested and sold. Settlements clear in ~400ms on Solana with full audit trail.',
    tag: 'Infrastructure',
  },
];

const PARTNERS = ['Solana Foundation', 'Regional AgriCorp', 'Chainlink', 'Circle', 'Arweave'];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = ((e.clientX - left) / width - 0.5) * 20;
      const y = ((e.clientY - top) / height - 0.5) * 20;
      el.style.setProperty('--rx', `${y}deg`);
      el.style.setProperty('--ry', `${x}deg`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="min-h-screen bg-[#020b12] text-white overflow-x-hidden">

      {/* ── Ambient background ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-950/60 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-teal-950/40 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxIiBmaWxsPSIjMGY3NjU2IiBmaWxsLW9wYWNpdHk9IjAuMDgiLz48L2c+PC9zdmc+')] opacity-40" />
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="relative z-50 border-b border-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/60">
              <span className="text-lg">🌱</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              Agri<span className="text-emerald-400">Fund</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Protocol', 'Estates', 'Investors', 'Docs'].map(item => (
              <a key={item} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all hover:from-emerald-500 hover:to-teal-400 hover:shadow-emerald-500/30 active:scale-[0.97]"
          >
            Launch App →
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-28 pb-24 text-center">
        {/* Protocol badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Real-World Asset Protocol · Built on Solana
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          Tokenized
          <span className="relative mx-3">
            <span className="relative z-10 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Agricultural
            </span>
            <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50" />
          </span>
          Yield on Solana
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
          AgriFund connects KYC-verified farming estates with global institutional investors.
          Real-world harvest yield becomes on-chain collateral — funded in USDC,
          settled in milliseconds, protected by parametric insurance.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-900/50 transition-all hover:from-emerald-500 hover:to-teal-400 hover:shadow-emerald-500/40 active:scale-[0.97]"
          >
            Launch App
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="https://github.com"
            className="rounded-2xl border border-slate-700 bg-slate-800/50 px-8 py-4 text-base font-semibold text-slate-300 backdrop-blur transition-all hover:border-slate-500 hover:bg-slate-800 hover:text-white"
          >
            View Protocol →
          </a>
        </div>


      </section>

      {/* ── Feature Grid ──────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 bg-gradient-to-b from-transparent to-slate-900/30">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-500 mb-3">Institutional Architecture</p>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Built for Real-World Asset Finance
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-slate-400">
              Every protocol feature is designed around the compliance, risk management,
              and settlement standards that institutional capital requires.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-7 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-900/90 hover:shadow-2xl hover:shadow-emerald-900/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-5 pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl mb-5">
                  {f.icon}
                </span>
                <div className="mb-3">
                  <span className="inline-flex rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>

                <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-500">
                  <span>Learn more</span>
                  <svg className="h-3 w-3 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-500 mb-3">Protocol Flow</p>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">How AgriFund Works</h2>
          </div>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-emerald-500/20 via-teal-500/40 to-emerald-500/20 hidden sm:block" />
            <div className="grid gap-6 sm:grid-cols-4">
              {[
                { step: '01', icon: '🏡', title: 'Estate Onboarding', desc: 'Farming estates complete KYC. Legal docs & insurance anchored to Arweave.' },
                { step: '02', icon: '⛓',  title: 'Pool Creation',     desc: 'Verified estate mints a YieldPool on-chain. Yield & pricing locked in smart contract.' },
                { step: '03', icon: '💰', title: 'USDC Funding',      desc: 'Accredited investors fund the pool. Capital held in program-owned escrow.' },
                { step: '04', icon: '📈', title: 'Yield Settlement',  desc: 'Harvested produce sold. USDC distributed to investors proportionally on-chain.' },
              ].map(item => (
                <div key={item.step} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-slate-900 text-2xl shadow-lg shadow-emerald-900/20">
                    {item.icon}
                  </div>
                  <span className="text-xs font-bold text-emerald-500 mb-2">{item.step}</span>
                  <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Partners strip ────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-14 border-y border-slate-800/60">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-base font-semibold text-slate-300 mb-2">
            Bridging the Gap
          </p>
          <p className="text-center text-xs text-slate-500 mb-8 tracking-wide">
            Built on Solana, Rooted in Real-World Agriculture
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {PARTNERS.map(p => (
              <span key={p} className="text-sm font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-default">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-28 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/30 via-slate-900/60 to-teal-900/20 p-12 backdrop-blur-sm">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl mb-4">
              Ready to tokenize your yield?
            </h2>
            <p className="text-slate-400 mb-8">
              Estate operators and institutional investors — launch the app, connect your wallet, and go on-chain in minutes.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-900/50 transition-all hover:from-emerald-500 hover:to-teal-400 hover:shadow-emerald-500/40 active:scale-[0.97]"
            >
              🚀 Launch the Protocol
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-slate-800/60 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="text-base">🌱</span>
            <span>AgriFund Protocol © 2025 · Built on Solana</span>
          </div>
          <div className="flex gap-6">
            {['Docs', 'GitHub', 'Discord', 'Privacy', 'Terms'].map(l => (
              <a key={l} href="#" className="hover:text-slate-400 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
