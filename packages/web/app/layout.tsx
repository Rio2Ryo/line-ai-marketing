import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LINE AI Marketing',
  description: 'LINE公式アカウント向けAIマーケティングプラットフォーム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
