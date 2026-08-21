import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-brand' });

export const metadata: Metadata = {
  title: 'Lumina POS | Next-Gen Dining',
  description: 'The award-winning multi-tenant QR ordering and KDS platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-brand antialiased overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
