// app/api/intake/route.ts
// Demo facade: POST intake answers → package recommendation. The UI calls the
// pure recommendPackage() directly for reliability; this route mirrors the shape
// a production backend would expose.

import { NextResponse } from 'next/server';
import type { IntakeAnswers } from '@/types';
import { recommendPackage } from '@/lib/recommendation';

export async function POST(request: Request) {
  try {
    const answers = (await request.json()) as IntakeAnswers;
    const recommendation = recommendPackage(answers);
    return NextResponse.json({ simulated: true, recommendation });
  } catch {
    return NextResponse.json({ simulated: true, error: 'Invalid intake payload' }, { status: 400 });
  }
}
