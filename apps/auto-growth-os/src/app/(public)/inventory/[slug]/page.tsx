import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import { VehicleDetail } from '@/components/public/VehicleDetail';
import { vehicleJsonLd, jsonLdScript } from '@/lib/seo';
import { publishedVehicles, vehicleBySlug, vehicleLabel } from '@/lib/inventory';

export function generateStaticParams() {
  return publishedVehicles().map((v) => ({ slug: v.slug as string }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const v = vehicleBySlug(slug);
  if (!v) return { title: 'Vehicle' };
  return {
    title: vehicleLabel(v),
    description: `${vehicleLabel(v)} for sale in Toronto. Check availability and book a test drive.`,
  };
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = vehicleBySlug(slug);
  if (!v || v.publishedStatus !== 'published' || v.approvalStatus !== 'approved') notFound();
  return (
    <div className="py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(vehicleJsonLd(v))} />
      <Section>
        <VehicleDetail vehicle={v} />
      </Section>
    </div>
  );
}
