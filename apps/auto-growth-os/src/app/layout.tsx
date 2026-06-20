import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { AppStateProvider } from '@/lib/store/AppStateProvider';
import { WatermarkBackground } from '@/components/brand/WatermarkBackground';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Demandara Dealership Growth OS',
    template: '%s · Demandara Dealership Growth OS',
  },
  description:
    'Demandara Dealership Growth OS, powered by Cognitia — a public dealership website, client intake, CRM-lite, human-approved AI workflows, and a proof/action ledger.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <AppStateProvider>
          <WatermarkBackground />
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
