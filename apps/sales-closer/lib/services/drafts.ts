import { eq } from 'drizzle-orm';
import { logCompliance } from '@cognitia/core';
import { outreachDrafts, type OutreachDraft } from '@cognitia/db';
import { db } from '../db';

/** Approve or reject an outreach draft, recording the decision in the audit log. */
export async function reviewDraft(
  draftId: string,
  decision: 'approved' | 'rejected',
  actor: string,
  notes?: string,
): Promise<OutreachDraft> {
  const [updated] = await db()
    .update(outreachDrafts)
    .set({
      status: decision,
      reviewerId: actor,
      reviewedAt: new Date(),
      reviewNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(outreachDrafts.id, draftId))
    .returning();
  if (!updated) throw new Error(`Draft ${draftId} not found`);

  await logCompliance(db(), {
    entityType: 'outreach_draft',
    entityId: draftId,
    action: decision === 'approved' ? 'outreach_approved' : 'outreach_rejected',
    actor,
    lawfulBasis: 'legitimate_interest',
    details: { notes },
  });

  return updated;
}
