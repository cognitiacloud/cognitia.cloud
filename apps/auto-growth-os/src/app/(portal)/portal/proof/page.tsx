import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ProofFeed } from '@/components/portal/ProofFeed';
import { ActionLedgerTable } from '@/components/portal/ActionLedgerTable';

export const metadata: Metadata = { title: 'Proof Ledger' };

export default function PortalProofPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Trust &amp; governance"
        title="Proof registry &amp; action ledger"
        description="Every meaningful action is recorded as a proof event and an immutable ledger entry."
      />
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-100">Proof events</h2>
          <ProofFeed />
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-100">Action ledger</h2>
          <ActionLedgerTable />
        </section>
      </div>
    </>
  );
}
