import { describe, expect, it } from 'vitest';
import type { Vehicle } from '../types';
import { vehicleJsonLd, faqJsonLd, breadcrumbJsonLd, jsonLdScript } from './seo';

const vehicle: Vehicle = {
  id: 'V2',
  year: 2021,
  make: 'Toyota',
  model: 'RAV4',
  trim: 'XLE AWD',
  priceCad: 34500,
  odometerKm: 41800,
  bodyType: 'SUV',
  fuelType: 'Gasoline',
  transmission: 'Automatic',
  drivetrain: 'AWD',
  exteriorColor: 'Magnetic Grey',
  accent: ['#0a1124', '#4fe0b0'],
  badges: ['Certified'],
  status: 'Available',
};

describe('vehicleJsonLd', () => {
  it('produces a Car node with a CAD offer', () => {
    const ld = vehicleJsonLd(vehicle) as Record<string, unknown>;
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Car');
    expect(ld.name).toBe('2021 Toyota RAV4 XLE AWD');
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe('CAD');
    expect(offers.price).toBe(34500);
  });
});

describe('faqJsonLd', () => {
  it('builds an FAQPage with one Question per item', () => {
    const ld = faqJsonLd([
      { q: 'Are prices final?', a: 'Pricing is confirmed with the dealership.' },
      { q: 'Can I book online?', a: 'Yes.' },
    ]) as Record<string, unknown>;
    expect(ld['@type']).toBe('FAQPage');
    const main = ld.mainEntity as unknown[];
    expect(main).toHaveLength(2);
    expect((main[0] as Record<string, unknown>)['@type']).toBe('Question');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers list items from 1', () => {
    const ld = breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Inventory', url: '/inventory' },
    ]) as Record<string, unknown>;
    const items = ld.itemListElement as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(items[0]?.position).toBe(1);
  });
});

describe('jsonLdScript', () => {
  it('round-trips through JSON.parse', () => {
    const data = vehicleJsonLd(vehicle);
    expect(JSON.parse(jsonLdScript(data).__html)).toEqual(data);
  });
});
