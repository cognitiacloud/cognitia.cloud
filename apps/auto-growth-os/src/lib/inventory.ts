// lib/inventory.ts
// Read helpers over the seed inventory for the public (server-rendered) pages.
// The public site shows only published + approved vehicles.
import type { Vehicle } from '../types';
import vehiclesRaw from '../data/vehicles.json';

const ALL = vehiclesRaw as Vehicle[];

export function allVehicles(): Vehicle[] {
  return ALL;
}

export function publishedVehicles(): Vehicle[] {
  return ALL.filter((v) => v.publishedStatus === 'published' && v.approvalStatus === 'approved');
}

export function vehicleBySlug(slug: string): Vehicle | undefined {
  return ALL.find((v) => v.slug === slug);
}

export function vehicleLabel(v: Vehicle): string {
  return `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
}

export const CITIES = [
  { slug: 'toronto', name: 'Toronto' },
  { slug: 'mississauga', name: 'Mississauga' },
  { slug: 'brampton', name: 'Brampton' },
  { slug: 'scarborough', name: 'Scarborough' },
] as const;

export const CATEGORIES = [
  { slug: 'suvs', name: 'Used SUVs', bodyType: 'SUV' as string | null, maxPrice: 0 },
  { slug: 'trucks', name: 'Used Trucks', bodyType: 'Truck', maxPrice: 0 },
  { slug: 'sedans', name: 'Used Sedans', bodyType: 'Sedan', maxPrice: 0 },
  { slug: 'under-25k', name: 'Cars Under $25k', bodyType: null, maxPrice: 25000 },
] as const;

export function cityBySlug(slug: string) {
  return CITIES.find((c) => c.slug === slug);
}

export function categoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function vehiclesForCategory(slug: string): Vehicle[] {
  const cat = categoryBySlug(slug);
  if (!cat) return [];
  return publishedVehicles().filter(
    (v) =>
      (cat.bodyType === null || v.bodyType === cat.bodyType) &&
      (cat.maxPrice === 0 || v.priceCad <= cat.maxPrice),
  );
}
