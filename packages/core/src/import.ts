import { eq } from 'drizzle-orm';
import type { Database } from '@cognitia/db';
import { prospectAccounts, prospectContacts } from '@cognitia/db';
import type { ApifyDatasetItem } from '@cognitia/apify';
import { dedupeRecords, normalizeItem } from './normalize';

export interface NormalizeResult {
  accountsCreated: number;
  accountsMatched: number;
  contactsUpserted: number;
}

/**
 * Normalize a batch of raw Apify items into accounts + contacts, deduping on
 * canonical domain. Idempotent: re-running with the same data creates nothing
 * new. Returns counts for the scrape_runs.stats field.
 */
export async function normalizeDataset(
  db: Database,
  _scrapeRunId: string | null,
  items: ApifyDatasetItem[],
): Promise<NormalizeResult> {
  const records = dedupeRecords(
    items.map(normalizeItem).filter((r): r is NonNullable<typeof r> => r !== null),
  );

  let accountsCreated = 0;
  let accountsMatched = 0;
  let contactsUpserted = 0;

  for (const record of records) {
    const inserted = await db
      .insert(prospectAccounts)
      .values(record.account)
      .onConflictDoNothing({ target: prospectAccounts.dedupeKey })
      .returning({ id: prospectAccounts.id });

    let accountId: string;
    if (inserted.length > 0 && inserted[0]) {
      accountId = inserted[0].id;
      accountsCreated++;
    } else {
      const [existing] = await db
        .select({ id: prospectAccounts.id })
        .from(prospectAccounts)
        .where(eq(prospectAccounts.dedupeKey, record.account.dedupeKey))
        .limit(1);
      if (!existing) continue;
      accountId = existing.id;
      accountsMatched++;
    }

    if (record.contact) {
      const res = await db
        .insert(prospectContacts)
        .values({ ...record.contact, accountId, isPrimary: true })
        .onConflictDoNothing({
          target: [prospectContacts.accountId, prospectContacts.dedupeKey],
        })
        .returning({ id: prospectContacts.id });
      if (res.length > 0) contactsUpserted++;
    }
  }

  return { accountsCreated, accountsMatched, contactsUpserted };
}
