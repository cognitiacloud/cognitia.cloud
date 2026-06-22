// lib/seo.ts
// Structured-data (JSON-LD) helpers. Foundations only — no ranking, rich-result,
// or AI-search inclusion is promised anywhere in copy.
import type { Vehicle } from '../types';

export function vehicleJsonLd(v: Vehicle): Record<string, unknown> {
  const name = `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name,
    brand: { '@type': 'Brand', name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    bodyType: v.bodyType,
    fuelType: v.fuelType,
    vehicleTransmission: v.transmission,
    driveWheelConfiguration: v.drivetrain,
    color: v.exteriorColor,
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.odometerKm, unitCode: 'KMT' },
    ...(v.vin ? { vehicleIdentificationNumber: v.vin } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CAD',
      price: v.priceCad,
      availability:
        v.availabilityStatus === 'sold'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
    },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: t.url,
    })),
  };
}

/** For <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(data)} />. */
export function jsonLdScript(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data) };
}
