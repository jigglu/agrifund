'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   DATA CONSTANTS
   ───────────────────────────────────────────────────────────────────────── */

const TICKER_ITEMS = [
  { label: 'Wheat Yield', icon: '⟁', id: 'WHEAT-KE' },
  { label: 'Corn Pool', icon: '◈', id: 'CORN-IN' },
  { label: 'Coffee Estate', icon: '◉', id: 'COFFEE-ET' },
  { label: 'Rice Harvest', icon: '◌', id: 'RICE-VN' },
  { label: 'Olive Grove', icon: '◎', id: 'OLIVE-MA' },
  { label: 'Cacao Farm', icon: '◆', id: 'CACAO-GH' },
];

const FEATURES = [
  {
    tag: 'Risk Management',
    title: 'Parametric Crop Insurance',
    desc: 'Weather-triggered payouts via on-chain oracle feeds. Protected against flood, drought, and frost — zero manual claims.',
    accent: true,
  },
  {
    tag: 'Compliance',
    title: 'Admin-Whitelisted Estates',
    desc: 'Only KYC-verified estates create yield pools. Legal title, soil analysis, and insurance policy anchored to Arweave before minting.',
    accent: false,
  },
  {
    tag: 'Infrastructure',
    title: 'USDC Instant Settlement',
    desc: 'Investors fund pools in USDC. Yield accrues on-chain as produce is harvested. Settlements clear in ~400ms with full audit trail.',
    accent: false,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Estate Onboarding',
    desc: 'KYC-verified farms anchor legal docs to Arweave.',
  },
  {
    n: '02',
    title: 'Pool Creation',
    desc: 'Verified estate mints a YieldPool on-chain.',
  },
  {
    n: '03',
    title: 'USDC Funding',
    desc: 'Accredited investors fund pools in USDC escrow.',
  },
  {
    n: '04',
    title: 'Yield Settlement',
    desc: 'Harvest sold. USDC distributed proportionally.',
  },
];

const POOL_ROWS = [
  { estate: 'Kenyan Coffee Estate', crop: 'Arabica Coffee', size: '$2.4M', apy: '14.2%', status: 'Active', funded: '94%' },
  { estate: 'Punjab Wheat Farm', crop: 'Durum Wheat', size: '$1.8M', apy: '11.7%', status: 'Active', funded: '100%' },
  { estate: 'Mekong Rice Collective', crop: 'Jasmine Rice', size: '$3.1M', apy: '9.8%', status: 'Funding', funded: '61%' },
  { estate: 'Andalusian Olive Grove', crop: 'Arbequina Olives', size: '$5.2M', apy: '12.3%', status: 'Active', funded: '100%' },
  { estate: 'Ghana Cacao Cooperative', crop: 'Forastero Cacao', size: '$890K', apy: '16.1%', status: 'Funding', funded: '38%' },
  { estate: 'Iowa Corn Reserve', crop: 'Yellow Corn', size: '$4.4M', apy: '8.5%', status: 'Settled', funded: '100%' },
];

const COLLATERAL = [
  {
    category: 'Grain Crops',
    pct: 44,
    color: '#22c55e',
    items: ['Wheat-POOL', 'Corn-POOL', 'Rice-POOL'],
  },
  {
    category: 'Cash Crops',
    pct: 31,
    color: '#86efac',
    items: ['Coffee-POOL', 'Cacao-POOL', 'Olive-POOL'],
  },
  {
    category: 'Livestock & Dairy',
    pct: 25,
    color: '#4ade80',
    items: ['Dairy-POOL', 'Cattle-POOL'],
  },
];

const PARTNERS = [
  { name: 'Solana', short: 'SOL' },
  { name: 'Chainlink', short: 'LINK' },
  { name: 'Circle', short: 'USDC' },
  { name: 'Arweave', short: 'AR' },
  { name: 'AgriCorp', short: 'RWA' },
];

const STATS = [
  { value: 24.8, suffix: 'M', prefix: '$', label: 'Total Value Locked' },
  { value: 147, suffix: '', prefix: '', label: 'Verified Estates' },
  { value: 400, suffix: 'ms', prefix: '', label: 'Avg Settlement' },
  { value: 0.00001, suffix: '', prefix: '$', label: 'Average Fee' },
];

/* ─────────────────────────────────────────────────────────────────────────
   STATUS PILL
   ───────────────────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; dot: string }> = {
    Active:  { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', dot: '#22c55e' },
    Funding: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', dot: '#f59e0b' },
    Settled: { bg: 'rgba(136,136,136,0.12)', text: '#888888', dot: '#888888' },
  };
  const c = cfg[status] ?? cfg['Settled'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '999px',
        background: c.bg,
        color: c.text,
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.dot,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const collateralRef = useRef<HTMLDivElement>(null);
  const [statValues, setStatValues] = useState([0, 0, 0, 0]);
  const [terminalText, setTerminalText] = useState('');
  const [barsVisible, setBarsVisible] = useState(false);

  const CLI_TEXT = `$ agrifund-cli auth --wallet 7xKm...9pQ2
✓ Wallet verified. 3 pools available.

$ agrifund-cli pools list --status active
→ Fetching 147 pools...

  WHEAT-KE-2025   $1.8M   11.7% APY   ████████ 100%
  COFFEE-ET-2025  $2.4M   14.2% APY   ████████  94%
  OLIVE-MA-2025   $5.2M   12.3% APY   ████████ 100%

$ agrifund-cli invest --pool WHEAT-KE-2025 --amount 5000 USDC
→ Opening position...
✓ Position opened. Tx: 4xKmR9...mR9`;

  useEffect(() => {
    // ── Nav scroll effect
    const nav = navRef.current;
    const handleScroll = () => {
      if (!nav) return;
      if (window.scrollY > 40) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // ── Section reveal observer
    const revealEls = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = parseInt(el.dataset.delay ?? '0', 10);
            setTimeout(() => el.classList.add('visible'), delay);
            revealObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));

    // ── Stats count-up observer
    const statsEl = statsRef.current;
    if (statsEl) {
      const statsObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const targets = [24.8, 147, 400, 0.00001];
            const duration = 1500;
            const steps = 60;
            const interval = duration / steps;
            let step = 0;
            const timer = setInterval(() => {
              step++;
              const progress = step / steps;
              const ease = 1 - Math.pow(1 - progress, 3);
              setStatValues(targets.map((t) => parseFloat((t * ease).toPrecision(4))));
              if (step >= steps) {
                clearInterval(timer);
                setStatValues(targets);
              }
            }, interval);
            statsObserver.unobserve(statsEl);
          }
        },
        { threshold: 0.5 }
      );
      statsObserver.observe(statsEl);
    }

    // ── Terminal typewriter observer
    const terminalEl = terminalRef.current;
    if (terminalEl) {
      let started = false;
      const terminalObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !started) {
            started = true;
            let i = 0;
            const timer = setInterval(() => {
              i++;
              setTerminalText(CLI_TEXT.slice(0, i));
              if (i >= CLI_TEXT.length) clearInterval(timer);
            }, 18);
            terminalObserver.unobserve(terminalEl);
          }
        },
        { threshold: 0.3 }
      );
      terminalObserver.observe(terminalEl);
    }

    // ── Collateral bars observer
    const collateralEl = collateralRef.current;
    if (collateralEl) {
      const collateralObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setBarsVisible(true);
            collateralObserver.unobserve(collateralEl);
          }
        },
        { threshold: 0.3 }
      );
      collateralObserver.observe(collateralEl);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      revealObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* stat display helper */
  const formatStat = (i: number, v: number) => {
    const { prefix, suffix } = STATS[i];
    if (i === 3) return `${prefix}${v.toFixed(5)}`;
    if (i === 0) return `${prefix}${v.toFixed(1)}${suffix}`;
    return `${prefix}${Math.round(v)}${suffix}`;
  };

  /* ── RENDER ── */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        overflowX: 'hidden',
      }}
    >

      {/* ══════════════════════════════════════════════════════════════
          1. NAV
          ══════════════════════════════════════════════════════════════ */}
      <nav
        ref={navRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'transparent',
          borderBottom: '1px solid transparent',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--content-width)',
            margin: '0 auto',
            padding: '0 24px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent)',
                boxShadow: '0 0 8px var(--accent-glow)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              Agri<span style={{ color: 'var(--accent)' }}>Fund</span>
            </span>
          </Link>

          {/* Nav links (hidden on mobile) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
            }}
            className="hidden md:flex"
          >
            {[
              { label: 'Protocol', href: '/' },
              { label: 'Estates', href: '/dashboard/estate' },
              { label: 'Investors', href: '/dashboard/investor' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 'var(--pill-radius)',
                background: 'var(--accent)',
                color: '#000',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Launch App →
            </Link>
          </div>

          {/* Mobile: only show Launch App */}
          <Link
            href="/dashboard"
            className="flex md:hidden"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--pill-radius)',
              background: 'var(--accent)',
              color: '#000',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          2. HERO
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '64px',
          paddingBottom: '0',
          overflow: 'hidden',
        }}
      >
        {/* Radial glow background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 40% at 50% 60%, rgba(34,197,94,0.06), transparent)',
            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '0 24px',
            maxWidth: '900px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0',
          }}
        >
          {/* Eyebrow pill */}
          <div
            className="reveal"
            data-delay="0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--pill-radius)',
              border: '1px solid var(--border)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '32px',
            }}
          >
            Real-World Asset Protocol · Built on Solana
          </div>

          {/* Headline */}
          <h1
            className="reveal"
            data-delay="80"
            style={{
              fontSize: 'clamp(48px, 8vw, 88px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.96,
              color: 'var(--text-primary)',
              marginBottom: '28px',
            }}
          >
            Tokenized Agricultural
            <br />
            <span style={{ color: 'var(--accent)' }}>Yield.</span> On-Chain.
          </h1>

          {/* Sub-headline */}
          <p
            className="reveal"
            data-delay="160"
            style={{
              fontSize: '18px',
              color: 'var(--text-secondary)',
              maxWidth: '480px',
              lineHeight: 1.6,
              marginBottom: '40px',
            }}
          >
            KYC-verified farming estates. USDC settlement in 400ms.
            Parametric crop insurance — fully on-chain.
          </p>

          {/* CTA row */}
          <div
            className="reveal"
            data-delay="240"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: '80px',
            }}
          >
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 28px',
                borderRadius: 'var(--pill-radius)',
                background: 'var(--accent)',
                color: '#000',
                fontSize: '15px',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'opacity 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Launch App
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="https://github.com/jigglu/agrifund"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '15px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              View GitHub →
            </a>
          </div>
        </div>

        {/* ── Ticker Strip ── */}
        <div
          className="reveal"
          data-delay="320"
          style={{
            width: '100%',
            overflow: 'hidden',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            paddingTop: '16px',
            paddingBottom: '16px',
            position: 'relative',
          }}
        >
          {/* Fade edges */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '120px',
              background: 'linear-gradient(90deg, var(--bg-base), transparent)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '120px',
              background: 'linear-gradient(-90deg, var(--bg-base), transparent)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />

          {/* Scrolling track — duplicated for seamless loop */}
          <div className="ticker-track" style={{ paddingLeft: '24px' }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: 'var(--pill-radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {item.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          3. STATS BAR
          ══════════════════════════════════════════════════════════════ */}
      <div
        ref={statsRef}
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--content-width)',
            margin: '0 auto',
            padding: '0 24px',
          }}
          className="responsive-grid-4-stats"
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              }}
              className={i === 3 ? 'border-r-0' : ''}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                {formatStat(i, statValues[i])}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          4. FEATURES — Built for Real-World Asset Finance
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: 'var(--section-py) 24px',
          maxWidth: 'var(--content-width)',
          margin: '0 auto',
        }}
      >
        {/* Section header */}
        <div
          className="reveal"
          style={{ textAlign: 'center', marginBottom: '64px' }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '16px',
            }}
          >
            Institutional Architecture
          </div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              marginBottom: '16px',
            }}
          >
            Built for Real-World Asset Finance
          </h2>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Every protocol feature is designed around the compliance, risk management,
            and settlement standards institutional capital requires.
          </p>
        </div>

        {/* Feature cards */}
        <div className="responsive-grid-3-features">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="feature-card reveal"
              data-delay={`${i * 100}`}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--card-radius)',
                padding: '36px 32px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  marginBottom: '16px',
                }}
              >
                {f.tag}
              </div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.3,
                  marginBottom: '14px',
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: '15px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          5. PROTOCOL STEPPER — How It Works
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: 'var(--section-py) 24px',
        }}
      >
        <div style={{ maxWidth: 'var(--content-width)', margin: '0 auto' }}>
          {/* Header */}
          <div
            className="reveal"
            style={{ textAlign: 'center', marginBottom: '72px' }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '16px',
              }}
            >
              Protocol Flow
            </div>
            <h2
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              How AgriFund Works
            </h2>
          </div>

          {/* Stepper */}
          <div
            className="reveal"
            style={{ position: 'relative' }}
          >
            {/* Horizontal connector line */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: 'calc(12.5% + 20px)',
                right: 'calc(12.5% + 20px)',
                height: '1px',
                background: 'var(--border)',
              }}
              className="hidden md:block"
            >
              {/* Animated progress pulse */}
              <div className="stepper-connector" style={{ position: 'absolute', inset: 0 }} />
            </div>

            {/* Steps grid */}
            <div className="responsive-grid-4-steps">
              {STEPS.map((step, i) => (
                <div
                  key={step.n}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                >
                  {/* Node circle */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '1px solid var(--accent)',
                      background: i === 0 ? 'var(--accent)' : 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
                      position: 'relative',
                      zIndex: 2,
                      flexShrink: 0,
                      transition: 'background 0.3s',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: i === 0 ? '#000' : 'var(--accent)',
                      }}
                    >
                      {step.n}
                    </span>
                  </div>

                  {/* Step label */}
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                    }}
                  >
                    Step {step.n}
                  </div>
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      marginBottom: '10px',
                    }}
                  >
                    {step.title}
                  </div>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          6. LIVE POOL SIMULATION
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: 'var(--section-py) 24px',
          maxWidth: 'var(--content-width)',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          className="reveal"
          style={{ marginBottom: '48px' }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '16px',
            }}
          >
            <span className="live-dot" />
            Live Pool Activity
          </div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            Active Yield Pools
          </h2>
        </div>

        {/* Table card */}
        <div
          className="reveal"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--card-radius)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Estate', 'Crop', 'Pool Size', 'Yield APY', 'Status', 'Funded'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '14px 20px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POOL_ROWS.map((row, i) => (
                  <tr
                    key={i}
                    className="pool-row"
                    style={{ borderBottom: i < POOL_ROWS.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {row.estate}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                      {row.crop}
                    </td>
                    <td
                      style={{
                        padding: '16px 20px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                      }}
                    >
                      {row.size}
                    </td>
                    <td
                      style={{
                        padding: '16px 20px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {row.apy}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <StatusPill status={row.status} />
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            flex: 1,
                            height: '4px',
                            borderRadius: '2px',
                            background: 'var(--border)',
                            minWidth: '60px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: row.funded,
                              background: 'var(--accent)',
                              borderRadius: '2px',
                              transition: 'width 1s ease',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            flexShrink: 0,
                          }}
                        >
                          {row.funded}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          7. UNIFIED COLLATERAL — One Yield Pool. Every Harvest.
          ══════════════════════════════════════════════════════════════ */}
      <section
        ref={collateralRef}
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: 'var(--section-py) 24px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--content-width)',
            margin: '0 auto',
          }}
        >
          {/* Header */}
          <div
            className="reveal"
            style={{ marginBottom: '56px' }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '16px',
              }}
            >
              Collateral Architecture
            </div>
            <h2
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              One Yield Pool. Every Harvest.
            </h2>
          </div>

          {/* Two-column layout */}
          <div className="responsive-grid-2-columns">
            {/* Left: allocation breakdown */}
            <div
              className="reveal feature-card"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--card-radius)',
                padding: '36px 32px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                USDC Collateral
              </div>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '32px',
                }}
              >
                $24.8M total
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {COLLATERAL.map((c) => (
                  <div key={c.category}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {c.category}
                      </span>
                      <span
                        style={{
                          fontSize: '14px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}
                      >
                        {c.pct}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '3px',
                        background: 'var(--border)',
                        overflow: 'hidden',
                        marginBottom: '10px',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: barsVisible ? `${c.pct}%` : '0%',
                          background: c.color,
                          borderRadius: '3px',
                          transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                        }}
                      />
                    </div>
                    {/* Sub-items */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {c.items.map((item) => (
                        <span
                          key={item}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            padding: '3px 8px',
                            borderRadius: 'var(--pill-radius)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: API terminal snippet */}
            <div
              className="reveal feature-card"
              data-delay="100"
              style={{
                background: '#0a0a0a',
                border: '1px solid var(--border)',
                borderRadius: 'var(--card-radius)',
                overflow: 'hidden',
              }}
            >
              {/* Terminal header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  agrifund-sdk — REST API
                </span>
              </div>
              {/* Code content */}
              <pre
                style={{
                  padding: '24px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
                <code>
                  <span style={{ color: 'var(--text-muted)' }}>{'// Fetch active pools'}{'\n'}</span>
                  <span style={{ color: '#7dd3fc' }}>{'const'}</span>
                  {' pools = '}<span style={{ color: '#f472b6' }}>{'await'}</span>
                  {' agrifund\n'}
                  {'  .'}<span style={{ color: 'var(--accent)' }}>{'pools'}</span>
                  {'('}<span style={{ color: '#fbbf24' }}>{'{'}</span>{'\n'}
                  {'    status: '}<span style={{ color: '#a3e635' }}>{'"active"'}</span>{',\n'}
                  {'    minApy: '}<span style={{ color: '#fb923c' }}>{'10'}</span>{',\n'}
                  {'    currency: '}<span style={{ color: '#a3e635' }}>{'"USDC"'}</span>{'\n'}
                  {'  '}<span style={{ color: '#fbbf24' }}>{'}'}</span>{');\n\n'}
                  <span style={{ color: 'var(--text-muted)' }}>{'// Open position'}{'\n'}</span>
                  <span style={{ color: '#7dd3fc' }}>{'const'}</span>
                  {' tx = '}<span style={{ color: '#f472b6' }}>{'await'}</span>
                  {' agrifund\n'}
                  {'  .'}<span style={{ color: 'var(--accent)' }}>{'invest'}</span>
                  {'('}<span style={{ color: '#fbbf24' }}>{'{'}</span>{'\n'}
                  {'    pool: '}<span style={{ color: '#a3e635' }}>{'"WHEAT-KE-2025"'}</span>{',\n'}
                  {'    amount: '}<span style={{ color: '#fb923c' }}>{'5000'}</span>{',\n'}
                  {'    wallet: '}<span style={{ color: '#a3e635' }}>{'"<pubkey>"'}</span>{'\n'}
                  {'  '}<span style={{ color: '#fbbf24' }}>{'}'}</span>{');\n\n'}
                  <span style={{ color: 'var(--accent)' }}>{'✓'}</span>
                  {' Tx confirmed in '}<span style={{ color: '#fb923c' }}>{'387ms'}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          8. DEVELOPER CLI
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: 'var(--section-py) 24px',
          maxWidth: 'var(--content-width)',
          margin: '0 auto',
        }}
      >
        <div className="responsive-grid-2-columns-gap80">
          {/* Left: copy */}
          <div className="reveal">
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--pill-radius)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent)',
                }}
              >
                Coming Soon
              </span>
              Agent SDK
            </div>
            <h2
              style={{
                fontSize: 'clamp(32px, 3.5vw, 44px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                lineHeight: 1.15,
                marginBottom: '20px',
              }}
            >
              Built for Programmatic Investors
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                maxWidth: '420px',
                marginBottom: '32px',
              }}
            >
              Full REST + WebSocket API. Automate pool discovery, position sizing,
              and yield settlement with a few lines of TypeScript or Python.
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <a
                href="https://github.com/jigglu/agrifund"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--pill-radius)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                View Docs →
              </a>
              <a
                href="https://github.com/jigglu/agrifund"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--pill-radius)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                GitHub →
              </a>
            </div>
          </div>

          {/* Right: terminal */}
          <div
            ref={terminalRef}
            className="reveal"
            data-delay="100"
            style={{
              background: '#040404',
              border: '1px solid var(--border)',
              borderRadius: 'var(--card-radius)',
              overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Terminal chrome */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                agrifund-cli v1.0.0
              </span>
            </div>

            {/* Terminal output */}
            <div
              style={{
                padding: '24px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: 1.8,
                minHeight: '260px',
                color: 'var(--text-secondary)',
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {terminalText.split('\n').map((line, i) => {
                  if (line.startsWith('✓')) {
                    return (
                      <span key={i}>
                        <span style={{ color: 'var(--accent)' }}>✓</span>
                        {line.slice(1)}
                        {'\n'}
                      </span>
                    );
                  }
                  if (line.startsWith('→')) {
                    return (
                      <span key={i}>
                        <span style={{ color: 'var(--accent)' }}>→</span>
                        {line.slice(1)}
                        {'\n'}
                      </span>
                    );
                  }
                  if (line.startsWith('$')) {
                    return (
                      <span key={i}>
                        <span style={{ color: 'var(--text-muted)' }}>$ </span>
                        <span style={{ color: 'var(--text-primary)' }}>{line.slice(2)}</span>
                        {'\n'}
                      </span>
                    );
                  }
                  return <span key={i}>{line}{'\n'}</span>;
                })}
                {/* blinking cursor */}
                {terminalText.length < CLI_TEXT.length ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '14px',
                      background: 'var(--accent)',
                      verticalAlign: 'middle',
                      animation: 'blink 1s ease-in-out infinite',
                    }}
                  />
                ) : null}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          9. PARTNERS STRIP
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          padding: '64px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--content-width)',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '40px',
          }}
        >
          <div
            className="reveal"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Backed by trusted infrastructure
          </div>

          <div
            className="reveal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '56px',
              flexWrap: 'wrap',
            }}
          >
            {PARTNERS.map((p) => (
              <div
                key={p.name}
                className="partner-logo"
                style={{ cursor: 'default' }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          10. FOOTER CTA + FOOTER
          ══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: 'var(--section-py) 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '700px',
            margin: '0 auto',
          }}
        >
          {/* Radial glow */}
          <div
            style={{
              position: 'relative',
              padding: '80px 40px',
              borderRadius: '24px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              overflow: 'hidden',
            }}
          >
            {/* Background glow */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(34,197,94,0.08), transparent)',
                pointerEvents: 'none',
              }}
            />
            <div
              className="reveal"
              style={{ position: 'relative', zIndex: 1 }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '24px',
                }}
              >
                Get Started Today
              </div>
              <h2
                style={{
                  fontSize: 'clamp(32px, 5vw, 52px)',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.1,
                  marginBottom: '16px',
                }}
              >
                Ready to tokenize
                <br />
                your harvest?
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  color: 'var(--text-secondary)',
                  marginBottom: '36px',
                  lineHeight: 1.6,
                }}
              >
                Estate operators and institutional investors — go on-chain in minutes.
              </p>
              <Link
                href="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 32px',
                  borderRadius: 'var(--pill-radius)',
                  background: 'var(--accent)',
                  color: '#000',
                  fontSize: '15px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'opacity 0.2s, transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Launch the Protocol
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer row ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '28px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--content-width)',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}
            >
              AgriFund
            </span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: 'Docs', href: 'https://github.com/jigglu/agrifund' },
              { label: 'GitHub', href: 'https://github.com/jigglu/agrifund' },
              { label: 'Discord', href: 'https://discord.com' },
              { label: 'Privacy', href: '#' },
              { label: 'Terms', href: '#' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>© 2025 AgriFund</span>
        </div>
      </footer>
    </div>
  );
}
