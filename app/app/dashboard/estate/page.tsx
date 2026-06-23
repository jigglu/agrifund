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

const TxEntry = ({ log }: { log: TxLog }) => (
  <div className={`rounded-xl border p-3 text-xs transition-all ${
    log.status === 'pending'
      ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
      : log.status === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
      : 'border-red-500/30 bg-red-500/5 text-red-400'
  }`}>
    <div className="flex items-center justify-between gap-2 mb-1">
      <span className="font-semibold">
        {log.status === 'pending' ? '⏳' : log.status === 'success' ? '✅' : '❌'} {log.label}
      </span>
      <span className="text-slate-500">{log.timestamp.toLocaleTimeString()}</span>
    </div>
    {log.sig && (
      <a
        href={`https://explorer.solana.com/tx/${log.sig}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[10px] text-emerald-500 underline hover:text-emerald-300 truncate block transition-colors"
      >
        🔗 {log.sig.slice(0, 28)}…
      </a>
    )}
    {log.error && (
      <p className="font-mono text-[10px] text-red-400 truncate mt-0.5">{log.error}</p>
    )}
  </div>
);

const getStatusLabelAndColor = (status: any) => {
  if (!status) return { label: 'Live', style: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' };
  if (status.open !== undefined) return { label: 'Open', style: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' };
  if (status.farming !== undefined) return { label: 'Farming', style: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' };
  if (status.settled !== undefined) return { label: 'Settled', style: 'bg-teal-500/10 border-teal-500/20 text-teal-400' };
  if (status.defaulted !== undefined) return { label: 'Defaulted', style: 'bg-red-500/10 border-red-500/20 text-red-400' };
  return { label: 'Unknown', style: 'bg-slate-500/10 border-slate-500/20 text-slate-400' };
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function EstatePage() {
  const { connected, publicKey } = useWallet();
  const { isReady, program, initializePool, withdrawCapital, settlePool, triggerDefault, fetchAllPools } = useAgriFund();
  
  const isAuthorized = connected && publicKey && AUTHORIZED_ADMINS.includes(publicKey.toBase58());

  // Transaction Logs
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
  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, string>>({});
  const [isSettlingMap, setIsSettlingMap] = useState<Record<string, boolean>>({});
  const [isDefaultingMap, setIsDefaultingMap] = useState<Record<string, boolean>>({});
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTimeTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // My Pools State
  const [myPools, setMyPools] = useState<OnChainPool[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const refreshMyPools = useCallback(async () => {
    if (!isReady || !publicKey) return;
    setIsHydrating(true);
    try {
      const all = await fetchAllPools();
      setMyPools(all.filter(p => p.account.authority.toBase58() === publicKey.toBase58()));
    } catch {
      // silently ignore
    } finally {
      setIsHydrating(false);
    }
  }, [isReady, publicKey, fetchAllPools]);

  useEffect(() => {
    refreshMyPools();
  }, [refreshMyPools]);

  useEffect(() => {
    if (!isReady || !program) return;

    const refresh = () => {
      refreshMyPools();
    };

    const listeners = [
      program.addEventListener('PoolInitialized', refresh),
      program.addEventListener('CapitalWithdrawn', refresh),
      program.addEventListener('PoolSettled', refresh),
      program.addEventListener('DefaultTriggered', refresh),
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
  }, [isReady, program, refreshMyPools]);

  const refreshWithRetry = useCallback(async () => {
    await refreshMyPools();

    setTimeout(async () => {
      await refreshMyPools();
    }, 1000);

    setTimeout(async () => {
      await refreshMyPools();
    }, 2500);
  }, [refreshMyPools]);

  // ── Helpers ───────────────────────────────────────────────────────────────
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
    const logId = addLog({
      status: 'pending',
      label: `Init: ${customCropName}`,
      timestamp: new Date(),
    });

    try {
      // Parse inputs
      const yieldKg = Number(customYieldKg);
      // Multiply by 1_000_000 for micro-USDC scaling
      const priceUsdc = Math.round(Number(customPrice) * 1_000_000);
      const vestingDuration = Number(customVestingDuration) || 180;
      const apr = Math.round(Number(customApr) * 100);
      const region = customRegion;

      const { txSig } = await initializePool(
        customEstateName,
        customCropName,
        customCategory,
        yieldKg,
        priceUsdc,
        vestingDuration,
        apr,
        region
      );
      
      updateLog(logId, { status: 'success', sig: txSig });
      
      // Clear form state
      setCustomEstateName("");
      setCustomCropName("");
      setCustomCategory("Grains");
      setCustomYieldKg("");
      setCustomPrice("");
      setCustomVestingDuration("180");
      setCustomApr("");
      setCustomRegion("");

      // Re-fetch active admin pools with retries
      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleWithdraw = async (poolAddress: PublicKey, amount: number) => {
    const key = poolAddress.toBase58();
    setIsWithdrawingMap(prev => ({ ...prev, [key]: true }));
    const logId = addLog({
      status: 'pending',
      label: `Withdraw: ${amount > 0 ? `$${(amount / 1_000_000).toFixed(2)}` : 'Start Farming'}`,
      timestamp: new Date(),
    });

    try {
      const { txSig } = await withdrawCapital(poolAddress, amount);
      updateLog(logId, { status: 'success', sig: txSig });

      // Optimistically update the local pool state immediately upon success
      setMyPools(prev => prev.map(pool => {
        if (pool.publicKey.toBase58() === key) {
          const currentAmountWithdrawn = pool.account.amountWithdrawn.toNumber();
          const nextStatus = amount === 0 ? { farming: {} } : pool.account.status;
          const nextFarmingStartTime = amount === 0 ? new BN(Math.floor(Date.now() / 1000)) : pool.account.farmingStartTime;
          return {
            ...pool,
            account: {
              ...pool.account,
              status: nextStatus,
              farmingStartTime: nextFarmingStartTime,
              amountWithdrawn: new BN(currentAmountWithdrawn + amount)
            }
          };
        }
        return pool;
      }));

      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsWithdrawingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSettle = async (poolAddress: PublicKey) => {
    const key = poolAddress.toBase58();
    const amountStr = repaymentAmounts[key];
    if (!amountStr) return;
    
    setIsSettlingMap(prev => ({ ...prev, [key]: true }));
    const amountFloat = parseFloat(amountStr);
    const amountUsdc = Math.round(amountFloat * 1_000_000);
    
    const logId = addLog({
      status: 'pending',
      label: `Settle: $${amountFloat.toFixed(2)}`,
      timestamp: new Date(),
    });

    try {
      const { txSig } = await settlePool(poolAddress, amountUsdc);
      updateLog(logId, { status: 'success', sig: txSig });
      setRepaymentAmounts(prev => ({ ...prev, [key]: "" }));

      // Optimistically update status to settled
      setMyPools(prev => prev.map(pool => {
        if (pool.publicKey.toBase58() === key) {
          return {
            ...pool,
            account: {
              ...pool.account,
              status: { settled: {} }
            }
          };
        }
        return pool;
      }));

      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSettlingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleTriggerDefault = async (poolAddress: PublicKey) => {
    const key = poolAddress.toBase58();
    setIsDefaultingMap(prev => ({ ...prev, [key]: true }));
    
    const logId = addLog({
      status: 'pending',
      label: `Oracle: Trigger Default`,
      timestamp: new Date(),
    });

    try {
      const { txSig } = await triggerDefault(poolAddress);
      updateLog(logId, { status: 'success', sig: txSig });

      // Optimistically update status to defaulted
      setMyPools(prev => prev.map(pool => {
        if (pool.publicKey.toBase58() === key) {
          return {
            ...pool,
            account: {
              ...pool.account,
              status: { defaulted: {} }
            }
          };
        }
        return pool;
      }));

      await refreshWithRetry();
    } catch (e: unknown) {
      updateLog(logId, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsDefaultingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-emerald-900/15 blur-3xl" />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl">
            🏡
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Estate Management Portal</h1>
            <p className="text-sm text-slate-500">
              Manage verified farming estates and initialize custom on-chain yield pools
            </p>
          </div>
        </div>

        {mounted && isReady && isHydrating && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Syncing on-chain pool state…
          </div>
        )}

        {mounted && !connected && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400">
            <span>⚠️</span>
            <span>Connect your wallet to initialize yield pools on-chain.</span>
          </div>
        )}
      </div>

      {mounted && connected && !isAuthorized ? (
        <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-900/10 p-12 text-center backdrop-blur-sm">
          <span className="text-4xl mb-4 block">⛔</span>
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400">Your wallet is not authorized for administrative configurations.</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Admin Form: 3/5 width */}
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-6 backdrop-blur-md shadow-lg shadow-emerald-900/20">
              <h2 className="text-lg font-bold text-white mb-1">Create New Yield Pool</h2>
              <p className="text-xs text-slate-400 mb-6">Initialize a customized asset directly on the Solana Devnet.</p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Estate Name</label>
                    <input 
                      type="text" 
                      value={customEstateName}
                      onChange={e => setCustomEstateName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                      placeholder="e.g., Mendez Agro Holdings"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Crop Name</label>
                    <input 
                      type="text" 
                      value={customCropName}
                      onChange={e => setCustomCropName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                      placeholder="e.g., Mexican Arabica Coffee"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Category</label>
                  <select
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Grains">Grains</option>
                    <option value="Coffee">Coffee</option>
                    <option value="Oils">Oils</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Total Yield (kg)</label>
                    <input 
                      type="number" 
                      value={customYieldKg}
                      onChange={e => setCustomYieldKg(e.target.value)}
                      placeholder="e.g., 5000"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Price per kg ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                      placeholder="e.g., 2.50"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Vesting Duration (seconds)</label>
                  <input 
                    type="number" 
                    value={customVestingDuration}
                    onChange={e => setCustomVestingDuration(e.target.value)}
                    placeholder="e.g., 180"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Estimated APR (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={customApr}
                      onChange={e => setCustomApr(e.target.value)}
                      placeholder="e.g., 12.5"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Region</label>
                    <input 
                      type="text" 
                      value={customRegion}
                      onChange={e => setCustomRegion(e.target.value)}
                      placeholder="e.g., Kano, Nigeria"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleInitializeCustomPool}
                  disabled={!isReady || isInitializing || !customEstateName || !customCropName || !customYieldKg || !customPrice || !customVestingDuration || !customApr || !customRegion}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isInitializing ? '⏳ Executing Transaction...' : '⚡ Initialize Pool on Devnet'}
                </button>
              </div>
            </div>

            {/* Active Admin Pools */}
            <div>
              <h2 className="text-sm font-bold text-white mb-4">Active Admin Pools ({myPools.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {myPools.map(pool => {
                  const goal = pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber();
                  const totalFunded = pool.account.totalFundedUsdc.toNumber();
                  const amountWithdrawn = pool.account.amountWithdrawn.toNumber();
                  const isFullyFunded = totalFunded >= goal;
                  const farmingStartTime = pool.account.farmingStartTime.toNumber();
                  const isFarming = pool.account.status.farming !== undefined;
                  const isOpen = pool.account.status.open !== undefined;
                  
                  // Live vesting math
                  const now = Math.floor(Date.now() / 1000);
                  let elapsed = 0;
                  if (isFarming && farmingStartTime > 0) {
                    elapsed = Math.max(0, now - farmingStartTime);
                  }
                  const vestingDuration = pool.account.vestingDuration ? pool.account.vestingDuration.toNumber() : 180;
                  const vestedPercentage = isFarming ? Math.min(elapsed / vestingDuration, 1.0) : 0;
                  const totalVested = Math.round(totalFunded * vestedPercentage);
                  const availableToWithdraw = Math.max(0, totalVested - amountWithdrawn);

                  const { label, style } = getStatusLabelAndColor(pool.account.status);

                  return (
                    <div key={pool.publicKey.toBase58()} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 transition-colors hover:bg-slate-800/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mb-0.5 truncate">{pool.account.estateName}</p>
                          <h3 className="font-semibold text-emerald-400 truncate pr-2">{pool.account.cropName}</h3>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style}`}>
                          {label}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400 flex justify-between">
                          <span>Yield:</span> <span className="text-white">{pool.account.totalYieldKg.toNumber().toLocaleString()} kg</span>
                        </p>
                        <p className="text-xs text-slate-400 flex justify-between">
                          <span>Price:</span> <span className="text-white">${(pool.account.pricePerKg.toNumber() / 1_000_000).toFixed(2)} / kg</span>
                        </p>
                        <p className="text-xs text-slate-400 flex justify-between">
                          <span>Estimated APR:</span> <span className="text-white">{pool.account.apr ? (pool.account.apr / 100).toFixed(1) : "0.0"}%</span>
                        </p>
                        <p className="text-xs text-slate-400 flex justify-between">
                          <span>Region:</span> <span className="text-white">{pool.account.region || "Unknown"}</span>
                        </p>
                        <p className="text-xs text-slate-400 flex justify-between mt-2 pt-2 border-t border-slate-700/50">
                          <span>Funded:</span> <span className="text-teal-400">${(pool.account.totalFundedUsdc.toNumber() / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </p>
                      </div>

                      {isFullyFunded && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">Time-Locked Drawdown</span>
                            {isFarming && (
                              <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                Vested: {Math.round(vestedPercentage * 100)}%
                              </span>
                            )}
                          </div>
                          
                          {isFarming && (
                            <>
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Elapsed: {elapsed}s / {vestingDuration}s</span>
                                <span>${(amountWithdrawn / 1_000_000).toFixed(2)} drawn</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                <div 
                                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-300"
                                  style={{ width: `${vestedPercentage * 100}%` }}
                                />
                              </div>
                            </>
                          )}

                          <div className="flex justify-between items-center gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/30">
                            <div>
                              <p className="text-[10px] text-slate-500">Available to Draw</p>
                              <p className="text-sm font-extrabold text-emerald-400">
                                ${(availableToWithdraw / 1_000_000).toFixed(2)}
                              </p>
                            </div>
                            
                            <button
                              onClick={() => handleWithdraw(pool.publicKey, availableToWithdraw)}
                              disabled={!!isWithdrawingMap[pool.publicKey.toBase58()] || (isFarming && availableToWithdraw <= 0)}
                              className="shrink-0 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 px-3 py-2 text-xs font-bold text-white shadow hover:from-amber-500 hover:to-yellow-400 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              {isWithdrawingMap[pool.publicKey.toBase58()]
                                ? '⏳ Sending...'
                                : isOpen
                                ? '⚡ Start Farming'
                                : `Draw $${(availableToWithdraw / 1_000_000).toFixed(2)}`}
                            </button>
                          </div>

                          {isFarming && (
                            <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Settle Crop Yield / Oracle Simulator</label>
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[11px]">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Settlement amount"
                                      value={repaymentAmounts[pool.publicKey.toBase58()] || ""}
                                      onChange={e => setRepaymentAmounts(prev => ({ ...prev, [pool.publicKey.toBase58()]: e.target.value }))}
                                      className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-1.5 pl-6 pr-2 text-xs text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleSettle(pool.publicKey)}
                                    disabled={
                                      !!isSettlingMap[pool.publicKey.toBase58()] || 
                                      !repaymentAmounts[pool.publicKey.toBase58()] ||
                                      (isFarming && amountWithdrawn < totalFunded)
                                    }
                                    className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-2 text-xs font-bold text-white shadow hover:from-blue-500 hover:to-indigo-400 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                  >
                                    {isSettlingMap[pool.publicKey.toBase58()] ? '⏳' : '🤝 Settle'}
                                  </button>
                                </div>
                                {isFarming && amountWithdrawn < totalFunded && (
                                  <p className="text-[10px] text-yellow-500/80 italic mt-0.5">
                                    ⚠️ Settlement is locked until all capital has been drawn down.
                                  </p>
                                )}
                                <button
                                  onClick={() => handleTriggerDefault(pool.publicKey)}
                                  disabled={!!isDefaultingMap[pool.publicKey.toBase58()]}
                                  className="w-full rounded-lg bg-gradient-to-r from-red-700 to-rose-600 px-3 py-2 text-xs font-bold text-white shadow hover:from-red-600 hover:to-rose-500 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  {isDefaultingMap[pool.publicKey.toBase58()] ? '⏳ Simulating Drought...' : '🚨 Simulate Drought (Trigger Insurance)'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {myPools.length === 0 && !isHydrating && (
                  <div className="col-span-full rounded-xl border border-slate-700/50 border-dashed p-6 text-center text-sm text-slate-500">
                    You haven't initialized any pools yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: 2/5 width */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 backdrop-blur-sm">
              <h2 className="text-sm font-bold text-white mb-4">Protocol Statistics</h2>
              <div className="space-y-3">
                {[
                  { label: 'Admin Pools', value: myPools.length.toString() },
                  { label: 'Total Value Target', value: `$${myPools.reduce((acc, pool) => acc + (pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber() / 1_000_000), 0).toLocaleString()}` },
                  { label: 'Currently Funded', value: `$${myPools.reduce((acc, pool) => acc + (pool.account.totalFundedUsdc.toNumber() / 1_000_000), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2.5">
                    <span className="text-xs text-slate-500">{s.label}</span>
                    <span className="text-sm font-bold text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {txLogs.length > 0 && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white">Transaction Log</h2>
                  <button
                    onClick={() => setTxLogs([])}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
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
