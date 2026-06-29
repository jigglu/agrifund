'use client';

import { useState, useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useAgriFund, type OnChainPool } from '@/hooks/useAgriFund';
import Link from 'next/link';
import React from 'react';

interface PoolMeta {
  farmer: string;
  crop: string;
  region: string;
  category: string;
  apr: string;
}

const getPoolMeta = (pool: OnChainPool | null): PoolMeta => {
  if (!pool) return { farmer: 'Unknown', crop: 'Unknown', region: 'Unknown', category: 'Other', apr: '0.0%' };
  return {
    farmer: pool.account.estateName || `Farm ${pool.account.authority.toBase58().slice(0, 4)}`,
    crop: pool.account.cropName || 'Unknown Crop',
    region: pool.account.region || 'Decentralized',
    category: pool.account.category || 'Other',
    apr: pool.account.apr ? `${(pool.account.apr / 100).toFixed(1)}%` : '0.0%',
  };
};

const getStatusConfig = (status: any) => {
  if (!status || status.open !== undefined) return { label: 'Pool Open', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
  if (status.farming !== undefined)  return { label: 'Farming',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (status.settled !== undefined)  return { label: 'Settled',   color: '#888888', bg: 'rgba(136,136,136,0.1)' };
  if (status.defaulted !== undefined) return { label: 'Defaulted', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  return { label: 'Unknown', color: '#666', bg: 'rgba(102,102,102,0.1)' };
};

const deriveGoal = (pool: OnChainPool) => pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber();
const pct = (funded: number, goal: number) => goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;
const toUsdc = (v: number) => v / 1_000_000;

interface Investment {
  pool: OnChainPool;
  balance: number;
  meta: PoolMeta;
}

export default function PortfolioPage() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { isReady, fetchAllPools } = useAgriFund();

  const [myInvestments, setMyInvestments] = useState<Investment[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const fetchMyInvestments = useCallback(async () => {
    if (!connection || !publicKey || !isReady) { setMyInvestments([]); return; }
    setIsFetching(true);
    try {
      const livePools = await fetchAllPools();
      const response = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
      const balancesMap = new Map<string, number>();
      for (const ai of response.value) {
        const info = ai.account.data.parsed.info;
        const bal = info.tokenAmount.uiAmount ?? 0;
        if (bal > 0) balancesMap.set(info.mint, bal);
      }
      const investmentsList: Investment[] = [];
      for (const pool of livePools) {
        const mintStr = pool.account.receiptMint.toBase58();
        if (balancesMap.has(mintStr)) investmentsList.push({ pool, balance: balancesMap.get(mintStr)!, meta: getPoolMeta(pool) });
      }
      setMyInvestments(investmentsList);
    } catch (e) { console.error('Error fetching investments:', e); }
    finally { setIsFetching(false); }
  }, [connection, publicKey, isReady, fetchAllPools]);

  useEffect(() => { fetchMyInvestments(); }, [fetchMyInvestments]);

  /* ── Aggregate stats ── */
  const totalBalance = myInvestments.reduce((sum, inv) => sum + inv.balance, 0);
  const totalFundedUsd = myInvestments.reduce((sum, inv) => sum + toUsdc(inv.pool.account.totalFundedUsdc.toNumber()), 0);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
          My Positions
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
              Investment Portfolio
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Track and manage your tokenized real-world agriculture positions.
            </p>
          </div>
          {/* Aggregate stats */}
          {myInvestments.length > 0 && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Positions', value: myInvestments.length.toString() },
                { label: 'Total Tokens', value: totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
                { label: 'Total Funded', value: `$${totalFundedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', minWidth: '100px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>{s.label}</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Wallet disconnected */}
      {!connected && (
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '48px 32px', textAlign: 'center', borderRadius: 'var(--card-radius)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>
            ⊡
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '8px' }}>Wallet Disconnected</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Connect your wallet to view your active agriculture investments and yield payouts.
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {connected && isFetching && (
        <div style={{ display: 'grid', gap: '16px' }} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '280px', borderRadius: 'var(--card-radius)', border: '1px solid var(--border)', background: 'var(--bg-card)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* No investments */}
      {connected && !isFetching && myInvestments.length === 0 && (
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '48px 32px', textAlign: 'center', borderRadius: 'var(--card-radius)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px', color: 'var(--text-muted)' }}>
            ◈
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '8px' }}>No Active Positions</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
            You don't hold any tokenized crop receipts yet. Fund active agricultural pools to earn competitive yields.
          </p>
          <Link
            href="/dashboard/investor"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 24px', borderRadius: '999px', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '13px', textDecoration: 'none', transition: 'opacity 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            View Investor Marketplace
          </Link>
        </div>
      )}

      {/* Investment cards */}
      {connected && !isFetching && myInvestments.length > 0 && (
        <div style={{ display: 'grid', gap: '16px' }} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {myInvestments.map(({ pool, balance, meta }) => {
            const goalMicro    = deriveGoal(pool);
            const fundedMicro  = pool.account.totalFundedUsdc.toNumber();
            const percentage   = pct(fundedMicro, goalMicro);
            const fundedUsd    = toUsdc(fundedMicro);
            const goalUsd      = toUsdc(goalMicro);
            const { label, color, bg } = getStatusConfig(pool.account.status);

            return (
              <div
                key={pool.publicKey.toBase58()}
                style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '22px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }} title={pool.account.estateName}>
                      {pool.account.estateName}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {meta.crop} · <span style={{ color: 'var(--text-muted)' }}>{meta.category}</span>
                    </p>
                  </div>
                  {/* Status badge */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: bg, color, fontSize: '11px', fontWeight: 500, border: `1px solid ${color}33`, flexShrink: 0 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                    {label}
                  </span>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--border)', marginBottom: '16px' }} />

                {/* Metrics 3-col */}
                <div className="responsive-grid-3-cols" style={{ marginBottom: '18px' }}>
                  {[
                    { label: 'Tokens Held', value: balance.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: 'var(--accent)' },
                    { label: 'Exp. Return', value: meta.apr, color: 'var(--text-primary)' },
                    { label: 'Location', value: meta.region, color: 'var(--text-secondary)' },
                  ].map(m => (
                    <div key={m.label} style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: m.color, fontFamily: 'var(--font-mono)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.value}>{m.value}</p>
                      <p style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--border)', marginBottom: '16px' }} />

                {/* Funding progress */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ${fundedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} funded
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ${goalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} goal
                    </span>
                  </div>
                  {/* Chunky progress bar */}
                  <div style={{ height: '20px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '3px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                    <div style={{ height: '100%', width: `${percentage}%`, borderRadius: '7px', background: 'var(--accent)', transition: 'width 0.5s ease', minWidth: percentage > 0 ? '24px' : '0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
                      {percentage >= 15 && (
                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#000', letterSpacing: '0.05em' }}>{percentage.toFixed(0)}%</span>
                      )}
                    </div>
                    {percentage < 15 && (
                      <span style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', paddingLeft: '8px', letterSpacing: '0.05em' }}>{percentage.toFixed(0)}%</span>
                    )}
                  </div>
                </div>

                {/* Manage CTA */}
                <Link
                  href={`/dashboard/investor?pool=${pool.publicKey.toBase58()}`}
                  style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                >
                  Manage & Claim →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
