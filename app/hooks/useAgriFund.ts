'use client';

import { useMemo, useCallback } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import {
  Program,
  AnchorProvider,
  BN,
  setProvider,
  Idl,
} from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import IDL from '@/lib/agrifund.json';

// Our custom devnet SPL token used to simulate USDC
export const AGRIUSD_MINT = new PublicKey('G7q4wCAJ422kER19HKbDJ23vSJ3nzcJ1FnZG3yGgwnnL');

// ── Type helpers derived from the IDL ─────────────────────────────────────

/** Camel-cased account data as Anchor deserialises it from the IDL. */
export interface YieldPoolAccount {
  authority: PublicKey;
  estateName: string;
  cropName: string;
  category: string;
  vaultBump: number;
  totalYieldKg: BN;
  pricePerKg: BN;
  totalFundedUsdc: BN;
  isActive: boolean;
  status: { open?: {}; farming?: {}; settled?: {}; defaulted?: {} };
  farmingStartTime: BN;
  amountWithdrawn: BN;
  receiptMint: PublicKey;
}

/** A single entry returned by program.account.yieldPool.all() */
export interface OnChainPool {
  publicKey: PublicKey;
  account: YieldPoolAccount;
}

export interface InitPoolResult {
  txSig: string;
  poolAddress: PublicKey;
}

export interface FundYieldResult {
  txSig: string;
}

// ── The hook ──────────────────────────────────────────────────────────────
export function useAgriFund() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  /**
   * Memoized Anchor Program instance.
   * Returns null when no wallet is connected (SSR / pre-connect safe).
   */
  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    setProvider(provider);

    return new Program(IDL as Idl, provider);
  }, [connection, wallet]);

  /**
   * initialize_pool — create a new on-chain YieldPool.
   *
   * @param cropName   Name of the crop
   * @param yieldKg    Total yield in kilograms (plain integer)
   * @param priceUsdc  Price per kg in micro-USDC (plain integer, 1 USDC = 1_000_000)
   * @returns          { txSig, poolAddress } on success
   */
  const initializePool = useCallback(
    async (estateName: string, cropName: string, category: string, yieldKg: number, priceUsdc: number): Promise<InitPoolResult> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const poolKeypair = Keypair.generate();
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), poolKeypair.publicKey.toBuffer()],
        program.programId
      );
      const [receiptMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('receipt_mint'), poolKeypair.publicKey.toBuffer()],
        program.programId
      );

      const txSig = await (program.methods as any)
        .initializePool(estateName, cropName, category, new BN(yieldKg), new BN(priceUsdc))
        .accounts({
          yieldPool: poolKeypair.publicKey,
          poolTokenVault: vaultPda,
          receiptMint: receiptMintPda,
          tokenMint: AGRIUSD_MINT,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([poolKeypair])
        .rpc();

      return { txSig, poolAddress: poolKeypair.publicKey };
    },
    [program, wallet]
  );

  /**
   * fund_yield — add USDC to an existing pool.
   *
   * @param targetPoolAddress  The pool's on-chain PublicKey
   * @param amountUsdc         Amount in micro-USDC (plain integer)
   * @returns                  { txSig } on success
   */
  const fundYield = useCallback(
    async (
      targetPoolAddress: PublicKey,
      amountUsdc: number
    ): Promise<FundYieldResult> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const investorAta = await getAssociatedTokenAddress(AGRIUSD_MINT, wallet.publicKey);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), targetPoolAddress.toBuffer()],
        program.programId
      );
      const [receiptMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('receipt_mint'), targetPoolAddress.toBuffer()],
        program.programId
      );

      const investorReceiptAta = await getAssociatedTokenAddress(receiptMintPda, wallet.publicKey);

      const instructions = [];
      const ataInfo = await connection.getAccountInfo(investorReceiptAta);
      if (!ataInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            investorReceiptAta,
            wallet.publicKey,
            receiptMintPda
          )
        );
      }

      const tx = (program.methods as any)
        .fundYield(new BN(amountUsdc))
        .accounts({
          yieldPool: targetPoolAddress,
          investorTokenAccount: investorAta,
          poolTokenVault: vaultPda,
          receiptMint: receiptMintPda,
          investorReceiptAccount: investorReceiptAta,
          funder: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        });

      if (instructions.length > 0) {
        tx.preInstructions(instructions);
      }

      const txSig = await tx.rpc();

      return { txSig };
    },
    [program, wallet, connection]
  );

  /**
   * withdrawCapital — withdraw vested capital from a yield pool.
   *
   * @param targetPoolAddress  The pool's on-chain PublicKey
   * @param amountUsdc         Amount in micro-USDC (plain integer)
   * @returns                  { txSig } on success
   */
  const withdrawCapital = useCallback(
    async (
      targetPoolAddress: PublicKey,
      amountUsdc: number
    ): Promise<{ txSig: string }> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const estateAta = await getAssociatedTokenAddress(AGRIUSD_MINT, wallet.publicKey);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), targetPoolAddress.toBuffer()],
        program.programId
      );

      const txSig = await (program.methods as any)
        .withdrawCapital(new BN(amountUsdc))
        .accounts({
          pool: targetPoolAddress,
          authority: wallet.publicKey,
          poolTokenVault: vaultPda,
          estateTokenAccount: estateAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      return { txSig };
    },
    [program, wallet]
  );

  /**
   * settlePool — settle pool by depositing yield/repayment amount.
   */
  const settlePool = useCallback(
    async (
      targetPoolAddress: PublicKey,
      repaymentAmountUsdc: number
    ): Promise<{ txSig: string }> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const estateAta = await getAssociatedTokenAddress(AGRIUSD_MINT, wallet.publicKey);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), targetPoolAddress.toBuffer()],
        program.programId
      );

      const txSig = await (program.methods as any)
        .settlePool(new BN(repaymentAmountUsdc))
        .accounts({
          pool: targetPoolAddress,
          authority: wallet.publicKey,
          poolTokenVault: vaultPda,
          estateTokenAccount: estateAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { txSig };
    },
    [program, wallet]
  );

  /**
   * claimYield — claim proportional yield from settled pool.
   */
  const claimYield = useCallback(
    async (
      targetPoolAddress: PublicKey
    ): Promise<{ txSig: string }> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const investorAta = await getAssociatedTokenAddress(AGRIUSD_MINT, wallet.publicKey);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), targetPoolAddress.toBuffer()],
        program.programId
      );
      const [receiptMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('receipt_mint'), targetPoolAddress.toBuffer()],
        program.programId
      );
      const investorReceiptAta = await getAssociatedTokenAddress(receiptMintPda, wallet.publicKey);

      const txSig = await (program.methods as any)
        .claimYield()
        .accounts({
          pool: targetPoolAddress,
          investor: wallet.publicKey,
          investorReceiptAccount: investorReceiptAta,
          receiptMint: receiptMintPda,
          poolTokenVault: vaultPda,
          investorTokenAccount: investorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { txSig };
    },
    [program, wallet]
  );

  /**
   * triggerDefault — simulate weather oracle drought trigger.
   */
  const triggerDefault = useCallback(
    async (
      targetPoolAddress: PublicKey
    ): Promise<{ txSig: string }> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const txSig = await (program.methods as any)
        .triggerDefault()
        .accounts({
          pool: targetPoolAddress,
          authority: wallet.publicKey,
        })
        .rpc();

      return { txSig };
    },
    [program, wallet]
  );

  /**
   * refundInvestment — process an early refund of USDC before farming starts.
   */
  const refundInvestment = useCallback(
    async (
      targetPoolAddress: PublicKey,
      refundAmountUsdc: number
    ): Promise<{ txSig: string }> => {
      if (!program || !wallet) {
        throw new Error('Wallet not connected');
      }

      const investorAta = await getAssociatedTokenAddress(AGRIUSD_MINT, wallet.publicKey);
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), targetPoolAddress.toBuffer()],
        program.programId
      );
      const [receiptMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('receipt_mint'), targetPoolAddress.toBuffer()],
        program.programId
      );
      const investorReceiptAta = await getAssociatedTokenAddress(receiptMintPda, wallet.publicKey);

      const txSig = await (program.methods as any)
        .refundInvestment(new BN(refundAmountUsdc))
        .accounts({
          pool: targetPoolAddress,
          investor: wallet.publicKey,
          investorReceiptAccount: investorReceiptAta,
          receiptMint: receiptMintPda,
          poolTokenVault: vaultPda,
          investorTokenAccount: investorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { txSig };
    },
    [program, wallet]
  );

  /**
   * fetchPool — read current on-chain state for a single pool address.
   */
  const fetchPool = useCallback(
    async (poolAddress: PublicKey): Promise<YieldPoolAccount> => {
      if (!program) throw new Error('Wallet not connected');
      const raw = await (program.account as any).yieldPool.fetch(poolAddress);
      return raw as YieldPoolAccount;
    },
    [program]
  );

  /**
   * fetchMyPools — fetch all on-chain YieldPool accounts owned by the
   * currently connected wallet.  Returns an array of pool PublicKeys.
   */
  const fetchMyPools = useCallback(
    async (): Promise<PublicKey[]> => {
      if (!program || !wallet) return [];
      try {
        const allPools = await (program.account as any).yieldPool.all();
        return allPools
          .filter((p: { account: { authority: PublicKey } }) =>
            p.account.authority.toBase58() === wallet.publicKey.toBase58()
          )
          .map((p: { publicKey: PublicKey }) => p.publicKey as PublicKey);
      } catch {
        return [];
      }
    },
    [program, wallet]
  );

  /**
   * fetchAllPools — fetch every YieldPool account on-chain.
   * Returns a typed array of { publicKey, account } entries.
   * Caller does not need a connected wallet (read-only query).
   */
  const fetchAllPools = useCallback(
    async (): Promise<OnChainPool[]> => {
      if (!program) return [];
      try {
        const raw = await (program.account as any).yieldPool.all();
        return raw as OnChainPool[];
      } catch {
        return [];
      }
    },
    [program]
  );

  return {
    program,
    isReady: !!program,
    initializePool,
    fundYield,
    withdrawCapital,
    settlePool,
    claimYield,
    triggerDefault,
    refundInvestment,
    fetchPool,
    fetchMyPools,
    fetchAllPools,
  };
}
