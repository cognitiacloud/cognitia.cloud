import type { ApifyDatasetItem } from './types.js';

/**
 * Fixture datasets (pure; no env, no I/O). Two safe prototype shapes used in
 * fixture mode and tests so the pipeline runs with zero network and zero real
 * actor calls. PII fields use clearly-FAKE demo values purely to exercise
 * redaction/hashing — never real personal data.
 */

/** Map-style / local-business-directory results (some demo PII to redact). */
const MAPS_DIRECTORY_DATASET: ApifyDatasetItem[] = [
  {
    name: 'Acme Toyota',
    website: 'https://acmetoyota.example',
    city: 'Toronto',
    state: 'ON',
    country: 'CA',
    category: 'Toyota dealer',
    rating: 4.4,
    reviewsCount: 812,
    url: 'https://maps.example/place/acme-toyota',
    // Demo PII (fake) — must be redacted before persistence.
    phone: '+1 (416) 555-0100',
    ownerName: 'Demo Owner',
    contactEmail: 'sales@acmetoyota.example',
  },
  {
    name: 'Lakeside Honda',
    website: 'http://www.lakesidehonda.example/inventory',
    city: 'Hamilton',
    state: 'ON',
    country: 'CA',
    category: 'Honda dealer',
    rating: 4.1,
    reviewsCount: 263,
    url: 'https://maps.example/place/lakeside-honda',
    phone: '905-555-0142',
  },
  {
    // Duplicate of the first by domain — proves dedupe-key stability.
    name: 'Acme Toyota (North)',
    website: 'https://acmetoyota.example/north',
    city: 'Toronto',
    state: 'ON',
    country: 'CA',
    category: 'Toyota dealer',
    url: 'https://maps.example/place/acme-toyota-north',
  },
];

/** Dealership website / company-profile results. */
const WEBSITE_PROFILE_DATASET: ApifyDatasetItem[] = [
  {
    companyName: 'Summit Ford',
    url: 'https://summitford.example',
    city: 'Ottawa',
    provinceOrState: 'ON',
    country: 'CA',
    category: 'Ford dealer',
    inventory: 'trucks,suvs',
  },
  {
    companyName: 'Harbour Mazda',
    website: 'https://harbourmazda.example',
    city: 'Halifax',
    province: 'NS',
    country: 'CA',
    category: 'Mazda dealer',
    // Demo PII (fake) in a nested object — must be redacted at depth.
    contact: { fullName: 'Demo Person', email: 'info@harbourmazda.example' },
  },
];

const BY_ACTOR_ID: Record<string, ApifyDatasetItem[]> = {
  'apify/google-places-scraper': MAPS_DIRECTORY_DATASET,
  'apify/website-content-crawler': WEBSITE_PROFILE_DATASET,
};

/**
 * Return a deep copy of the fixture dataset for an actor (deep copy so callers
 * can mutate freely). Unknown actors get the website-profile dataset as a safe
 * default.
 */
export function getFixtureDataset(actorId: string): ApifyDatasetItem[] {
  const dataset = BY_ACTOR_ID[actorId] ?? WEBSITE_PROFILE_DATASET;
  return JSON.parse(JSON.stringify(dataset)) as ApifyDatasetItem[];
}
