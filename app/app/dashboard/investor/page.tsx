'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useAgriFund, type OnChainPool } from '@/hooks/useAgriFund';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// ── Types ──────────────────────────────────────────────────────────────────
interface TxLog {
  id: string;
  status: 'pending' | 'success' | 'error';
  sig?: string;
  error?: string;
  label: string;
  timestamp: Date;
}

// ── Static catalog metadata (display labels, APR etc.) ────────────────────
// The on-chain data now stores crop_name. We enrich it with
// display metadata keyed by cropName.
interface PoolMeta {
  farmer: string;
  crop: string;
  region: string;
  avatar: string;
  apr: string;
  category: string;
}

const getPoolMeta = (pool: OnChainPool | null): PoolMeta => {
  if (!pool) return {
    farmer: 'Unknown Farmer',
    crop: 'Unknown Crop',
    region: 'Unknown Region',
    avatar: '🌱',
    apr: '0.0%',
    category: 'Other'
  };
  const apr = pool.account.apr ? `${(pool.account.apr / 100).toFixed(1)}%` : '0.0%';
  const category = pool.account.category || 'Other';
  
  // Choose avatar based on category or crop name
  const cropLower = pool.account.cropName?.toLowerCase() || '';
  const categoryLower = category.toLowerCase();
  let avatar = '🌱';
  if (categoryLower.includes('coffee') || cropLower.includes('coffee')) {
    avatar = '☕';
  } else if (categoryLower.includes('grain') || cropLower.includes('rice') || cropLower.includes('wheat') || cropLower.includes('grain')) {
    avatar = '🌾';
  } else if (categoryLower.includes('oil') || cropLower.includes('sesame') || cropLower.includes('seed')) {
    avatar = '🌻';
  } else if (cropLower.includes('tea')) {
    avatar = '🍃';
  }
  
  return {
    farmer: pool.account.estateName || `Farm ${pool.account.authority.toBase58().slice(0, 4)}`,
    crop: pool.account.cropName || 'Unknown Crop',
    region: pool.account.region || 'Decentralized',
    avatar,
    apr,
    category
  };
};

const PRESET_AMOUNTS = [100, 500, 1_000, 5_000];
const FILTERS        = ['All', 'Grains', 'Coffee', 'Oils'] as const;
type Filter = typeof FILTERS[number];

// ── Helpers ────────────────────────────────────────────────────────────────
/** Convert micro-USDC BN to USD number */
const toUsdc = (microUsdc: number) => microUsdc / 1_000_000;

const getStatusLabelAndColor = (status: any) => {
  if (!status) return { label: '● Pool Open', style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
  if (status.open !== undefined) return { label: '● Pool Open', style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
  if (status.farming !== undefined) return { label: '🌾 Farming', style: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' };
  if (status.settled !== undefined) return { label: '✅ Settled', style: 'bg-teal-500/10 border-teal-500/30 text-teal-400' };
  if (status.defaulted !== undefined) return { label: '⚠️ Defaulted', style: 'bg-red-500/10 border-red-500/30 text-red-400' };
  return { label: 'Unknown', style: 'bg-slate-500/10 border-slate-500/30 text-slate-400' };
};

/** Derive the goal from on-chain data: totalYieldKg × pricePerKg (micro-USDC) */
const deriveGoal = (pool: OnChainPool) =>
  pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber();

/** Funding % clamped to 100 */
const pct = (funded: number, goal: number) =>
  goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;

// ── Sub-components ─────────────────────────────────────────────────────────
const AssetRiskProfile = ({ pool, meta }: { pool: OnChainPool; meta: PoolMeta }) => {
  const yieldKg  = pool.account.totalYieldKg.toNumber();
  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-900/10 p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🛡️</span>
        <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Asset Risk Profile</span>
      </div>
      <div className="space-y-1.5 text-xs">
        {[
          { label: 'Insurance',    value: 'Active (Flood & Drought)' },
          { label: 'Auditor',      value: 'Regional AgriCorp'        },
          { label: 'Settlement',   value: 'USDC on Solana'           },
          { label: 'Oracle Feed',  value: 'Chainlink Weather API'    },
          { label: 'Collateral',   value: `${yieldKg.toLocaleString()} kg ${meta.crop}` },
          { label: 'Expected APR', value: meta.apr                   },
        ].map(row => (
          <div key={row.label}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-3 py-1.5">
            <span className="text-slate-500">{row.label}</span>
            <span className="font-medium text-emerald-400">✓ {row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProgressBar = ({ funded, goal }: { funded: number; goal: number }) => {
  const percentage = pct(funded, goal);
  const fundedUsd  = toUsdc(funded);
  const goalUsd    = toUsdc(goal);
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
        <span>${fundedUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span>{percentage.toFixed(1)}% filled</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-slate-500">
        Goal: ${goalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
};

const TxBadge = ({ log }: { log: TxLog }) => (
  <div className={`rounded-xl border p-3 text-xs ${
    log.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400' :
    log.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' :
    'border-red-500/30 bg-red-500/5 text-red-400'
  }`}>
    <div className="flex items-center justify-between mb-1">
      <span className="font-semibold">
        {log.status === 'pending' ? '⏳' : log.status === 'success' ? '✅' : '❌'} {log.label}
      </span>
      <span className="text-slate-500">{log.timestamp.toLocaleTimeString()}</span>
    </div>
    {log.sig && (
      <a href={`https://explorer.solana.com/tx/${log.sig}?cluster=devnet`}
        target="_blank" rel="noopener noreferrer"
        className="font-mono text-[10px] text-emerald-500 underline hover:text-emerald-300 truncate block transition-colors">
        🔗 {log.sig.slice(0, 28)}…
      </a>
    )}
    {log.error && <p className="font-mono text-[10px] text-red-400 truncate">{log.error}</p>}
  </div>
);

// ── Page ───────────────────────────────────────────────────────────────────
export default function InvestorPage() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { isReady, program, fundYield, claimYield, refundInvestment, fetchAllPools } = useAgriFund();

  // ── Live on-chain state ──────────────────────────────────────────────────
  const [livePools, setLivePools]         = useState<OnChainPool[]>([]);
  const [isFetching, setIsFetching]       = useState(false);
  const fetchedRef                        = useRef(false); // prevent double-fetch on strict mode

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [selectedPoolKey, setSelectedPoolKey] = useState<string>('');
  const [investAmount, setInvestAmount] = useState('');
  const [isFunding, setIsFunding]       = useState(false);
  const [isClaiming, setIsClaiming]     = useState(false);
  const [isRefunding, setIsRefunding]   = useState(false);
  const [receiptBalance, setReceiptBalance] = useState<number>(0);
  const [txLogs, setTxLogs]             = useState<TxLog[]>([]);
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  interface ToastConfig {
    title: string;
    message: string;
    icon: string;
  }
  const [successToast, setSuccessToast] = useState<ToastConfig | null>(null);
  const [activeTab, setActiveTab]       = useState<'deposit' | 'refund'>('deposit');
  const [refundAmount, setRefundAmount] = useState('');

  const [mounted, setMounted]           = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (receiptBalance === 0) {
      setActiveTab('deposit');
    }
  }, [receiptBalance]);
  
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);



  // Auto-default selectedPoolKey when live data arrives
  useEffect(() => {
    if (livePools.length > 0 && !selectedPoolKey) {
      setSelectedPoolKey(livePools[selectedIdx]?.publicKey.toBase58() ?? '');
    }
  }, [livePools, selectedIdx, selectedPoolKey]);

  // Keep selectedPoolKey in sync when the user switches pool in the dropdown or card list
  useEffect(() => {
    if (livePools[selectedIdx]) {
      setSelectedPoolKey(livePools[selectedIdx].publicKey.toBase58());
    }
  }, [selectedIdx, livePools]);

  // Select active pool based on query parameter (?pool=ADDRESS)
  useEffect(() => {
    if (typeof window !== 'undefined' && livePools.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const poolParam = params.get('pool');
      if (poolParam) {
        const idx = livePools.findIndex(p => p.publicKey.toBase58() === poolParam);
        if (idx !== -1) {
          setSelectedIdx(idx);
          setSelectedPoolKey(poolParam);
        }
      }
    }
  }, [livePools]);

  // ── Marketplace refresh ──────────────────────────────────────────────────
  const refreshMarketplace = useCallback(async () => {
    if (!isReady) return;
    setIsFetching(true);
    try {
      const pools = await fetchAllPools();
      setLivePools(pools);
    } finally {
      setIsFetching(false);
    }
  }, [isReady, fetchAllPools]);

  const fetchReceiptBalance = useCallback(async () => {
    const currentPool = livePools[selectedIdx];
    if (!connection || !publicKey || !currentPool) {
      setReceiptBalance(0);
      return;
    }
    try {
      const receiptMint = currentPool.account.receiptMint;
      const investorReceiptAta = await getAssociatedTokenAddress(receiptMint, publicKey);
      const balanceResponse = await connection.getTokenAccountBalance(investorReceiptAta);
      setReceiptBalance(balanceResponse.value.uiAmount ?? 0);
    } catch (e) {
      setReceiptBalance(0);
    }
  }, [connection, publicKey, livePools, selectedIdx]);



  // A helper to refresh multiple times to ensure RPC consistency
  const refreshWithRetry = useCallback(async () => {
    // Refresh immediately
    await refreshMarketplace();
    await fetchReceiptBalance();
    
    // Refresh again after 1s
    setTimeout(async () => {
      await refreshMarketplace();
      await fetchReceiptBalance();
    }, 1000);

    // Refresh again after 2.5s
    setTimeout(async () => {
      await refreshMarketplace();
      await fetchReceiptBalance();
    }, 2500);
  }, [refreshMarketplace, fetchReceiptBalance]);

  // Fetch on mount/wallet ready
  useEffect(() => {
    if (!isReady || fetchedRef.current) return;
    fetchedRef.current = true;
    refreshMarketplace();
  }, [isReady, refreshMarketplace]);

  useEffect(() => {
    fetchReceiptBalance();
  }, [fetchReceiptBalance, livePools, selectedIdx]);



  useEffect(() => {
    if (!isReady || !program) return;

    const refresh = () => {
      refreshMarketplace();
      fetchReceiptBalance();
    };

    const listeners = [
      program.addEventListener('YieldFunded', refresh),
      program.addEventListener('CapitalWithdrawn', refresh),
      program.addEventListener('PoolSettled', refresh),
      program.addEventListener('DefaultTriggered', refresh),
      program.addEventListener('YieldClaimed', refresh),
      program.addEventListener('InvestmentRefunded', refresh),
    ];

    return () => {
      listeners.forEach(id => {
        try {
          program.removeEventListener(id);
        } catch (e) {
          // ignore
        }
      });
    };
  }, [isReady, program, refreshMarketplace, fetchReceiptBalance]);

  // ── Derived display data ─────────────────────────────────────────────────
  // Only surface entries that have a confirmed on-chain account.
  // We enrich the live on-chain data with static CATALOG metadata based on cropName.
  const mergedPools = livePools.map(livePool => {
    const meta = getPoolMeta(livePool);
    return { meta, livePool };
  });

  const filteredMerged = activeFilter === 'All'
    ? mergedPools
    : mergedPools.filter(p => p.livePool.account.category.toLowerCase() === activeFilter.toLowerCase());

  const selectedPool = livePools[selectedIdx];

  const selectedItem = mergedPools.find((_, i) => i === selectedIdx) ?? mergedPools[0] ?? {
    meta: getPoolMeta(null),
    livePool: null,
  };

  const isPoolOpen = !selectedItem.livePool || selectedItem.livePool.account.status.open !== undefined;
  const isClaimable = !!selectedItem.livePool && (selectedItem.livePool.account.status.settled !== undefined || selectedItem.livePool.account.status.defaulted !== undefined);
  const isDefaulted = !!selectedItem.livePool && selectedItem.livePool.account.status.defaulted !== undefined;

  // ── Transaction helpers ───────────────────────────────────────────────────
  const addLog = useCallback((log: Omit<TxLog, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setTxLogs(prev => [{ ...log, id }, ...prev].slice(0, 10));
    return id;
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<TxLog>) =>
    setTxLogs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)), []);

  const handleFund = useCallback(async () => {
    // Guard 1: basics
    if (!isReady || !investAmount || !selectedPoolKey) return;

    // Guard 2: selectedPoolKey must match an active initialized pool on-chain
    const matchedPool = livePools.find(p => p.publicKey.toBase58() === selectedPoolKey);
    const matchedPoolOpen = matchedPool && matchedPool.account.status.open !== undefined;
    if (!matchedPool || !matchedPoolOpen) {
      addLog({
        status: 'error',
        label: 'Pool not initialized or open',
        timestamp: new Date(),
        error: matchedPool
          ? 'This pool is closed and no longer accepting funds.'
          : 'Selected pool does not exist on-chain. Please choose an initialized pool.',
      });
      return;
    }

    let poolPublicKey: PublicKey;
    try {
      poolPublicKey = new PublicKey(selectedPoolKey);
    } catch {
      addLog({ status: 'error', label: 'Invalid pool key', timestamp: new Date(),
        error: 'Selected pool has an invalid public key.' });
      return;
    }

    setIsFunding(true);
    const amountFloat = parseFloat(investAmount);
    const amountUsdc  = Math.round(amountFloat * 1_000_000);

    // Guard 3: amount must be positive
    if (amountFloat <= 0) {
      addLog({ status: 'error', label: 'Invalid amount', timestamp: new Date(),
        error: 'Amount must be greater than zero.' });
      setIsFunding(false);
      return;
    }

    // Guard 4: amount must not exceed remaining pool capacity (client-side mirror of on-chain check)
    const goalMicro      = matchedPool.account.totalYieldKg.toNumber() * matchedPool.account.pricePerKg.toNumber();
    const fundedMicro    = matchedPool.account.totalFundedUsdc.toNumber();
    const remainingMicro = Math.max(goalMicro - fundedMicro, 0);
    if (amountUsdc > remainingMicro) {
      const remainingUsd = (remainingMicro / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
      addLog({
        status: 'error',
        label: 'Amount exceeds pool capacity',
        timestamp: new Date(),
        error: `Maximum fundable amount is $${remainingUsd}. Reduce your investment.`,
      });
      setIsFunding(false);
      return;
    }

    const logId = addLog({
      status: 'pending',
      label: `Fund ${matchedPool.account.cropName} — $${investAmount}`,
      timestamp: new Date(),
    });

    try {
      const { txSig } = await fundYield(poolPublicKey, amountUsdc);
      updateLog(logId, { status: 'success', sig: txSig });
      
      const formattedAmount = parseFloat(investAmount).toLocaleString(undefined, { minimumFractionDigits: 2 });
      setSuccessToast({
        title: 'Receipt Tokens Minted',
        message: `Transaction Successful! You received ${formattedAmount} Pool Receipt Tokens in your wallet.`,
        icon: '🎉',
      });
      
      setInvestAmount('');

      // Optimistically update local states immediately upon success
      setLivePools(prev => prev.map(pool => {
        if (pool.publicKey.toBase58() === selectedPoolKey) {
          return {
            ...pool,
            account: {
              ...pool.account,
              totalFundedUsdc: pool.account.totalFundedUsdc.add(new BN(amountUsdc))
            }
          };
        }
        return pool;
      }));
      setReceiptBalance(prev => prev + amountFloat);

      // Close the transaction loop: re-fetch on-chain state immediately with retries
      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsFunding(false);
    }
  }, [isReady, investAmount, selectedPoolKey, livePools, selectedItem, fundYield, addLog, updateLog, refreshWithRetry]);

  const handleClaim = useCallback(async () => {
    if (!isReady || !selectedPoolKey) return;
    
    let poolPublicKey: PublicKey;
    try {
      poolPublicKey = new PublicKey(selectedPoolKey);
    } catch {
      addLog({ status: 'error', label: 'Invalid pool key', timestamp: new Date(),
        error: 'Selected pool has an invalid public key.' });
      return;
    }

    setIsClaiming(true);
    const matchedPool = livePools.find(p => p.publicKey.toBase58() === selectedPoolKey);
    const logId = addLog({
      status: 'pending',
      label: `Claim Yield — ${matchedPool?.account.cropName || 'Pool'}`,
      timestamp: new Date(),
    });

    try {
      const { txSig } = await claimYield(poolPublicKey);
      updateLog(logId, { status: 'success', sig: txSig });
      setSuccessToast({
        title: 'USDC Yield Claimed',
        message: `Transaction Successful! You successfully claimed your USDC yield share in your wallet.`,
        icon: '💰',
      });
      
      // Optimistically update local states immediately upon success
      setReceiptBalance(0);

      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsClaiming(false);
    }
  }, [isReady, selectedPoolKey, livePools, claimYield, addLog, updateLog, refreshWithRetry]);

  const handleRefund = useCallback(async () => {
    if (!isReady || !selectedPoolKey || !refundAmount) return;

    let poolPublicKey: PublicKey;
    try {
      poolPublicKey = new PublicKey(selectedPoolKey);
    } catch {
      addLog({ status: 'error', label: 'Invalid pool key', timestamp: new Date(),
        error: 'Selected pool has an invalid public key.' });
      return;
    }

    const amountFloat = parseFloat(refundAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      addLog({ status: 'error', label: 'Invalid refund amount', timestamp: new Date(),
        error: 'Amount must be greater than zero.' });
      return;
    }

    if (amountFloat > receiptBalance) {
      addLog({ status: 'error', label: 'Refund exceeds balance', timestamp: new Date(),
        error: `Maximum refundable amount is $${receiptBalance.toFixed(2)}.` });
      return;
    }

    setIsRefunding(true);
    const amountUsdc = Math.round(amountFloat * 1_000_000);

    const matchedPool = livePools.find(p => p.publicKey.toBase58() === selectedPoolKey);
    const logId = addLog({
      status: 'pending',
      label: `Refund ${matchedPool?.account.cropName || 'Pool'} — $${amountFloat.toFixed(2)}`,
      timestamp: new Date(),
    });

    try {
      const { txSig } = await refundInvestment(poolPublicKey, amountUsdc);
      updateLog(logId, { status: 'success', sig: txSig });
      
      const formattedAmount = amountFloat.toLocaleString(undefined, { minimumFractionDigits: 2 });
      setSuccessToast({
        title: 'Investment Refunded',
        message: `Refund Successful! You returned ${formattedAmount} Pool Receipt Tokens and received your USDC back.`,
        icon: '↩️',
      });
      
      setRefundAmount('');

      // Optimistically update local states immediately upon success
      setLivePools(prev => prev.map(pool => {
        if (pool.publicKey.toBase58() === selectedPoolKey) {
          return {
            ...pool,
            account: {
              ...pool.account,
              totalFundedUsdc: pool.account.totalFundedUsdc.sub(new BN(amountUsdc))
            }
          };
        }
        return pool;
      }));
      setReceiptBalance(prev => prev - amountFloat);

      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsRefunding(false);
    }
  }, [isReady, selectedPoolKey, refundAmount, receiptBalance, livePools, refundInvestment, addLog, updateLog, refreshWithRetry]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {successToast && (
        <div className="fixed bottom-5 right-5 z-55 flex max-w-md items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 text-lg">
            {successToast.icon}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{successToast.title}</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{successToast.message}</p>
          </div>
          <button 
            onClick={() => setSuccessToast(null)} 
            className="text-slate-500 hover:text-slate-350 transition-colors p-1"
          >
            ✕
          </button>
        </div>
      )}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 h-[600px] w-[500px] rounded-full bg-teal-900/15 blur-3xl" />
      </div>

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-xl">📊</span>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Investor Marketplace</h1>
            <p className="text-sm text-slate-500">
              Fund verified agricultural yield pools and earn transparent on-chain returns
            </p>
          </div>
          {/* Live sync badge */}
          {mounted && isReady && (
            <button
              onClick={refreshMarketplace}
              disabled={isFetching}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-50"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isFetching ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
              {isFetching ? 'Syncing…' : 'Live Devnet'}
            </button>
          )}
        </div>
        {mounted && !connected && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400">
            <span>⚠️</span>
            <span>Connect your wallet to fund yield pools on-chain.</span>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* ── Pool listing — 3/5 ──────────────────────────────────────── */}
        <section className="lg:col-span-3">

          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white">Open Yield Pools</h2>
              {livePools.length > 0 && (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-400">
                  {livePools.length} on-chain
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {FILTERS.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    activeFilter === f
                      ? 'bg-emerald-600 text-white shadow shadow-emerald-900/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-emerald-500/40 hover:text-emerald-400'
                  }`}>{f}</button>
              ))}
            </div>
          </div>

          {/* Pool cards */}
          <div className="flex flex-col gap-3">
            {/* Empty states */}
            {!isReady && (
              <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-10 text-center text-sm text-slate-500">
                Connect your wallet to load live yield pools.
              </div>
            )}
            {isReady && livePools.length === 0 && !isFetching && (
              <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-10 text-center">
                <p className="text-sm text-slate-400 mb-1">No initialized pools on-chain yet.</p>
                <p className="text-xs text-slate-600">Visit the <span className="text-emerald-500">Estate Portal</span> to initialize a yield pool first.</p>
              </div>
            )}
            {isReady && livePools.length > 0 && filteredMerged.length === 0 && (
              <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-10 text-center text-sm text-slate-500">
                No initialized pools in <span className="text-emerald-400">{activeFilter}</span>.
              </div>
            )}

            {filteredMerged.map(({ meta, livePool }, displayIdx) => {
              // Pull live on-chain numbers when available, else show skeleton zeros
              const goalMicro    = livePool ? deriveGoal(livePool) : 0;
              const fundedMicro  = livePool ? livePool.account.totalFundedUsdc.toNumber() : 0;
              const percentage   = pct(fundedMicro, goalMicro);
              const remainingUsd = toUsdc(Math.max(goalMicro - fundedMicro, 0));
              const goalUsd      = toUsdc(goalMicro);
              const fundedUsd    = toUsdc(fundedMicro);
              const isActive     = livePool?.account.isActive ?? true;
              const isSelected   = selectedPool?.publicKey.toBase58() === livePool?.publicKey.toBase58();

              return (
                <div key={livePool ? livePool.publicKey.toBase58() : meta.crop}
                  onClick={() => {
                    const idx = livePools.findIndex(p => p.publicKey.toBase58() === livePool.publicKey.toBase58());
                    if (idx !== -1) setSelectedIdx(idx);
                  }}
                  className={`group cursor-pointer rounded-2xl border p-5 backdrop-blur-sm transition-all duration-200 ${
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-900/10'
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-emerald-500/20 hover:bg-slate-800/60'
                  }`}>
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700/80 text-2xl">
                      {meta.avatar}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="min-w-0 flex-1">
                          <p
                            className="font-semibold text-white line-clamp-2 break-words"
                            title={livePool ? livePool.account.estateName : meta.farmer}
                          >
                            {livePool ? livePool.account.estateName : meta.farmer}
                          </p>
                          <p className="text-sm text-slate-400">{meta.crop} · {meta.region}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-extrabold text-emerald-400">{meta.apr}</p>
                          <p className="text-xs text-slate-500">Est. APR</p>
                        </div>
                      </div>

                      {/* On-chain metrics */}
                      <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
                        <div className="rounded-lg bg-slate-700/40 px-2.5 py-2 text-center">
                          <p className="text-xs text-slate-500">Funded</p>
                          <p className="text-xs font-semibold text-white">
                            {livePool
                              ? `$${fundedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : <span className="text-slate-600">—</span>}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-700/40 px-2.5 py-2 text-center">
                          <p className="text-xs text-slate-500">Goal</p>
                          <p className="text-xs font-semibold text-emerald-400">
                            {livePool
                              ? `$${goalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : <span className="text-slate-600">—</span>}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-700/40 px-2.5 py-2 text-center">
                          <p className="text-xs text-slate-500">Remaining</p>
                          <p className="text-xs font-semibold text-teal-400">
                            {livePool
                              ? `$${remainingUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : <span className="text-slate-600">—</span>}
                          </p>
                        </div>
                      </div>

                      {/* Live progress bar */}
                      {livePool ? (
                        <ProgressBar funded={fundedMicro} goal={goalMicro} />
                      ) : (
                        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-full w-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                        </div>
                      )}

                      {/* Status + compliance badges */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {livePool && (() => {
                          const { label, style } = getStatusLabelAndColor(livePool.account.status);
                          return (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
                              {label}
                            </span>
                          );
                        })()}
                        {['KYC Verified', 'Insurance Active', 'USDC Settlement', 'Audited'].map(tag => (
                          <span key={tag}
                            className="rounded-full bg-slate-700/60 border border-slate-600/40 px-2 py-0.5 text-[10px] font-medium text-slate-400">
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

        {/* ── RIGHT: Invest panel — 2/5 ──────────────────────────────── */}
        <section className="lg:col-span-2 flex flex-col gap-5">

          {/* Investment widget */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/25 via-slate-800/60 to-teal-900/15 p-5 backdrop-blur-sm">
            <h2 className="font-bold text-white mb-1">Invest in Pool</h2>
            <p className="text-xs text-slate-400 mb-5">Provide USDC funding to the selected yield pool</p>

            <div className="space-y-4">
              {/* Pool selector — driven by live on-chain accounts */}
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Selected Pool</label>
                {livePools.length > 0 ? (
                  <select
                    id="investor-pool-select"
                    value={selectedPoolKey}
                    onChange={e => {
                      const key = e.target.value;
                      setSelectedPoolKey(key);
                      const idx = livePools.findIndex(p => p.publicKey.toBase58() === key);
                      if (idx !== -1) setSelectedIdx(idx);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {livePools.map((pool, i) => {
                      const meta = getPoolMeta(pool);
                      const key  = pool.publicKey.toBase58();
                      return (
                        <option key={key} value={key}>
                          {meta.avatar} {meta.crop} · {key.slice(0, 6)}…{key.slice(-4)}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="w-full rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2.5 text-sm text-slate-500 italic">
                    {isReady ? 'No pools found on-chain yet…' : 'Connect wallet to load pools'}
                  </div>
                )}
              </div>

              {/* Verified pool address — read-only display, not editable */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500">Verified Pool Address</label>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    ✓ Auto-resolved
                  </span>
                </div>
                <div
                  id="pool-address-display"
                  aria-readonly="true"
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-950 px-3 py-2.5 font-mono text-[11px] text-slate-400 select-all cursor-text break-all leading-relaxed"
                >
                  {selectedPoolKey || <span className="text-slate-600 italic">Waiting for on-chain data…</span>}
                </div>
                <p className="mt-1 text-xs text-slate-600">Auto-populated from the selected live pool · click to copy</p>
              </div>

              {/* Asset Risk Profile — always shown for selected pool */}
              <AssetRiskProfile
                pool={selectedItem.livePool ?? {
                  publicKey: new PublicKey('11111111111111111111111111111111'),
                  account: {
                    authority: new PublicKey('11111111111111111111111111111111'),
                    totalYieldKg: { toNumber: () => 0 } as any,
                    pricePerKg:   { toNumber: () => 0 } as any,
                    totalFundedUsdc: { toNumber: () => 0 } as any,
                    isActive: true,
                  },
                }}
                meta={selectedItem.meta}
              />

              {/* Tab Switcher */}
              {isPoolOpen && receiptBalance > 0 && (
                <div className="flex gap-2 p-1 rounded-xl bg-slate-900/60 border border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'deposit'
                        ? 'bg-emerald-600/90 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    ⚡ Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('refund')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'refund'
                        ? 'bg-red-600/90 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    ↩️ Withdraw
                  </button>
                </div>
              )}

              {activeTab === 'deposit' || !isPoolOpen || receiptBalance === 0 ? (
                <>
                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-slate-500">Amount (USDC)</label>
                      {selectedItem.livePool && (() => {
                        const goalMicro   = selectedItem.livePool.account.totalYieldKg.toNumber() *
                                            selectedItem.livePool.account.pricePerKg.toNumber();
                        const fundedMicro = selectedItem.livePool.account.totalFundedUsdc.toNumber();
                        const maxUsd      = Math.max((goalMicro - fundedMicro) / 1_000_000, 0);
                        return (
                          <span className="text-[10px] text-slate-500">
                            max&nbsp;<span className="font-semibold text-teal-400">
                              ${maxUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>&nbsp;remaining
                          </span>
                        );
                      })()}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        id="invest-amount"
                        type="number"
                        min={0.01}
                        step={0.01}
                        disabled={!isPoolOpen}
                        max={selectedItem.livePool
                          ? Math.max(
                              (selectedItem.livePool.account.totalYieldKg.toNumber() *
                               selectedItem.livePool.account.pricePerKg.toNumber() -
                               selectedItem.livePool.account.totalFundedUsdc.toNumber()) / 1_000_000,
                               0
                            )
                          : undefined
                        }
                        value={investAmount}
                        onChange={e => setInvestAmount(e.target.value)}
                        placeholder={isPoolOpen ? "0.00" : "N/A - Closed"}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-7 pr-4 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Presets */}
                  {selectedItem.livePool?.account.status.open !== undefined && (
                    <div className="grid grid-cols-4 gap-2">
                      {PRESET_AMOUNTS.map(amt => (
                        <button key={amt} id={`preset-${amt}`}
                          onClick={() => setInvestAmount(String(amt))}
                          disabled={!isPoolOpen}
                          className="rounded-lg border border-slate-700 bg-slate-800/60 py-1.5 text-xs font-medium text-slate-400 transition-all hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">
                          ${amt >= 1_000 ? `${amt / 1_000}k` : amt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Submit */}
                  {isClaimable && isDefaulted && (
                    <div className="relative w-full mt-4 mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 font-semibold flex items-center gap-2">
                      <span>⚠️</span>
                      <span>POOL DEFAULTED: Parametric Insurance Claim Unlocked</span>
                    </div>
                  )}
                  {isClaimable ? (
                    <button
                      id="claim-yield-submit"
                      onClick={handleClaim}
                      disabled={!isReady || isClaiming || !selectedPoolKey}
                      className="mt-5 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-900/40 transition-all hover:from-teal-500 hover:to-emerald-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                      {isClaiming ? '⏳ Claiming Yield…' : '🎁 Claim Yield USDC'}
                    </button>
                  ) : (
                    <button
                      id="fund-submit"
                      onClick={handleFund}
                      disabled={!isReady || isFunding || !selectedPoolKey || (connected && (!isPoolOpen || !investAmount))}
                      className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:from-emerald-500 hover:to-teal-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                      {isFunding         ? '⏳ Sending Transaction…'
                        : !connected    ? '🔌 Connect Wallet to Invest'
                        : !selectedPoolKey ? '⏳ Loading pool address…'
                        : !isPoolOpen      ? 'Closed - Farming in Progress'
                        : '⚡ Fund Pool'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Refund Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-slate-500">Withdraw Amount (USDC)</label>
                      <span className="text-[10px] text-slate-500">
                        Max withdrawable:&nbsp;
                        <span className="font-semibold text-rose-400">
                          ${receiptBalance.toFixed(2)}
                        </span>
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        id="refund-amount-input"
                        type="number"
                        min={0.01}
                        step={0.01}
                        max={receiptBalance}
                        value={refundAmount}
                        onChange={e => setRefundAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-7 pr-16 text-sm text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setRefundAmount(String(receiptBalance))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-red-500/10 border border-red-500/30 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <button
                    id="refund-submit"
                    onClick={handleRefund}
                    disabled={!isReady || isRefunding || !selectedPoolKey || !refundAmount || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > receiptBalance}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/40 transition-all hover:from-red-500 hover:to-rose-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                    {isRefunding ? '⏳ Withdrawing…' : 'Withdraw'}
                  </button>
                </>
              )}
            </div>

            <p className="mt-3 text-center text-xs text-slate-600">
              Transactions settle on Solana Devnet · ~400ms finality
            </p>
          </div>

          {/* Market ranking */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Market Ranking</h2>
              <span className="rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-400">
                {filteredMerged.length} pools
              </span>
            </div>
            <div className="flex flex-col gap-2">
               {mergedPools.map(({ meta, livePool }, i) => {
                const goalMicro   = deriveGoal(livePool);
                const fundedMicro = livePool.account.totalFundedUsdc.toNumber();
                const percentage  = pct(fundedMicro, goalMicro);
                const isSelected  = selectedPool?.publicKey.toBase58() === livePool?.publicKey.toBase58();

                return (
                  <div key={livePool.publicKey.toBase58()} onClick={() => setSelectedIdx(i)}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-slate-700/40 hover:border-emerald-500/20'
                    }`}>
                    <span className="w-5 text-center text-sm font-bold text-slate-600">{i + 1}</span>
                    <span className="text-lg">{meta.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{meta.crop}</p>
                      {/* Mini progress bar */}
                      <div className="mt-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">{meta.apr}</p>
                      <p className="text-[10px] text-slate-500">{percentage.toFixed(0)}% filled</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction log */}
          {txLogs.length > 0 && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Transaction Log</h3>
                <button onClick={() => setTxLogs([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {txLogs.map(log => <TxBadge key={log.id} log={log} />)}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
