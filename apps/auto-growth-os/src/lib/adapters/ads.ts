// lib/adapters/ads.ts
import type { AdsReportingAdapter, CampaignMetrics, DateRange } from './types';

/**
 * Simulated ad-reporting adapter. Spend lives in the CLIENT's own Google/Meta
 * accounts. Production: implement read-only reporting against the Google Ads API
 * and Meta Marketing API behind this interface.
 */
export class MockAdsReportingAdapter implements AdsReportingAdapter {
  async getCampaignMetrics(_range: DateRange): Promise<CampaignMetrics[]> {
    return [
      {
        channel: 'Google Ads',
        campaign: 'Used SUVs — Search',
        impressions: 18420,
        clicks: 642,
        leads: 38,
        spendCad: 1840,
        costPerLeadCad: 48,
      },
      {
        channel: 'Meta Ads',
        campaign: 'Trade-In Offer — Retargeting',
        impressions: 51230,
        clicks: 1130,
        leads: 27,
        spendCad: 980,
        costPerLeadCad: 36,
      },
    ];
  }
}
