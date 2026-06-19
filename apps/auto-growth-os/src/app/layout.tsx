import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { AppStateProvider } from '@/lib/store/AppStateProvider';
import { WatermarkBackground } from '@/components/brand/WatermarkBackground';
import { BrandHeader } from '@/components/brand/BrandHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

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
    default: 'Cognitia Auto Growth OS',
    template: '%s · Cognitia Auto Growth OS',
  },
  description:
    'The dealership growth operating system — a fast website, client intake, lead capture and routing, a CRM command center, and compliant AI workflows.',
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
          <BrandHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AppStateProvider>
      </body>
    </html>
  );
}
