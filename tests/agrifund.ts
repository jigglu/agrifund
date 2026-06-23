import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Agrifund } from "../target/types/agrifund";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { expect } from "chai";

describe("agrifund", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agrifund as Program<Agrifund>;
  const connection = provider.connection;

  // The custom Devnet SPL token used to simulate USDC (cloned locally)
  const AGRIUSD_MINT = new PublicKey("G7q4wCAJ422kER19HKbDJ23vSJ3nzcJ1FnZG3yGgwnnL");
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  // Keypairs for actors
  const estateAuthority = (provider.wallet as anchor.Wallet).payer; // Mint Authority for AGRIUSD_MINT
  const investorKeypair = Keypair.generate();
  
  // Pool keypairs
  const poolKeypair = Keypair.generate();
  const secondPoolKeypair = Keypair.generate();

  // ATAs
  let investorUsdcAta: PublicKey;
  let estateUsdcAta: PublicKey;

  // PDAs
  let poolVaultPda: PublicKey;
  let poolReceiptMintPda: PublicKey;
  let investorReceiptAta: PublicKey;
  let oraclePda: PublicKey;

  before(async () => {
    // 1. Airdrop SOL to investor
    const airdropSig = await connection.requestAirdrop(
      investorKeypair.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    // Wait for transaction confirmation
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSig,
    });

    // 2. Derive/Create ATAs for USDC
    investorUsdcAta = await getAssociatedTokenAddress(AGRIUSD_MINT, investorKeypair.publicKey);
    estateUsdcAta = await getAssociatedTokenAddress(AGRIUSD_MINT, estateAuthority.publicKey);

    const tx = new anchor.web3.Transaction();

    // Create Investor ATA if it doesn't exist
    const investorUsdcAtaInfo = await connection.getAccountInfo(investorUsdcAta);
    if (!investorUsdcAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          estateAuthority.publicKey,
          investorUsdcAta,
          investorKeypair.publicKey,
          AGRIUSD_MINT
        )
      );
    }

    // Create Estate ATA if it doesn't exist
    const estateUsdcAtaInfo = await connection.getAccountInfo(estateUsdcAta);
    if (!estateUsdcAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          estateAuthority.publicKey,
          estateUsdcAta,
          estateAuthority.publicKey,
          AGRIUSD_MINT
        )
      );
    }

    // 3. Mint some mock USDC to investor (10,000 USDC = 10,000_000_000 micro-USDC)
    // Since estateAuthority is the mint authority for G7q4wCAJ422kER19HKbDJ23vSJ3nzcJ1FnZG3yGgwnnL, they sign this
    tx.add(
      createMintToInstruction(
        AGRIUSD_MINT,
        investorUsdcAta,
        estateAuthority.publicKey,
        10_000_000_000
      )
    );

    // Mint some mock USDC to estateAuthority (for testing settlement repayments)
    tx.add(
      createMintToInstruction(
        AGRIUSD_MINT,
        estateUsdcAta,
        estateAuthority.publicKey,
        10_000_000_000
      )
    );

    await provider.sendAndConfirm(tx, [estateAuthority]);

    // 4. Derive and initialize Oracle PDA
    const [derivedOraclePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle")],
      program.programId
    );
    oraclePda = derivedOraclePda;

    const oracleAccount = await connection.getAccountInfo(oraclePda);
    if (!oracleAccount) {
      await program.methods
        .initializeOracle()
        .accounts({
          oracle: oraclePda,
          authority: estateAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([estateAuthority])
        .rpc();
    } else {
      console.log("Oracle PDA already exists on-chain, skipping initialization.");
    }
  });

  it("Initializes a yield pool successfully", async () => {
    // Derive PDAs
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), poolKeypair.publicKey.toBuffer()],
      program.programId
    );
    const [receiptMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt_mint"), poolKeypair.publicKey.toBuffer()],
      program.programId
    );
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        receiptMintPda.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    poolVaultPda = vaultPda;
    poolReceiptMintPda = receiptMintPda;

    const estateName = "Mendez Agro Holdings";
    const cropName = "Basmati Rice";
    const category = "Grains";
    const totalYieldKg = new anchor.BN(1000); // 1000 kg
    const pricePerKg = new anchor.BN(1_000_000); // $1.00 per kg (in micro-USDC)

    const vestingDuration = new anchor.BN(180); // 180 seconds
    const apr = 1240; // 12.4%
    const region = "Punjab, India";

    const txSig = await program.methods
      .initializePool(estateName, cropName, category, totalYieldKg, pricePerKg, vestingDuration, apr, region)
      .accounts({
        yieldPool: poolKeypair.publicKey,
        poolTokenVault: poolVaultPda,
        receiptMint: poolReceiptMintPda,
        tokenMint: AGRIUSD_MINT,
        metadata: metadataPda,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        authority: estateAuthority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([poolKeypair, estateAuthority])
      .rpc();

    let txDetails = null;
    for (let i = 0; i < 10; i++) {
      txDetails = await connection.getTransaction(txSig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (txDetails) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const eventParser = new anchor.EventParser(program.programId, program.coder);
    const events = Array.from(eventParser.parseLogs(txDetails.meta.logMessages));
    expect(events.length).to.equal(1);
    const initializedEvent: any = events[0].data;

    expect(initializedEvent.pool.toBase58()).to.equal(poolKeypair.publicKey.toBase58());
    expect(initializedEvent.authority.toBase58()).to.equal(estateAuthority.publicKey.toBase58());
    expect(initializedEvent.estateName).to.equal(estateName);
    expect(initializedEvent.cropName).to.equal(cropName);
    expect(initializedEvent.category).to.equal(category);
    expect(initializedEvent.totalYieldKg.toString()).to.equal(totalYieldKg.toString());
    expect(initializedEvent.pricePerKg.toString()).to.equal(pricePerKg.toString());
    expect(initializedEvent.vestingDuration.toString()).to.equal(vestingDuration.toString());
    expect(initializedEvent.apr).to.equal(apr);
    expect(initializedEvent.region).to.equal(region);

    // Fetch account state and assert
    const poolState = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolState.estateName).to.equal(estateName);
    expect(poolState.cropName).to.equal(cropName);
    expect(poolState.category).to.equal(category);
    expect(poolState.totalYieldKg.toString()).to.equal(totalYieldKg.toString());
    expect(poolState.pricePerKg.toString()).to.equal(pricePerKg.toString());
    expect(poolState.totalFundedUsdc.toNumber()).to.equal(0);
    expect(poolState.isActive).to.be.true;
    expect(poolState.status).to.have.property("open");
    expect(poolState.vestingDuration.toNumber()).to.equal(180);
    expect(poolState.apr).to.equal(apr);
    expect(poolState.region).to.equal(region);

    // Verify Metaplex Metadata account exists
    const metadataAccountInfo = await connection.getAccountInfo(metadataPda);
    expect(metadataAccountInfo).to.not.be.null;
  });

  it("Funds the yield pool (partial funding)", async () => {
    investorReceiptAta = await getAssociatedTokenAddress(poolReceiptMintPda, investorKeypair.publicKey);

    // Create Investor Receipt ATA before funding
    const createAtaTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        investorKeypair.publicKey,
        investorReceiptAta,
        investorKeypair.publicKey,
        poolReceiptMintPda
      )
    );
    await provider.sendAndConfirm(createAtaTx, [investorKeypair]);

    const fundAmount = new anchor.BN(400_000_000); // $400.00

    const txSig = await program.methods
      .fundYield(fundAmount)
      .accounts({
        yieldPool: poolKeypair.publicKey,
        investorTokenAccount: investorUsdcAta,
        poolTokenVault: poolVaultPda,
        receiptMint: poolReceiptMintPda,
        investorReceiptAccount: investorReceiptAta,
        funder: investorKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investorKeypair])
      .rpc();

    let txDetails = null;
    for (let i = 0; i < 10; i++) {
      txDetails = await connection.getTransaction(txSig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (txDetails) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const eventParser = new anchor.EventParser(program.programId, program.coder);
    const events = Array.from(eventParser.parseLogs(txDetails.meta.logMessages));
    expect(events.length).to.equal(1);
    const fundedEvent: any = events[0].data;

    expect(fundedEvent.pool.toBase58()).to.equal(poolKeypair.publicKey.toBase58());
    expect(fundedEvent.investor.toBase58()).to.equal(investorKeypair.publicKey.toBase58());
    expect(fundedEvent.amountUsdc.toString()).to.equal(fundAmount.toString());

    // Assert states
    const poolState = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolState.totalFundedUsdc.toString()).to.equal(fundAmount.toString());

    const vaultBalance = await connection.getTokenAccountBalance(poolVaultPda);
    expect(vaultBalance.value.amount).to.equal(fundAmount.toString());

    const receiptBalance = await connection.getTokenAccountBalance(investorReceiptAta);
    expect(receiptBalance.value.amount).to.equal(fundAmount.toString());
  });

  it("Performs early refund before farming", async () => {
    const refundAmount = new anchor.BN(100_000_000); // $100.00

    const initialInvestorUsdc = (await connection.getTokenAccountBalance(investorUsdcAta)).value.uiAmount || 0;

    await program.methods
      .refundInvestment(refundAmount)
      .accounts({
        pool: poolKeypair.publicKey,
        investor: investorKeypair.publicKey,
        investorReceiptAccount: investorReceiptAta,
        receiptMint: poolReceiptMintPda,
        poolTokenVault: poolVaultPda,
        investorTokenAccount: investorUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investorKeypair])
      .rpc();

    // Verify balances
    const poolState = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolState.totalFundedUsdc.toNumber()).to.equal(300_000_000); // $300.00 remaining

    const vaultBalance = await connection.getTokenAccountBalance(poolVaultPda);
    expect(vaultBalance.value.amount).to.equal("300000000");

    const receiptBalance = await connection.getTokenAccountBalance(investorReceiptAta);
    expect(receiptBalance.value.amount).to.equal("300000000");

    const finalInvestorUsdc = (await connection.getTokenAccountBalance(investorUsdcAta)).value.uiAmount || 0;
    expect(finalInvestorUsdc - initialInvestorUsdc).to.be.closeTo(100, 0.01);
  });

  it("Funds the pool completely to meet the goal", async () => {
    const fundAmount = new anchor.BN(700_000_000); // $700.00 to reach $1000.00 total goal

    await program.methods
      .fundYield(fundAmount)
      .accounts({
        yieldPool: poolKeypair.publicKey,
        investorTokenAccount: investorUsdcAta,
        poolTokenVault: poolVaultPda,
        receiptMint: poolReceiptMintPda,
        investorReceiptAccount: investorReceiptAta,
        funder: investorKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investorKeypair])
      .rpc();

    const poolState = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolState.totalFundedUsdc.toNumber()).to.equal(1_000_000_000); // Goal met!
  });

  it("Draws down capital using linear time-locked vesting", async () => {
    // Drawdown amount (e.g. $5.00)
    const withdrawAmount = new anchor.BN(5_000_000);

    // Call withdrawCapital with 0 amount to transition status to Farming and save the clock timestamp
    await program.methods
      .withdrawCapital(new anchor.BN(0))
      .accounts({
        pool: poolKeypair.publicKey,
        authority: estateAuthority.publicKey,
        poolTokenVault: poolVaultPda,
        estateTokenAccount: estateUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([estateAuthority])
      .rpc();

    // Verify it is now in Farming status
    const poolStateAfterInit = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolStateAfterInit.status).to.have.property("farming");
    expect(poolStateAfterInit.isActive).to.be.false;

    // Call second withdraw with >0 amount immediately after. This should fail with VestingLocked.
    try {
      await program.methods
        .withdrawCapital(withdrawAmount)
        .accounts({
          pool: poolKeypair.publicKey,
          authority: estateAuthority.publicKey,
          poolTokenVault: poolVaultPda,
          estateTokenAccount: estateUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([estateAuthority])
        .rpc();
      expect.fail("Withdrawal should have failed due to zero elapsed vesting time");
    } catch (err: any) {
      const errStr = err.error ? err.error.errorCode.code : err.toString();
      expect(errStr).to.contain("VestingLocked");
    }

    // Now, wait 5 seconds to allow some vesting to occur
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Send a dummy transaction to tick the validator slot and clock
    const dummyTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: estateAuthority.publicKey,
        toPubkey: investorKeypair.publicKey,
        lamports: 1000,
      })
    );
    await provider.sendAndConfirm(dummyTx, [estateAuthority]);

    const poolStateBefore = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    console.log("DEBUG - Farming Start Time:", poolStateBefore.farmingStartTime.toNumber());
    console.log("DEBUG - Current Slot:", slot);
    console.log("DEBUG - Current Block Time:", blockTime);
    if (blockTime) {
      console.log("DEBUG - Elapsed Time (seconds):", blockTime - poolStateBefore.farmingStartTime.toNumber());
    }

    await program.methods
      .withdrawCapital(withdrawAmount)
      .accounts({
        pool: poolKeypair.publicKey,
        authority: estateAuthority.publicKey,
        poolTokenVault: poolVaultPda,
        estateTokenAccount: estateUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([estateAuthority])
      .rpc();

    // Verify poolState amount withdrawn
    const poolState = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolState.amountWithdrawn.toNumber()).to.equal(5_000_000);
    expect(poolState.status).to.have.property("farming");
  });

  it("Settles the pool successfully", async () => {
    // Settle pool with principal + crop profits repayment (e.g., $1050 repayment)
    const repaymentAmount = new anchor.BN(1_050_000_000);

    await program.methods
      .settlePool(repaymentAmount)
      .accounts({
        pool: poolKeypair.publicKey,
        authority: estateAuthority.publicKey,
        poolTokenVault: poolVaultPda,
        estateTokenAccount: estateUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([estateAuthority])
      .rpc();

    const poolState = await program.account.yieldPool.fetch(poolKeypair.publicKey);
    expect(poolState.status).to.have.property("settled");
    expect(poolState.isActive).to.be.false;
  });

  it("Claims yield post-settlement and distributes payouts", async () => {
    const initialInvestorUsdc = (await connection.getTokenAccountBalance(investorUsdcAta)).value.uiAmount || 0;

    await program.methods
      .claimYield()
      .accounts({
        pool: poolKeypair.publicKey,
        investor: investorKeypair.publicKey,
        investorReceiptAccount: investorReceiptAta,
        receiptMint: poolReceiptMintPda,
        poolTokenVault: poolVaultPda,
        investorTokenAccount: investorUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investorKeypair])
      .rpc();

    // Balance verification
    const receiptBalance = await connection.getTokenAccountBalance(investorReceiptAta);
    expect(receiptBalance.value.amount).to.equal("0"); // Receipts burned

    const finalInvestorUsdc = (await connection.getTokenAccountBalance(investorUsdcAta)).value.uiAmount || 0;
    // Expected payout = vault balance * receipt balance / total receipts.
    // Total receipts = 1,000,000,000. Investor had 1,000,000,000.
    // Vault balance before claim = 1000 - 5 (withdrawn) + 1050 (repaid) = 2045 USDC.
    // Investor should receive full vault = 2045 USDC.
    expect(finalInvestorUsdc - initialInvestorUsdc).to.be.closeTo(2045, 0.1);
  });

  it("Handles parametric default states", async () => {
    // 1. Initialize a second pool for testing default state
    const [secondVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), secondPoolKeypair.publicKey.toBuffer()],
      program.programId
    );
    const [secondReceiptMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt_mint"), secondPoolKeypair.publicKey.toBuffer()],
      program.programId
    );
    const [secondMetadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        secondReceiptMintPda.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const estateName = "Second Estate";
    const cropName = "Wheat";
    const category = "Grains";
    const totalYieldKg = new anchor.BN(500); // 500 kg
    const pricePerKg = new anchor.BN(1_000_000); // $1.00 per kg -> $500 total goal

    const vestingDuration = new anchor.BN(180); // 180 seconds
    const apr = 1500; // 15.0%
    const region = "Kano, Nigeria";

    await program.methods
      .initializePool(estateName, cropName, category, totalYieldKg, pricePerKg, vestingDuration, apr, region)
      .accounts({
        yieldPool: secondPoolKeypair.publicKey,
        poolTokenVault: secondVaultPda,
        receiptMint: secondReceiptMintPda,
        tokenMint: AGRIUSD_MINT,
        metadata: secondMetadataPda,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        authority: estateAuthority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([secondPoolKeypair, estateAuthority])
      .rpc();

    // Verify Metaplex Metadata account exists
    const secondMetadataAccountInfo = await connection.getAccountInfo(secondMetadataPda);
    expect(secondMetadataAccountInfo).to.not.be.null;

    // 2. Fund the second pool fully ($500)
    const secondInvestorReceiptAta = await getAssociatedTokenAddress(secondReceiptMintPda, investorKeypair.publicKey);
    
    const createAtaTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        investorKeypair.publicKey,
        secondInvestorReceiptAta,
        investorKeypair.publicKey,
        secondReceiptMintPda
      )
    );
    await provider.sendAndConfirm(createAtaTx, [investorKeypair]);

    await program.methods
      .fundYield(new anchor.BN(500_000_000))
      .accounts({
        yieldPool: secondPoolKeypair.publicKey,
        investorTokenAccount: investorUsdcAta,
        poolTokenVault: secondVaultPda,
        receiptMint: secondReceiptMintPda,
        investorReceiptAccount: secondInvestorReceiptAta,
        funder: investorKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investorKeypair])
      .rpc();

    // 3. Move pool to Farming (estate draws down $0 to start timer)
    await program.methods
      .withdrawCapital(new anchor.BN(0))
      .accounts({
        pool: secondPoolKeypair.publicKey,
        authority: estateAuthority.publicKey,
        poolTokenVault: secondVaultPda,
        estateTokenAccount: estateUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([estateAuthority])
      .rpc();

    // Verify it is farming
    let secondState = await program.account.yieldPool.fetch(secondPoolKeypair.publicKey);
    expect(secondState.status).to.have.property("farming");
    expect(secondState.isActive).to.be.false;
    expect(secondState.vestingDuration.toNumber()).to.equal(180);
    expect(secondState.apr).to.equal(1500);
    expect(secondState.region).to.equal("Kano, Nigeria");

    await program.methods
      .triggerDefault()
      .accounts({
        pool: secondPoolKeypair.publicKey,
        oracle: oraclePda,
        authority: estateAuthority.publicKey,
      })
      .signers([estateAuthority])
      .rpc();

    secondState = await program.account.yieldPool.fetch(secondPoolKeypair.publicKey);
    expect(secondState.status).to.have.property("defaulted");
    expect(secondState.isActive).to.be.false;

    // 5. Investor claims remaining yield (all $500 USDC since $0 was drawn down)
    const initialInvestorUsdc = (await connection.getTokenAccountBalance(investorUsdcAta)).value.uiAmount || 0;

    await program.methods
      .claimYield()
      .accounts({
        pool: secondPoolKeypair.publicKey,
        investor: investorKeypair.publicKey,
        investorReceiptAccount: secondInvestorReceiptAta,
        receiptMint: secondReceiptMintPda,
        poolTokenVault: secondVaultPda,
        investorTokenAccount: investorUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investorKeypair])
      .rpc();

    const receiptBalance = await connection.getTokenAccountBalance(secondInvestorReceiptAta);
    expect(receiptBalance.value.amount).to.equal("0");

    const finalInvestorUsdc = (await connection.getTokenAccountBalance(investorUsdcAta)).value.uiAmount || 0;
    expect(finalInvestorUsdc - initialInvestorUsdc).to.be.closeTo(500, 0.1);
  });
});
