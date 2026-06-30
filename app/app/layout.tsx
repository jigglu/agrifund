import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import SolanaProvider from '@/components/SolanaProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AgriFund — Real-World Asset Protocol on Solana',
  description:
    'Tokenize agricultural yield on Solana. KYC-verified farming estates. USDC settlement in 400ms. Parametric crop insurance — fully on-chain.',
  keywords: ['Solana', 'DeFi', 'Agriculture', 'Yield', 'Tokenization', 'Web3', 'RWA', 'AgriFund'],
  openGraph: {
    title: 'AgriFund — Tokenized Agricultural Yield. On-Chain.',
    description: 'KYC-verified farming estates. USDC settlement in 400ms. Parametric crop insurance — fully on-chain.',
    type: 'website',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={inter.className}>
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
