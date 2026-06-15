import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SolanaProvider from '@/components/SolanaProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AgriFund — Agri-Fi Yield Tokenization Protocol',
  description: 'Tokenize agricultural yield on Solana. Connect verified farming estates with institutional investors through transparent, on-chain USDC funding pools.',
  keywords: ['Solana', 'DeFi', 'Agriculture', 'Yield', 'Tokenization', 'Web3', 'RWA'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
