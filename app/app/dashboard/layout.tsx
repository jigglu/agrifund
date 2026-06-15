'use client';

import { FC, ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

const NAV_LINKS = [
  { href: '/dashboard/estate',   label: 'Estate Portal',   icon: '🏡', desc: 'Manage yield pools' },
  { href: '/dashboard/investor', label: 'Investor Market', icon: '📊', desc: 'Fund & trade yield'  },
];

const DashboardLayout: FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { publicKey, connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-[#050d14] text-white flex flex-col">
      {/* ── Top nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#050d14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mr-4 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow shadow-emerald-900/50">
              <span className="text-sm">🌱</span>
            </div>
            <span className="text-base font-bold tracking-tight hidden sm:block">
              Agri<span className="text-emerald-400">Fund</span>
            </span>
          </Link>

          {/* Portal nav pills */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(link => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span className="hidden sm:block">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Network badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Devnet
          </div>

          {/* Wallet address */}
          {mounted && connected && publicKey && (
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono font-medium text-emerald-400">
                {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
              </span>
            </div>
          )}

          {/* Wallet button */}
          {mounted && (
            <WalletMultiButton style={{
              background: 'linear-gradient(135deg,#059669,#0d9488)',
              borderRadius: '0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              height: '2.25rem',
              padding: '0 1rem',
            }} />
          )}
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-slate-800/60 px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-slate-600">
          <span>🦍 Apes strong together | Yielding Real-World Value on Solana</span>
          <Link href="/" className="hover:text-slate-400 transition-colors">← Home</Link>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
