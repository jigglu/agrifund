'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useAgriFund, type OnChainPool } from '@/hooks/useAgriFund';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import React from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface TxLog {
  id: string;
  status: 'pending' | 'success' | 'error';
  sig?: string;
  error?: string;
  label: string;
  timestamp: Date;
}

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

const PRESET_AMOUNTS = [100, 500, 1_000, 5_000];
const FILTERS = ['All', 'Grains', 'Coffee', 'Oils'] as const;
type Filter = typeof FILTERS[number];

const toUsdc = (v: number) => v / 1_000_000;
const pct = (funded: number, goal: number) => goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;
const deriveGoal = (pool: OnChainPool) => pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber();

/* ── Status pill ─────────────────────────────────────────────────────────── */
const StatusPill = ({ status }: { status: any }) => {
  let label = 'Pool Open', color = '#22c55e', bg = 'rgba(34,197,94,0.1)';
  if (status?.farming !== undefined)  { label = 'Farming';   color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; }
  if (status?.settled !== undefined)  { label = 'Settled';   color = '#888888'; bg = 'rgba(136,136,136,0.1)'; }
  if (status?.defaulted !== undefined){ label = 'Defaulted'; color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: bg, color, fontSize: '11px', fontWeight: 500, border: `1px solid ${color}33`, flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
};

/* ── Tx badge ───────────────────────────────────────────────────────────── */
const TxBadge = ({ log }: { log: TxLog }) => {
  const cfg = {
    pending: { border: 'rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.06)', text: '#f59e0b', icon: '◌' },
    success: { border: 'rgba(34,197,94,0.2)',  bg: 'rgba(34,197,94,0.06)',  text: '#22c55e', icon: '✓' },
    error:   { border: 'rgba(239,68,68,0.2)',  bg: 'rgba(239,68,68,0.06)',  text: '#ef4444', icon: '✕' },
  }[log.status];
  return (
    <div style={{ borderRadius: '10px', border: `1px solid ${cfg.border}`, background: cfg.bg, padding: '10px 12px', fontSize: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: log.sig ? '4px' : 0 }}>
        <span style={{ fontWeight: 600, color: cfg.text }}>{cfg.icon} {log.label}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{log.timestamp.toLocaleTimeString()}</span>
      </div>
      {log.sig && (
        <a href={`https://explorer.solana.com/tx/${log.sig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.sig.slice(0, 32)}…
        </a>
      )}
      {log.error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--danger)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.error}</p>}
    </div>
  );
};

/* ── Asset Risk Profile ─────────────────────────────────────────────────── */
const AssetRiskProfile = ({ pool, meta }: { pool: OnChainPool; meta: PoolMeta }) => (
  <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '12px' }}>
      Asset Risk Profile
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {[
        { label: 'Insurance',    value: 'Active (Flood & Drought)' },
        { label: 'Auditor',      value: 'Regional AgriCorp'        },
        { label: 'Settlement',   value: 'USDC on Solana'           },
        { label: 'Oracle Feed',  value: 'Chainlink Weather API'    },
        { label: 'Collateral',   value: `${pool.account.totalYieldKg.toNumber().toLocaleString()} kg ${meta.crop}` },
        { label: 'Expected APR', value: meta.apr                   },
      ].map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '7px', background: 'var(--bg-surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{row.label}</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--accent)' }}>✓ {row.value}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Page ───────────────────────────────────────────────────────────────────
export default function InvestorPage() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { isReady, program, fundYield, claimYield, refundInvestment, fetchAllPools } = useAgriFund();

  const [livePools, setLivePools]             = useState<OnChainPool[]>([]);
  const [isFetching, setIsFetching]           = useState(false);
  const fetchedRef                            = useRef(false);
  const [selectedIdx, setSelectedIdx]         = useState(0);
  const [selectedPoolKey, setSelectedPoolKey] = useState<string>('');
  const [investAmount, setInvestAmount]       = useState('');
  const [isFunding, setIsFunding]             = useState(false);
  const [isClaiming, setIsClaiming]           = useState(false);
  const [isRefunding, setIsRefunding]         = useState(false);
  const [receiptBalance, setReceiptBalance]   = useState<number>(0);
  const [txLogs, setTxLogs]                   = useState<TxLog[]>([]);
  const [activeFilter, setActiveFilter]       = useState<Filter>('All');
  const [successToast, setSuccessToast]       = useState<{ title: string; message: string } | null>(null);
  const [activeTab, setActiveTab]             = useState<'deposit' | 'refund'>('deposit');
  const [refundAmount, setRefundAmount]       = useState('');
  const [mounted, setMounted]                 = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (receiptBalance === 0) setActiveTab('deposit'); }, [receiptBalance]);
  useEffect(() => { if (successToast) { const t = setTimeout(() => setSuccessToast(null), 8000); return () => clearTimeout(t); } }, [successToast]);
  useEffect(() => { if (livePools.length > 0 && !selectedPoolKey) setSelectedPoolKey(livePools[selectedIdx]?.publicKey.toBase58() ?? ''); }, [livePools, selectedIdx, selectedPoolKey]);
  useEffect(() => { if (livePools[selectedIdx]) setSelectedPoolKey(livePools[selectedIdx].publicKey.toBase58()); }, [selectedIdx, livePools]);
  useEffect(() => {
    if (typeof window !== 'undefined' && livePools.length > 0) {
      const p = new URLSearchParams(window.location.search).get('pool');
      if (p) { const idx = livePools.findIndex(x => x.publicKey.toBase58() === p); if (idx !== -1) { setSelectedIdx(idx); setSelectedPoolKey(p); } }
    }
  }, [livePools]);

  const refreshMarketplace = useCallback(async () => {
    if (!isReady) return;
    setIsFetching(true);
    try { setLivePools(await fetchAllPools()); } finally { setIsFetching(false); }
  }, [isReady, fetchAllPools]);

  const fetchReceiptBalance = useCallback(async () => {
    const pool = livePools[selectedIdx];
    if (!connection || !publicKey || !pool) { setReceiptBalance(0); return; }
    try { const ata = await getAssociatedTokenAddress(pool.account.receiptMint, publicKey); setReceiptBalance((await connection.getTokenAccountBalance(ata)).value.uiAmount ?? 0); }
    catch { setReceiptBalance(0); }
  }, [connection, publicKey, livePools, selectedIdx]);

  const refreshWithRetry = useCallback(async () => {
    await refreshMarketplace(); await fetchReceiptBalance();
    setTimeout(async () => { await refreshMarketplace(); await fetchReceiptBalance(); }, 1000);
    setTimeout(async () => { await refreshMarketplace(); await fetchReceiptBalance(); }, 2500);
  }, [refreshMarketplace, fetchReceiptBalance]);

  useEffect(() => { if (!isReady || fetchedRef.current) return; fetchedRef.current = true; refreshMarketplace(); }, [isReady, refreshMarketplace]);
  useEffect(() => { fetchReceiptBalance(); }, [fetchReceiptBalance, livePools, selectedIdx]);

  useEffect(() => {
    if (!isReady || !program) return;
    const refresh = () => { refreshMarketplace(); fetchReceiptBalance(); };
    const listeners = [
      program.addEventListener('YieldFunded', refresh), program.addEventListener('CapitalWithdrawn', refresh),
      program.addEventListener('PoolSettled', refresh), program.addEventListener('DefaultTriggered', refresh),
      program.addEventListener('YieldClaimed', refresh), program.addEventListener('InvestmentRefunded', refresh),
    ];
    return () => { listeners.forEach(id => { try { program.removeEventListener(id); } catch { } }); };
  }, [isReady, program, refreshMarketplace, fetchReceiptBalance]);

  const mergedPools = livePools.map(livePool => ({ meta: getPoolMeta(livePool), livePool }));
  const filteredMerged = activeFilter === 'All' ? mergedPools : mergedPools.filter(p => p.livePool.account.category.toLowerCase() === activeFilter.toLowerCase());
  const selectedPool = livePools[selectedIdx];
  const selectedItem = mergedPools.find((_, i) => i === selectedIdx) ?? mergedPools[0] ?? { meta: getPoolMeta(null), livePool: null };
  const isPoolOpen = !selectedItem.livePool || selectedItem.livePool.account.status.open !== undefined;
  const isClaimable = !!selectedItem.livePool && (selectedItem.livePool.account.status.settled !== undefined || selectedItem.livePool.account.status.defaulted !== undefined);
  const isDefaulted = !!selectedItem.livePool && selectedItem.livePool.account.status.defaulted !== undefined;

  const addLog = useCallback((log: Omit<TxLog, 'id'>) => { const id = Math.random().toString(36).slice(2); setTxLogs(prev => [{ ...log, id }, ...prev].slice(0, 10)); return id; }, []);
  const updateLog = useCallback((id: string, patch: Partial<TxLog>) => setTxLogs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)), []);

  const handleFund = useCallback(async () => {
    if (!isReady || !investAmount || !selectedPoolKey) return;
    const matchedPool = livePools.find(p => p.publicKey.toBase58() === selectedPoolKey);
    const matchedPoolOpen = matchedPool && matchedPool.account.status.open !== undefined;
    if (!matchedPool || !matchedPoolOpen) { addLog({ status: 'error', label: 'Pool not open', timestamp: new Date(), error: matchedPool ? 'Pool is closed.' : 'Pool not found on-chain.' }); return; }
    let poolPublicKey: PublicKey;
    try { poolPublicKey = new PublicKey(selectedPoolKey); } catch { addLog({ status: 'error', label: 'Invalid pool key', timestamp: new Date(), error: 'Invalid public key.' }); return; }
    setIsFunding(true);
    const amountFloat = parseFloat(investAmount);
    const amountUsdc = Math.round(amountFloat * 1_000_000);
    if (amountFloat <= 0) { addLog({ status: 'error', label: 'Invalid amount', timestamp: new Date(), error: 'Amount must be > 0.' }); setIsFunding(false); return; }
    const goalMicro = matchedPool.account.totalYieldKg.toNumber() * matchedPool.account.pricePerKg.toNumber();
    const remainingMicro = Math.max(goalMicro - matchedPool.account.totalFundedUsdc.toNumber(), 0);
    if (amountUsdc > remainingMicro) { addLog({ status: 'error', label: 'Exceeds capacity', timestamp: new Date(), error: `Max: $${(remainingMicro / 1_000_000).toFixed(2)}` }); setIsFunding(false); return; }
    const logId = addLog({ status: 'pending', label: `Fund ${matchedPool.account.cropName} — $${investAmount}`, timestamp: new Date() });
    try {
      const { txSig } = await fundYield(poolPublicKey, amountUsdc);
      updateLog(logId, { status: 'success', sig: txSig });
      setSuccessToast({ title: 'Receipt Tokens Minted', message: `You received ${parseFloat(investAmount).toFixed(2)} Pool Receipt Tokens.` });
      setInvestAmount('');
      setLivePools(prev => prev.map(pool => pool.publicKey.toBase58() === selectedPoolKey ? { ...pool, account: { ...pool.account, totalFundedUsdc: pool.account.totalFundedUsdc.add(new BN(amountUsdc)) } } : pool));
      setReceiptBalance(prev => prev + amountFloat);
      await refreshWithRetry();
    } catch (e: unknown) { updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) }); }
    finally { setIsFunding(false); }
  }, [isReady, investAmount, selectedPoolKey, livePools, fundYield, addLog, updateLog, refreshWithRetry]);

  const handleClaim = useCallback(async () => {
    if (!isReady || !selectedPoolKey) return;
    let poolPublicKey: PublicKey;
    try { poolPublicKey = new PublicKey(selectedPoolKey); } catch { addLog({ status: 'error', label: 'Invalid pool key', timestamp: new Date(), error: 'Invalid key.' }); return; }
    setIsClaiming(true);
    const matchedPool = livePools.find(p => p.publicKey.toBase58() === selectedPoolKey);
    const logId = addLog({ status: 'pending', label: `Claim Yield — ${matchedPool?.account.cropName || 'Pool'}`, timestamp: new Date() });
    try {
      const { txSig } = await claimYield(poolPublicKey);
      updateLog(logId, { status: 'success', sig: txSig });
      setSuccessToast({ title: 'USDC Yield Claimed', message: 'Your USDC yield share has been sent to your wallet.' });
      setReceiptBalance(0);
      await refreshWithRetry();
    } catch (e: unknown) { updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) }); }
    finally { setIsClaiming(false); }
  }, [isReady, selectedPoolKey, livePools, claimYield, addLog, updateLog, refreshWithRetry]);

  const handleRefund = useCallback(async () => {
    if (!isReady || !selectedPoolKey || !refundAmount) return;
    let poolPublicKey: PublicKey;
    try { poolPublicKey = new PublicKey(selectedPoolKey); } catch { addLog({ status: 'error', label: 'Invalid key', timestamp: new Date(), error: 'Invalid key.' }); return; }
    const amountFloat = parseFloat(refundAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) { addLog({ status: 'error', label: 'Invalid amount', timestamp: new Date(), error: 'Amount must be > 0.' }); return; }
    if (amountFloat > receiptBalance) { addLog({ status: 'error', label: 'Exceeds balance', timestamp: new Date(), error: `Max: $${receiptBalance.toFixed(2)}` }); return; }
    setIsRefunding(true);
    const amountUsdc = Math.round(amountFloat * 1_000_000);
    const matchedPool = livePools.find(p => p.publicKey.toBase58() === selectedPoolKey);
    const logId = addLog({ status: 'pending', label: `Refund ${matchedPool?.account.cropName || 'Pool'} — $${amountFloat.toFixed(2)}`, timestamp: new Date() });
    try {
      const { txSig } = await refundInvestment(poolPublicKey, amountUsdc);
      updateLog(logId, { status: 'success', sig: txSig });
      setSuccessToast({ title: 'Investment Refunded', message: `Returned ${amountFloat.toFixed(2)} tokens. USDC returned to wallet.` });
      setRefundAmount('');
      setLivePools(prev => prev.map(pool => pool.publicKey.toBase58() === selectedPoolKey ? { ...pool, account: { ...pool.account, totalFundedUsdc: pool.account.totalFundedUsdc.sub(new BN(amountUsdc)) } } : pool));
      setReceiptBalance(prev => prev - amountFloat);
      await refreshWithRetry();
    } catch (e: unknown) { updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) }); }
    finally { setIsRefunding(false); }
  }, [isReady, selectedPoolKey, refundAmount, receiptBalance, livePools, refundInvestment, addLog, updateLog, refreshWithRetry]);

  /* ── Render ── */
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px', position: 'relative' }}>

      {/* Success toast */}
      {successToast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 200, maxWidth: '380px', display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 18px', borderRadius: 'var(--card-radius)', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 700 }}>✓</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>{successToast.title}</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{successToast.message}</p>
          </div>
          <button onClick={() => setSuccessToast(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Yield Markets
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
            Investor Marketplace
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Fund verified agricultural yield pools and earn transparent on-chain returns.
          </p>
        </div>
        {mounted && isReady && (
          <button
            onClick={refreshMarketplace}
            disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', opacity: isFetching ? 0.6 : 1, fontFamily: 'var(--font-mono)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFetching ? '#f59e0b' : 'var(--accent)', animation: isFetching ? 'blink 1s infinite' : 'none' }} />
            {isFetching ? 'Syncing…' : 'Live Devnet'}
          </button>
        )}
      </div>

      {mounted && !connected && (
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)', fontSize: '13px', color: '#f59e0b' }}>
          <span>◬</span> Connect your wallet to fund yield pools on-chain.
        </div>
      )}

      <div className="responsive-layout-grid">

        {/* ── LEFT: Pool listing ── */}
        <section>
          {/* Filters + count */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Open Yield Pools</h2>
              {livePools.length > 0 && (
                <span style={{ padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--border)', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {livePools.length} on-chain
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{
                  padding: '5px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
                  ...(activeFilter === f
                    ? { background: 'var(--accent)', color: '#000', borderColor: 'var(--accent)' }
                    : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                  ),
                }}
                  onMouseEnter={e => { if (activeFilter !== f) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                  onMouseLeave={e => { if (activeFilter !== f) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                >{f}</button>
              ))}
            </div>
          </div>

          {/* Pool cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!isReady && (
              <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 'var(--card-radius)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>
                Connect your wallet to load live yield pools.
              </div>
            )}
            {isReady && livePools.length === 0 && !isFetching && (
              <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 'var(--card-radius)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No initialized pools on-chain yet.</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Visit the <span style={{ color: 'var(--accent)' }}>Estate Portal</span> to initialize a yield pool first.</p>
              </div>
            )}
            {isReady && livePools.length > 0 && filteredMerged.length === 0 && (
              <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 'var(--card-radius)', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-muted)' }}>
                No pools in <span style={{ color: 'var(--accent)' }}>{activeFilter}</span>.
              </div>
            )}

            {filteredMerged.map(({ meta, livePool }) => {
              const goalMicro   = livePool ? deriveGoal(livePool) : 0;
              const fundedMicro = livePool ? livePool.account.totalFundedUsdc.toNumber() : 0;
              const percentage  = pct(fundedMicro, goalMicro);
              const remainingUsd = toUsdc(Math.max(goalMicro - fundedMicro, 0));
              const goalUsd     = toUsdc(goalMicro);
              const fundedUsd   = toUsdc(fundedMicro);
              const isSelected  = selectedPool?.publicKey.toBase58() === livePool?.publicKey.toBase58();

              return (
                <div
                  key={livePool ? livePool.publicKey.toBase58() : meta.crop}
                  onClick={() => { const idx = livePools.findIndex(p => p.publicKey.toBase58() === livePool.publicKey.toBase58()); if (idx !== -1) setSelectedIdx(idx); }}
                  style={{
                    padding: '20px 22px', borderRadius: 'var(--card-radius)', border: `1px solid ${isSelected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                    background: isSelected ? 'rgba(34,197,94,0.04)' : 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }} title={livePool?.account.estateName}>
                            {livePool ? livePool.account.estateName : meta.farmer}
                          </p>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {meta.crop} · <span style={{ color: 'var(--text-muted)' }}>{meta.region}</span>
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{meta.apr}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>Est. APR</p>
                        </div>
                      </div>

                      {/* Metrics row */}
                      <div className="responsive-grid-3-cols" style={{ marginBottom: '12px' }}>
                        {[
                          { label: 'Funded', value: livePool ? `$${fundedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—', color: 'var(--text-primary)' },
                          { label: 'Goal', value: livePool ? `$${goalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—', color: 'var(--accent)' },
                          { label: 'Remaining', value: livePool ? `$${remainingUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—', color: 'var(--text-secondary)' },
                        ].map(m => (
                          <div key={m.label} style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>{m.label}</p>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      {livePool && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>${toUsdc(fundedMicro).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{percentage.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s' }} />
                          </div>
                        </>
                      )}

                      {/* Tags row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                        {livePool && <StatusPill status={livePool.account.status} />}
                        {['KYC Verified', 'Insurance Active', 'USDC Settlement', 'Audited'].map(tag => (
                          <span key={tag} style={{ padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RIGHT: Invest panel ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '80px' }}>

          {/* Invest card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '24px 22px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
              Invest in Pool
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: '18px' }}>
              {selectedItem.meta.crop || 'Select a Pool'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Pool selector */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Selected Pool</label>
                {livePools.length > 0 ? (
                  <select
                    id="investor-pool-select"
                    value={selectedPoolKey}
                    onChange={e => { const key = e.target.value; setSelectedPoolKey(key); const idx = livePools.findIndex(p => p.publicKey.toBase58() === key); if (idx !== -1) setSelectedIdx(idx); }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  >
                    {livePools.map(pool => { const meta = getPoolMeta(pool); const key = pool.publicKey.toBase58(); return (<option key={key} value={key}>{meta.crop} · {key.slice(0, 6)}…{key.slice(-4)}</option>); })}
                  </select>
                ) : (
                  <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {isReady ? 'No pools found on-chain…' : 'Connect wallet to load pools'}
                  </div>
                )}
              </div>

              {/* Pool address display */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pool Address</label>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(34,197,94,0.2)' }}>✓ Auto-resolved</span>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-base)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.5, cursor: 'text', userSelect: 'all' }}>
                  {selectedPoolKey || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Waiting for on-chain data…</span>}
                </div>
              </div>

              {/* Asset risk profile */}
              <AssetRiskProfile
                pool={selectedItem.livePool ?? { publicKey: new PublicKey('11111111111111111111111111111111'), account: { authority: new PublicKey('11111111111111111111111111111111'), totalYieldKg: { toNumber: () => 0 } as any, pricePerKg: { toNumber: () => 0 } as any, totalFundedUsdc: { toNumber: () => 0 } as any, isActive: true } }}
                meta={selectedItem.meta}
              />

              {/* Tab switcher (deposit/refund) */}
              {isPoolOpen && receiptBalance > 0 && (
                <div style={{ display: 'flex', gap: '6px', padding: '4px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  {(['deposit', 'refund'] as const).map(tab => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
                      flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                      ...(activeTab === tab
                        ? { background: tab === 'deposit' ? 'var(--accent)' : 'var(--danger)', color: tab === 'deposit' ? '#000' : '#fff' }
                        : { background: 'transparent', color: 'var(--text-secondary)' }
                      ),
                    }}>
                      {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
                    </button>
                  ))}
                </div>
              )}

              {/* Deposit tab */}
              {(activeTab === 'deposit' || !isPoolOpen || receiptBalance === 0) ? (
                <>
                  {isClaimable && isDefaulted && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', fontSize: '12px', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>◬</span> POOL DEFAULTED: Parametric Insurance Claim Unlocked
                    </div>
                  )}
                  {/* Amount input */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Amount (USDC)</label>
                      {selectedItem.livePool && (() => {
                        const maxUsd = Math.max((deriveGoal(selectedItem.livePool) - selectedItem.livePool.account.totalFundedUsdc.toNumber()) / 1_000_000, 0);
                        return <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>max <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${maxUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>;
                      })()}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '14px' }}>$</span>
                      <input
                        id="invest-amount"
                        type="number" min={0.01} step={0.01}
                        disabled={!isPoolOpen}
                        value={investAmount}
                        onChange={e => setInvestAmount(e.target.value)}
                        placeholder={isPoolOpen ? '0.00' : 'Closed'}
                        style={{ width: '100%', padding: '10px 12px 10px 26px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-mono)', outline: 'none', transition: 'border-color 0.2s' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </div>
                  </div>

                  {/* Preset amounts */}
                  {selectedItem.livePool?.account.status.open !== undefined && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {PRESET_AMOUNTS.map(amt => (
                        <button key={amt} id={`preset-${amt}`} onClick={() => setInvestAmount(String(amt))} disabled={!isPoolOpen}
                          style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-mono)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                          ${amt >= 1_000 ? `${amt / 1_000}k` : amt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  {isClaimable ? (
                    <button id="claim-yield-submit" onClick={handleClaim} disabled={!isReady || isClaiming || !selectedPoolKey}
                      style={{ width: '100%', padding: '14px', borderRadius: '999px', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s', opacity: (!isReady || isClaiming || !selectedPoolKey) ? 0.4 : 1 }}>
                      {isClaiming ? 'Claiming Yield…' : 'Claim Yield USDC'}
                    </button>
                  ) : (
                    <button id="fund-submit" onClick={handleFund} disabled={!isReady || isFunding || !selectedPoolKey || (connected && (!isPoolOpen || !investAmount))}
                      style={{ width: '100%', padding: '14px', borderRadius: '999px', background: isPoolOpen ? 'var(--accent)' : 'var(--bg-surface)', color: isPoolOpen ? '#000' : 'var(--text-muted)', fontWeight: 700, fontSize: '14px', border: isPoolOpen ? 'none' : '1px solid var(--border)', cursor: isPoolOpen ? 'pointer' : 'not-allowed', transition: 'opacity 0.2s', opacity: (!isReady || isFunding || !selectedPoolKey || (connected && (!isPoolOpen || !investAmount))) ? 0.4 : 1 }}>
                      {isFunding ? 'Sending Transaction…' : !connected ? 'Connect Wallet to Invest' : !selectedPoolKey ? 'Loading pool…' : !isPoolOpen ? 'Farming in Progress' : 'Fund Pool'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Refund tab */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Withdraw Amount (USDC)</label>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max: <span style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${receiptBalance.toFixed(2)}</span></span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '14px' }}>$</span>
                      <input id="refund-amount-input" type="number" min={0.01} step={0.01} max={receiptBalance} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="0.00"
                        style={{ width: '100%', padding: '10px 56px 10px 26px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-mono)', outline: 'none', transition: 'border-color 0.2s' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--danger)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                      />
                      <button type="button" onClick={() => setRefundAmount(String(receiptBalance))}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                        MAX
                      </button>
                    </div>
                  </div>
                  <button id="refund-submit" onClick={handleRefund} disabled={!isReady || isRefunding || !selectedPoolKey || !refundAmount || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > receiptBalance}
                    style={{ width: '100%', padding: '14px', borderRadius: '999px', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontWeight: 700, fontSize: '14px', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', transition: 'all 0.2s', opacity: (!isReady || isRefunding || !selectedPoolKey || !refundAmount || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > receiptBalance) ? 0.4 : 1 }}>
                    {isRefunding ? 'Withdrawing…' : 'Withdraw USDC'}
                  </button>
                </>
              )}

              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Solana Devnet · ~400ms finality
              </p>
            </div>
          </div>

          {/* Market ranking */}
          {mergedPools.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Market Ranking</div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{filteredMerged.length} pools</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {mergedPools.map(({ meta, livePool }, i) => {
                  const goalMicro   = deriveGoal(livePool);
                  const fundedMicro = livePool.account.totalFundedUsdc.toNumber();
                  const percentage  = pct(fundedMicro, goalMicro);
                  const isSelected  = selectedPool?.publicKey.toBase58() === livePool?.publicKey.toBase58();
                  return (
                    <div key={livePool.publicKey.toBase58()} onClick={() => setSelectedIdx(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${isSelected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, background: isSelected ? 'rgba(34,197,94,0.04)' : 'var(--bg-surface)', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <span style={{ width: 20, textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{meta.crop}</p>
                        <div style={{ height: '3px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{meta.apr}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{percentage.toFixed(0)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transaction log */}
          {txLogs.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Transaction Log</div>
                <button onClick={() => setTxLogs([])} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >Clear</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {txLogs.map(log => <TxBadge key={log.id} log={log} />)}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
