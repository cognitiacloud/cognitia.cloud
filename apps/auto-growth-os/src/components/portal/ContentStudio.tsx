'use client';

// components/portal/ContentStudio.tsx
// Lists content or social drafts with their guardrail risk and an approval gate.
import { useAppState } from '@/lib/store/useAppState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RiskBadge, ClaimChips } from '@/components/portal/RiskBadge';
import { DisclosureNote } from '@/components/portal/DisclosureNote';
import type { ContentDraft, SocialPostDraft } from '@/types';

const STATUS_TONE: Record<string, 'neutral' | 'gold' | 'mint' | 'alert'> = {
  draft: 'neutral',
  pending_review: 'gold',
  approved: 'mint',
  rejected: 'alert',
};

export function ContentStudio({ kind }: { kind: 'content' | 'social' }) {
  const { contentDrafts, socialDrafts, decideContent, decideSocial } = useAppState();
  const items: (ContentDraft | SocialPostDraft)[] =
    kind === 'content' ? contentDrafts : socialDrafts;
  const decide = kind === 'content' ? decideContent : decideSocial;

  return (
    <div className="space-y-4">
      <DisclosureNote tone="info">
        Any {kind === 'content' ? 'page' : 'post'} that mentions price, availability, financing,
        warranty, accident history, or promotions requires human approval before it can be
        published.
      </DisclosureNote>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const pending =
            item.approvalStatus === 'pending_review' || item.approvalStatus === 'draft';
          const isSocial = kind === 'social';
          const social = item as SocialPostDraft;
          const content = item as ContentDraft;
          return (
            <div
              key={item.id}
              className="flex h-full flex-col rounded-2xl border border-line glass p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold text-ink-100">
                    {isSocial ? `${social.platform} · ${social.format}` : content.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {isSocial ? social.vehicleLabel : content.topic}
                  </p>
                </div>
                <RiskBadge level={item.riskLevel} />
              </div>

              <div className="mt-2">
                <ClaimChips claims={item.claimTypes} />
              </div>

              <p className="mt-3 flex-1 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-200">
                {isSocial ? social.caption : content.body}
              </p>
              {isSocial && social.script && (
                <p className="mt-2 text-xs text-ink-500">Script: {social.script}</p>
              )}

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                <Badge tone={STATUS_TONE[item.approvalStatus]}>
                  {item.approvalStatus.replace(/_/g, ' ')}
                </Badge>
                {pending && (
                  <div className="flex gap-2">
                    <Button variant="gold" size="sm" onClick={() => decide(item.id, 'approved')}>
                      Approve
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => decide(item.id, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
