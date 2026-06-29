'use client';

import { FC, ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

const NAV_LINKS = [
  { href: '/dashboard/estate',    label: 'Estates',    desc: 'Manage yield pools' },
  { href: '/dashboard/investor',  label: 'Markets',    desc: 'Fund & trade yield'  },
  { href: '/dashboard/portfolio', label: 'Portfolio',  desc: 'View active investments' },
];

const DashboardLayout: FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { publicKey, connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClaimFaucet = async () => {
    if (!publicKey) return;
    setIsClaimingFaucet(true);
    setFaucetStatus('Requesting...');
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: publicKey.toBase58() })
      });
      const data = await res.json();
      if (data.success) {
        setFaucetStatus('+$1000 USDC');
        setTimeout(() => setFaucetStatus(null), 5000);
      } else {
        setFaucetStatus('Failed');
        setTimeout(() => setFaucetStatus(null), 5000);
      }
    } catch {
      setFaucetStatus('Error');
      setTimeout(() => setFaucetStatus(null), 5000);
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* ── App Header ─────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: scrolled ? 'rgba(8,8,8,0.95)' : 'rgba(8,8,8,0.6)',
        borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 16px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }} className="sm:px-6">

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)', flexShrink: 0 }} />
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }} className="hidden xs:inline">
              Agri<span style={{ color: 'var(--accent)' }}>Fund</span>
            </span>
          </Link>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} className="hidden xs:block" />

          {/* Nav pills */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {NAV_LINKS.map(link => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: active ? '1px solid var(--border)' : '1px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                  className="sm:px-3.5 sm:text-xs"
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Network badge */}
          <div style={{
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }} className="hidden md:flex">
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            DEVNET
          </div>

          {/* Faucet button */}
          {mounted && connected && publicKey && (
            <button
              onClick={handleClaimFaucet}
              disabled={isClaimingFaucet}
              style={{
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: isClaimingFaucet ? 0.5 : 1,
              }}
              className="hidden sm:flex"
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {faucetStatus || (isClaimingFaucet ? 'Requesting...' : 'USDC Faucet')}
            </button>
          )}

          {/* Wallet address pill */}
          {mounted && connected && publicKey && (
            <div style={{
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(34,197,94,0.2)',
              background: 'var(--accent-dim)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--accent)',
            }} className="hidden lg:flex">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
            </div>
          )}

          {/* Wallet button */}
          {mounted && (
            <WalletMultiButton style={{
              background: 'var(--accent)',
              color: '#000',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              height: '34px',
              padding: '0 14px',
              border: 'none',
            }} />
          )}
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px' }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              AgriFund Protocol · Solana Devnet
            </span>
          </div>
          <Link href="/" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ← Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
