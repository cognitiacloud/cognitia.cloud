// app/api/leads/route.ts
// Demo facade for the lead store. In production this is the seam where a real
// CRM/DMS adapter (lib/adapters/crm.ts) would read/write persistent leads.

import { NextResponse } from 'next/server';
import type { Lead } from '@/types';
import leadsRaw from '@/data/leads.json';

const SEED = leadsRaw as Lead[];

export function GET() {
  return NextResponse.json({
    simulated: true,
    source: 'seed',
    count: SEED.length,
    leads: SEED,
  });
}
