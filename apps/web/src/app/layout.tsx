import type { ReactNode } from 'react';

export const metadata = {
  title: 'Cognitia — Approvals',
  description: 'Human approval console for Cognitia CRM actions (V1: CRM write-back only).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#f6f7f9',
          color: '#111827',
        }}
      >
        {children}
      </body>
    </html>
  );
}
