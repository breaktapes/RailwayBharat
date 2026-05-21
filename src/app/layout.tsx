import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { BottomNav } from '@/components/layout/BottomNav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RailwayBharat — Live Indian Railways Tracker',
  description: 'Track every Indian Railways train in real time. Live map, delay alerts, journey passport. Open source.',
  keywords: 'Indian Railways, live train tracking, train status, NTES, delay',
  openGraph: {
    title: 'RailwayBharat',
    description: 'Every train in India, live.',
    siteName: 'RailwayBharat',
    type: 'website',
  },
  manifest: '/manifest.json',
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#0d0d1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }} />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <QueryProvider>
          <main className="flex-1 relative overflow-hidden pb-nav">
            {children}
          </main>
          <BottomNav />
        </QueryProvider>
      </body>
    </html>
  );
}
