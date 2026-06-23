'use client';

import { useState, useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useAgriFund, type OnChainPool } from '@/hooks/useAgriFund';
import Link from 'next/link';

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

const getStatusLabelAndColor = (status: any) => {
  if (!status) return { label: '● Pool Open', style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
  if (status.open !== undefined) return { label: '● Pool Open', style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
  if (status.farming !== undefined) return { label: '🌾 Farming', style: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' };
  if (status.settled !== undefined) return { label: '✅ Settled', style: 'bg-teal-500/10 border-teal-500/30 text-teal-400' };
  if (status.defaulted !== undefined) return { label: '⚠️ Defaulted', style: 'bg-red-500/10 border-red-500/30 text-red-400' };
  return { label: 'Unknown', style: 'bg-slate-500/10 border-slate-500/30 text-slate-400' };
};

const deriveGoal = (pool: OnChainPool) =>
  pool.account.totalYieldKg.toNumber() * pool.account.pricePerKg.toNumber();

const pct = (funded: number, goal: number) =>
  goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;

const toUsdc = (microUsdc: number) => microUsdc / 1_000_000;

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
    if (!connection || !publicKey || !isReady) {
      setMyInvestments([]);
      return;
    }
    setIsFetching(true);
    try {
      const livePools = await fetchAllPools();
      const response = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const balancesMap = new Map<string, number>();
      for (const accountInfo of response.value) {
        const parsedInfo = accountInfo.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount ?? 0;
        if (balance > 0) {
          balancesMap.set(mint, balance);
        }
      }

      const investmentsList: Investment[] = [];
      for (const pool of livePools) {
        const receiptMintStr = pool.account.receiptMint.toBase58();
        if (balancesMap.has(receiptMintStr)) {
          const balance = balancesMap.get(receiptMintStr)!;
          const meta = getPoolMeta(pool);
          investmentsList.push({ pool, balance, meta });
        }
      }
      setMyInvestments(investmentsList);
    } catch (e) {
      console.error("Error fetching investments:", e);
    } finally {
      setIsFetching(false);
    }
  }, [connection, publicKey, isReady, fetchAllPools]);

  useEffect(() => {
    fetchMyInvestments();
  }, [fetchMyInvestments]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="mb-8 border-b border-slate-800/60 pb-6">
        <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl flex items-center gap-3">
          <span>💼</span> My Investments
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Track and manage your tokenized real-world agriculture positions.
        </p>
      </div>

      {/* Connection Guard */}
      {!connected && (
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-10 text-center backdrop-blur-sm max-w-xl mx-auto my-12">
          <span className="text-4xl mb-4 block">🔌</span>
          <h3 className="font-bold text-white text-base mb-2">Wallet Disconnected</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Connect your wallet using the button in the top navigation bar to view your active agriculture investments and yield payouts.
          </p>
        </div>
      )}

      {/* Connected & Fetching */}
      {connected && isFetching && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40 p-5 h-48" />
          ))}
        </div>
      )}

      {/* Connected & No investments */}
      {connected && !isFetching && myInvestments.length === 0 && (
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/10 p-12 text-center backdrop-blur-sm max-w-xl mx-auto my-12">
          <span className="text-4xl mb-4 block">🌾</span>
          <h3 className="font-bold text-white text-base mb-2">You've no active investments</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            You don't hold any tokenized crop receipts yet. Support local farmers and earn competitive yields by funding active agricultural pools.
          </p>
          <Link
            href="/dashboard/investor"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-400 transition-all"
          >
            📊 Visit Investor Market
          </Link>
        </div>
      )}

      {/* Connected & Has investments */}
      {connected && !isFetching && myInvestments.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {myInvestments.map(({ pool, balance, meta }) => {
            const goalMicro   = deriveGoal(pool);
            const fundedMicro = pool.account.totalFundedUsdc.toNumber();
            const percentage  = pct(fundedMicro, goalMicro);
            const fundedUsd    = toUsdc(fundedMicro);
            const goalUsd      = toUsdc(goalMicro);
            const { label, style } = getStatusLabelAndColor(pool.account.status);

            return (
              <div 
                key={pool.publicKey.toBase58()}
                className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-slate-950/70 p-6 backdrop-blur-xl hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/5 shadow-md shadow-[#010408]/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Header Section */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/50 text-2xl shadow-inner">
                        {meta.avatar}
                      </span>
                      <div className="min-w-0 flex-1">
                        {/* Estate Name: max 2 lines, truncated, with title tooltip */}
                        <h3 
                          className="font-bold text-white text-sm line-clamp-2 break-words leading-snug cursor-help"
                          title={pool.account.estateName}
                        >
                          {pool.account.estateName}
                        </h3>
                        {/* Subtitle: Crop Name + Category */}
                        <p className="text-[11px] text-slate-400 mt-1 font-medium tracking-wide">
                          🌾 {meta.crop} · <span className="text-slate-500">{meta.category}</span>
                        </p>
                      </div>
                    </div>
                    {/* Status Badge */}
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0 shadow-sm ${style}`}>
                      {label}
                    </span>
                  </div>

                  {/* Divider Line */}
                  <div className="border-t border-slate-800/60 my-4" />

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2.5 mb-5 text-center">
                    {/* Column 1: Receipt Tokens */}
                    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5 flex flex-col justify-between min-w-0">
                      <p className="text-sm font-extrabold text-emerald-400 truncate">
                        {balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase tracking-wider">
                        tokens held
                      </p>
                    </div>
                    
                    {/* Column 2: Est. APR */}
                    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5 flex flex-col justify-between min-w-0">
                      <p className="text-sm font-extrabold text-white truncate">
                        {meta.apr}
                      </p>
                      <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase tracking-wider">
                        exp. return
                      </p>
                    </div>

                    {/* Column 3: Location / Region */}
                    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2.5 flex flex-col justify-between min-w-0">
                      <p className="text-xs font-bold text-slate-300 truncate" title={meta.region}>
                        {meta.region}
                      </p>
                      <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase tracking-wider">
                        location
                      </p>
                    </div>
                  </div>

                  {/* Divider Line */}
                  <div className="border-t border-slate-800/60 my-4" />

                  {/* Funding Progress Section */}
                  <div className="mb-6">
                    <div className="flex justify-between text-[11px] font-medium mb-1.5">
                      <span className="text-emerald-400">
                        Funded: <span className="font-bold">${fundedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </span>
                      <span className="text-slate-500">
                        Goal: <span className="font-bold">${goalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </span>
                    </div>
                    <div className="h-5 rounded-full bg-slate-800/80 p-0.5 overflow-hidden border border-slate-700/30 flex items-center">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-teal-600 transition-all duration-500 flex items-center justify-end pr-2 min-w-[20px]"
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage >= 15 && (
                          <span className="text-[9px] font-black text-slate-950 uppercase tracking-widest leading-none">
                            {percentage.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {percentage < 15 && (
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          {percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Manage CTA Action Button */}
                <Link
                  href={`/dashboard/investor?pool=${pool.publicKey.toBase58()}`}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/10 py-3 text-xs font-bold text-emerald-400 shadow-sm hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-950/20 active:scale-[0.98] transition-all duration-200"
                >
                  ⚙️ Manage & Claim
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
