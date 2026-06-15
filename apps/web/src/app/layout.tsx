import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Cognitia — Revenue Operator',
  description:
    'Governed revenue-operator console: runs, approvals, meetings, audit. Human approval gates every side effect.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
