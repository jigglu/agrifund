'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useAgriFund, OnChainPool } from '@/hooks/useAgriFund';

const adminEnv = process.env.NEXT_PUBLIC_AUTHORIZED_ADMINS || "";
const AUTHORIZED_ADMINS = adminEnv
  ? adminEnv.split(",").map(a => a.trim())
  : ["GosHAi7SeWs3Xv6Ys4aaw68DwHafbGqgZ8KPcVcDUBT2"];

// ── Types ──────────────────────────────────────────────────────────────────
interface TxLog {
  id: string;
  status: 'pending' | 'success' | 'error';
  sig?: string;
  error?: string;
  label: string;
  timestamp: Date;
}

/* ── Design tokens (inline) ──────────────────────────────────────────────── */
const S = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--card-radius)',
    padding: '28px 28px',
  } as React.CSSProperties,
  label: {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    marginBottom: '8px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
};

/* ── Import React ──────────────────────────────────────────────────────────── */
import React from 'react';

/* ── Tx Log Entry ──────────────────────────────────────────────────────────── */
const TxEntry = ({ log }: { log: TxLog }) => {
  const cfg = {
    pending: { border: 'rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.06)', text: '#f59e0b', icon: '◌' },
    success: { border: 'rgba(34,197,94,0.2)',  bg: 'rgba(34,197,94,0.06)',  text: '#22c55e', icon: '✓' },
    error:   { border: 'rgba(239,68,68,0.2)',  bg: 'rgba(239,68,68,0.06)',  text: '#ef4444', icon: '✕' },
  }[log.status];

  return (
    <div style={{
      borderRadius: '10px',
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      padding: '10px 12px',
      fontSize: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: log.sig ? '6px' : 0 }}>
        <span style={{ fontWeight: 600, color: cfg.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{cfg.icon}</span> {log.label}
        </span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {log.timestamp.toLocaleTimeString()}
        </span>
      </div>
      {log.sig && (
        <a
          href={`https://explorer.solana.com/tx/${log.sig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {log.sig.slice(0, 32)}…
        </a>
      )}
      {log.error && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--danger)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.error}</p>
      )}
    </div>
  );
};

/* ── Status pill ───────────────────────────────────────────────────────────── */
const StatusPill = ({ status }: { status: any }) => {
  let label = 'Live', color = '#22c55e', bg = 'rgba(34,197,94,0.1)';
  if (status?.open !== undefined)     { label = 'Open';      color = '#22c55e'; bg = 'rgba(34,197,94,0.1)'; }
  if (status?.farming !== undefined)  { label = 'Farming';   color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; }
  if (status?.settled !== undefined)  { label = 'Settled';   color = '#888888'; bg = 'rgba(136,136,136,0.1)'; }
  if (status?.defaulted !== undefined){ label = 'Defaulted'; color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: bg, color, fontSize: '11px', fontWeight: 500, flexShrink: 0, border: `1px solid ${color}33` }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  );
};

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const LOAN_TERM_DAYS = 180;

interface SettlementBreakdown {
  principal: number;
  interest: number;
  settlementAmount: number;
  elapsedSeconds: number;
  termDays: number;
  aprPct: number;
}

function computeSettlementAmount(totalFundedUsdc: number, aprBps: number, farmingStartTime: number): SettlementBreakdown {
  const now = Math.floor(Date.now() / 1000);
  const elapsedSeconds = Math.max(0, now - farmingStartTime);
  const aprPct = aprBps / 100;
  const interest = Math.round(totalFundedUsdc * (aprBps / 10_000) * (LOAN_TERM_DAYS / 365));
  return { principal: totalFundedUsdc, interest, settlementAmount: totalFundedUsdc + interest, elapsedSeconds, termDays: LOAN_TERM_DAYS, aprPct };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EstatePage() {
  const { connected, publicKey } = useWallet();
  const { isReady, program, initializePool, withdrawCapital, settlePool, triggerDefault, fetchAllPools } = useAgriFund();
  const isAuthorized = connected && publicKey && AUTHORIZED_ADMINS.includes(publicKey.toBase58());

  const [txLogs, setTxLogs] = useState<TxLog[]>([]);
  const [customEstateName, setCustomEstateName] = useState("");
  const [customCropName, setCustomCropName] = useState("");
  const [customCategory, setCustomCategory] = useState("Grains");
  const [customYieldKg, setCustomYieldKg] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customVestingDuration, setCustomVestingDuration] = useState("180");
  const [customApr, setCustomApr] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isWithdrawingMap, setIsWithdrawingMap] = useState<Record<string, boolean>>({});
  const [isSettlingMap, setIsSettlingMap] = useState<Record<string, boolean>>({});
  const [isDefaultingMap, setIsDefaultingMap] = useState<Record<string, boolean>>({});
  const [timeTick, setTimeTick] = useState(0);
  const [myPools, setMyPools] = useState<OnChainPool[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { const i = setInterval(() => setTimeTick(t => t + 1), 1000); return () => clearInterval(i); }, []);

  const refreshMyPools = useCallback(async () => {
    if (!isReady || !publicKey) return;
    setIsHydrating(true);
    try {
      const all = await fetchAllPools();
      setMyPools(all.filter(p => p.account.authority.toBase58() === publicKey.toBase58()));
    } catch { } finally { setIsHydrating(false); }
  }, [isReady, publicKey, fetchAllPools]);

  useEffect(() => { refreshMyPools(); }, [refreshMyPools]);

  useEffect(() => {
    if (!isReady || !program) return;
    const refresh = () => refreshMyPools();
    const listeners = [
      program.addEventListener('PoolInitialized', refresh),
      program.addEventListener('CapitalWithdrawn', refresh),
      program.addEventListener('PoolSettled', refresh),
      program.addEventListener('DefaultTriggered', refresh),
    ];
    return () => { listeners.forEach(id => { try { program.removeEventListener(id); } catch { } }); };
  }, [isReady, program, refreshMyPools]);

  const refreshWithRetry = useCallback(async () => {
    await refreshMyPools();
    setTimeout(async () => { await refreshMyPools(); }, 1000);
    setTimeout(async () => { await refreshMyPools(); }, 2500);
  }, [refreshMyPools]);

  const addLog = useCallback((log: Omit<TxLog, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setTxLogs(prev => [{ ...log, id }, ...prev].slice(0, 10));
    return id;
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<TxLog>) =>
    setTxLogs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)), []);

  const handleInitializeCustomPool = async () => {
    if (!isReady || !customEstateName || !customCropName || !customYieldKg || !customPrice || !customVestingDuration || !customApr || !customRegion) return;
    setIsInitializing(true);
    const logId = addLog({ status: 'pending', label: `Init: ${customCropName}`, timestamp: new Date() });
    try {
      const { txSig } = await initializePool(customEstateName, customCropName, customCategory, Number(customYieldKg), Math.round(Number(customPrice) * 1_000_000), Number(customVestingDuration) || 180, Math.round(Number(customApr) * 100), customRegion);
      updateLog(logId, { status: 'success', sig: txSig });
      setCustomEstateName(""); setCustomCropName(""); setCustomCategory("Grains"); setCustomYieldKg(""); setCustomPrice(""); setCustomVestingDuration("180"); setCustomApr(""); setCustomRegion("");
      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally { setIsInitializing(false); }
  };

  const handleWithdraw = async (poolAddress: PublicKey, amount: number) => {
    const key = poolAddress.toBase58();
    setIsWithdrawingMap(prev => ({ ...prev, [key]: true }));
    const logId = addLog({ status: 'pending', label: `Withdraw: ${amount > 0 ? `$${(amount / 1_000_000).toFixed(2)}` : 'Start Farming'}`, timestamp: new Date() });
    try {
      const { txSig } = await withdrawCapital(poolAddress, amount);
      updateLog(logId, { status: 'success', sig: txSig });
      setMyPools(prev => prev.map(pool => {
        if (pool.publicKey.toBase58() === key) {
          const nextStatus = amount === 0 ? { farming: {} } : pool.account.status;
          const nextFarmingStartTime = amount === 0 ? new BN(Math.floor(Date.now() / 1000)) : pool.account.farmingStartTime;
          return { ...pool, account: { ...pool.account, status: nextStatus, farmingStartTime: nextFarmingStartTime, amountWithdrawn: new BN(pool.account.amountWithdrawn.toNumber() + amount) } };
        }
        return pool;
      }));
      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally { setIsWithdrawingMap(prev => ({ ...prev, [key]: false })); }
  };

  const handleSettle = async (poolAddress: PublicKey, amountUsdc: number) => {
    const key = poolAddress.toBase58();
    if (!amountUsdc || amountUsdc <= 0) return;
    setIsSettlingMap(prev => ({ ...prev, [key]: true }));
    const logId = addLog({ status: 'pending', label: `Settle: $${(amountUsdc / 1_000_000).toFixed(2)}`, timestamp: new Date() });
    try {
      const { txSig } = await settlePool(poolAddress, amountUsdc);
      updateLog(logId, { status: 'success', sig: txSig });
      setMyPools(prev => prev.map(pool => pool.publicKey.toBase58() === key ? { ...pool, account: { ...pool.account, status: { settled: {} } } } : pool));
      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally { setIsSettlingMap(prev => ({ ...prev, [key]: false })); }
  };

  const handleTriggerDefault = async (poolAddress: PublicKey) => {
    const key = poolAddress.toBase58();
    setIsDefaultingMap(prev => ({ ...prev, [key]: true }));
    const logId = addLog({ status: 'pending', label: `Oracle: Trigger Default`, timestamp: new Date() });
    try {
      const { txSig } = await triggerDefault(poolAddress);
      updateLog(logId, { status: 'success', sig: txSig });
      setMyPools(prev => prev.map(pool => pool.publicKey.toBase58() === key ? { ...pool, account: { ...pool.account, status: { defaulted: {} } } } : pool));
      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally { setIsDefaultingMap(prev => ({ ...prev, [key]: false })); }
  };

  /* ── Input focus style helper ── */
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = 'var(--accent)'; };
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = 'var(--border)'; };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Admin Console
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
              Estate Management Portal
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Initialize and manage verified farming estate yield pools on-chain.
            </p>
          </div>
          {mounted && isReady && isHydrating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              Syncing chain state…
            </div>
          )}
        </div>

        {/* Wallet not connected warning */}
        {mounted && !connected && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)', fontSize: '13px', color: '#f59e0b' }}>
            <span style={{ fontSize: '15px' }}>◬</span>
            Connect your wallet to initialize yield pools on-chain.
          </div>
        )}
      </div>

      {/* Access denied */}
      {mounted && connected && !isAuthorized ? (
        <div style={{ padding: '64px 24px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--card-radius)', background: 'rgba(239,68,68,0.05)' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--danger)' }}>⊘</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px', letterSpacing: '-0.01em' }}>Access Denied</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Your wallet is not authorized for administrative configurations.</p>
        </div>
      ) : (
        <div className="responsive-layout-grid">

          {/* ── LEFT: Form + Active pools ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Create pool form */}
            <div style={S.card}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
                  Pool Initialization
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                  Create New Yield Pool
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Initialize a verified asset directly on Solana Devnet.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Row 1 */}
                <div className="responsive-grid-2-columns-gap16">
                  <div>
                    <label style={S.label}>Estate Name</label>
                    <input type="text" value={customEstateName} onChange={e => setCustomEstateName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))} placeholder="e.g., Mendez Agro Holdings" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <div>
                    <label style={S.label}>Crop Name</label>
                    <input type="text" value={customCropName} onChange={e => setCustomCropName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))} placeholder="e.g., Mexican Arabica Coffee" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label style={S.label}>Category</label>
                  <select value={customCategory} onChange={e => setCustomCategory(e.target.value)} style={S.select} onFocus={onFocus} onBlur={onBlur}>
                    <option value="Grains">Grains</option>
                    <option value="Coffee">Coffee</option>
                    <option value="Oils">Oils</option>
                  </select>
                </div>

                {/* Row 2 */}
                <div className="responsive-grid-2-columns-gap16">
                  <div>
                    <label style={S.label}>Total Yield (kg)</label>
                    <input type="number" value={customYieldKg} onChange={e => setCustomYieldKg(e.target.value)} placeholder="e.g., 5000" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <div>
                    <label style={S.label}>Price per kg ($)</label>
                    <input type="number" step="0.01" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="e.g., 2.50" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </div>

                {/* Vesting */}
                <div>
                  <label style={S.label}>Vesting Duration (seconds)</label>
                  <input type="number" value={customVestingDuration} onChange={e => setCustomVestingDuration(e.target.value)} placeholder="e.g., 180" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>

                {/* Row 3 */}
                <div className="responsive-grid-2-columns-gap16">
                  <div>
                    <label style={S.label}>Estimated APR (%)</label>
                    <input type="number" step="0.1" value={customApr} onChange={e => setCustomApr(e.target.value)} placeholder="e.g., 12.5" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <div>
                    <label style={S.label}>Region</label>
                    <input type="text" value={customRegion} onChange={e => setCustomRegion(e.target.value)} placeholder="e.g., Kano, Nigeria" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleInitializeCustomPool}
                  disabled={!isReady || isInitializing || !customEstateName || !customCropName || !customYieldKg || !customPrice || !customVestingDuration || !customApr || !customRegion}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '999px',
                    background: 'var(--accent)',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s, transform 0.2s',
                    opacity: (!isReady || isInitializing || !customEstateName || !customCropName || !customYieldKg || !customPrice || !customVestingDuration || !customApr || !customRegion) ? 0.35 : 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {isInitializing ? 'Executing Transaction…' : 'Initialize Pool on Devnet'}
                </button>
              </div>
            </div>

            {/* Active Admin Pools */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Active Admin Pools
                </h2>
                <span style={{ padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--border)', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {myPools.length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '16px' }} className="grid-cols-1 sm:grid-cols-2">
                {myPools.map(pool => {
                  const goal = pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber();
                  const totalFunded = pool.account.totalFundedUsdc.toNumber();
                  const amountWithdrawn = pool.account.amountWithdrawn.toNumber();
                  const isFullyFunded = totalFunded >= goal;
                  const farmingStartTime = pool.account.farmingStartTime.toNumber();
                  const isFarming = pool.account.status.farming !== undefined;
                  const isOpen = pool.account.status.open !== undefined;
                  const now = Math.floor(Date.now() / 1000);
                  let elapsed = 0;
                  if (isFarming && farmingStartTime > 0) elapsed = Math.max(0, now - farmingStartTime);
                  const vestingDuration = pool.account.vestingDuration ? pool.account.vestingDuration.toNumber() : 180;
                  const vestedPct = isFarming ? Math.min(elapsed / vestingDuration, 1.0) : 0;
                  const totalVested = Math.round(totalFunded * vestedPct);
                  const availableToWithdraw = Math.max(0, totalVested - amountWithdrawn);
                  const key = pool.publicKey.toBase58();

                  return (
                    <div key={key} style={{ ...S.card, padding: '20px 22px', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      {/* Pool header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pool.account.estateName}
                          </p>
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pool.account.cropName}
                          </h3>
                        </div>
                        <StatusPill status={pool.account.status} />
                      </div>

                      {/* Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        {[
                          { label: 'Yield', value: `${pool.account.totalYieldKg.toNumber().toLocaleString()} kg` },
                          { label: 'Price / kg', value: `$${(pool.account.pricePerKg.toNumber() / 1_000_000).toFixed(2)}` },
                          { label: 'Est. APR', value: `${pool.account.apr ? (pool.account.apr / 100).toFixed(1) : '0.0'}%` },
                          { label: 'Region', value: pool.account.region || 'Unknown' },
                        ].map(m => (
                          <div key={m.label} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>{m.label}</p>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Funded */}
                      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Funded</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                            ${(totalFunded / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min((totalFunded / (goal || 1)) * 100, 100)}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s' }} />
                        </div>
                      </div>

                      {/* Withdraw actions */}
                      {isFullyFunded && (
                        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Vesting progress */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Time-locked drawdown</span>
                              {isFarming && (
                                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                                  {Math.round(vestedPct * 100)}% vested
                                </span>
                              )}
                            </div>
                            {isFarming && (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                                  <span>{elapsed}s / {vestingDuration}s</span>
                                  <span>${(amountWithdrawn / 1_000_000).toFixed(2)} drawn</span>
                                </div>
                                <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${vestedPct * 100}%`, background: '#f59e0b', borderRadius: '2px', transition: 'width 0.3s' }} />
                                </div>
                              </>
                            )}
                          </div>

                          {/* Available draw */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <div>
                              <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Available to draw</p>
                              <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                                ${(availableToWithdraw / 1_000_000).toFixed(2)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleWithdraw(pool.publicKey, availableToWithdraw)}
                              disabled={!!isWithdrawingMap[key] || (isFarming && availableToWithdraw <= 0)}
                              style={{
                                flexShrink: 0, padding: '10px 16px', borderRadius: '999px',
                                background: isOpen ? 'var(--accent)' : '#f59e0b',
                                color: '#000', fontWeight: 700, fontSize: '13px',
                                border: 'none', cursor: 'pointer', transition: 'opacity 0.2s',
                                opacity: (!!isWithdrawingMap[key] || (isFarming && availableToWithdraw <= 0)) ? 0.4 : 1,
                              }}
                            >
                              {isWithdrawingMap[key] ? 'Sending…' : isOpen ? 'Start Farming' : `Draw $${(availableToWithdraw / 1_000_000).toFixed(2)}`}
                            </button>
                          </div>

                          {/* Settlement section */}
                          {isFarming && (() => {
                            const settlement = computeSettlementAmount(totalFunded, pool.account.apr || 0, farmingStartTime);
                            const isLocked = amountWithdrawn < totalFunded;
                            const isSettling = !!isSettlingMap[key];
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                {/* Settlement summary */}
                                <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>Settlement Summary</span>
                                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(34,197,94,0.2)' }}>Auto-calc</span>
                                  </div>
                                  {[
                                    { label: 'Principal', value: `$${(settlement.principal / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, accent: false },
                                    { label: 'APR', value: `${settlement.aprPct.toFixed(2)}%`, accent: false },
                                    { label: 'Term', value: `${settlement.termDays} days`, accent: false },
                                    { label: 'Interest', value: `+$${(settlement.interest / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, accent: true },
                                  ].map(r => (
                                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.label}</span>
                                      <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: r.accent ? 'var(--accent)' : 'var(--text-primary)' }}>{r.value}</span>
                                    </div>
                                  ))}
                                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Total Due</span>
                                    <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                                      ${(settlement.settlementAmount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                {isLocked && (
                                  <p style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>◬</span> Settlement locked until all capital is drawn.
                                  </p>
                                )}

                                <button
                                  onClick={() => handleSettle(pool.publicKey, settlement.settlementAmount)}
                                  disabled={isSettling || isLocked}
                                  style={{ width: '100%', padding: '12px', borderRadius: '999px', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s', opacity: (isSettling || isLocked) ? 0.4 : 1 }}
                                >
                                  {isSettling ? 'Settling…' : `Settle Crop — $${(settlement.settlementAmount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                </button>

                                <button
                                  onClick={() => handleTriggerDefault(pool.publicKey)}
                                  disabled={!!isDefaultingMap[key]}
                                  style={{ width: '100%', padding: '10px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontWeight: 600, fontSize: '12px', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', transition: 'all 0.2s', opacity: !!isDefaultingMap[key] ? 0.4 : 1 }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                >
                                  {isDefaultingMap[key] ? 'Simulating…' : 'Simulate Drought (Trigger Insurance)'}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}

                {myPools.length === 0 && !isHydrating && (
                  <div style={{ gridColumn: '1/-1', padding: '48px 24px', textAlign: 'center', borderRadius: 'var(--card-radius)', border: '1px dashed var(--border)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No yield pools initialized yet.</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Use the form above to create your first pool.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Stats + Tx Log ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '80px' }}>

            {/* Protocol stats */}
            <div style={S.card}>
              <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Protocol Statistics
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Admin Pools', value: myPools.length.toString() },
                  { label: 'Total Value Target', value: `$${myPools.reduce((acc, p) => acc + p.account.totalYieldKg.toNumber() * p.account.pricePerKg.toNumber() / 1_000_000, 0).toLocaleString()}` },
                  { label: 'Currently Funded', value: `$${myPools.reduce((acc, p) => acc + p.account.totalFundedUsdc.toNumber() / 1_000_000, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction log */}
            {txLogs.length > 0 && (
              <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Transaction Log
                  </div>
                  <button onClick={() => setTxLogs([])} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {txLogs.map(log => <TxEntry key={log.id} log={log} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
