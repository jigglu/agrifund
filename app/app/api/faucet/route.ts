import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';
import fs from 'fs';

const AGRIUSD_MINT = new PublicKey('G7q4wCAJ422kER19HKbDJ23vSJ3nzcJ1FnZG3yGgwnnL');
const WALLET_PATH = '/Users/sachinjha/.config/solana/id.json';

export async function POST(req: NextRequest) {
  try {
    const { publicKey: userAddressStr } = await req.json();
    if (!userAddressStr) {
      return NextResponse.json({ error: 'Public key is required' }, { status: 400 });
    }

    const userPublicKey = new PublicKey(userAddressStr);

    // 1. Initialize Connection
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // 2. Load Mint Authority Keypair
    if (!fs.existsSync(WALLET_PATH)) {
      return NextResponse.json({ error: 'Mint authority keypair not found on server' }, { status: 500 });
    }
    const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    const mintAuthority = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    // 3. Request SOL airdrop (0.1 SOL)
    let solSig = '';
    try {
      solSig = await connection.requestAirdrop(userPublicKey, 0.1 * LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: solSig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });
    } catch (airdropErr) {
      console.warn('Airdrop failed or rate limited, skipping SOL airdrop:', airdropErr);
    }

    // 4. Check/Create ATA for AgriUSD
    const userAta = await getAssociatedTokenAddress(AGRIUSD_MINT, userPublicKey);
    const tx = new Transaction();
    
    const userAtaInfo = await connection.getAccountInfo(userAta);
    if (!userAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          mintAuthority.publicKey, // payer
          userAta,
          userPublicKey,
          AGRIUSD_MINT
        )
      );
    }

    // 5. Mint 1,000 AgriUSD ($1,000.00 = 1,000_000_000 micro-USDC)
    tx.add(
      createMintToInstruction(
        AGRIUSD_MINT,
        userAta,
        mintAuthority.publicKey,
        1_000_000_000
      )
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = mintAuthority.publicKey;

    tx.sign(mintAuthority);

    const serializedTx = tx.serialize();
    const tokenSig = await connection.sendRawTransaction(serializedTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    await connection.confirmTransaction({
      signature: tokenSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });

    return NextResponse.json({
      success: true,
      solSig,
      tokenSig,
      message: 'Successfully minted 1,000 AgriUSD and requested 0.1 SOL!'
    });

  } catch (error: any) {
    console.error('Faucet Error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
