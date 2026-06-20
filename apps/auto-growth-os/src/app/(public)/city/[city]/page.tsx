import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { VehicleCard } from '@/components/landing/VehicleCard';
import { CITIES, cityBySlug, publishedVehicles } from '@/lib/inventory';
import { faqJsonLd, jsonLdScript } from '@/lib/seo';

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const c = cityBySlug(city);
  if (!c) return { title: 'City' };
  return {
    title: `Used Cars in ${c.name}`,
    description: `Browse quality used vehicles for buyers in ${c.name}. Check availability, financing, and book a test drive.`,
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const c = cityBySlug(city);
  if (!c) notFound();
  const vehicles = publishedVehicles().slice(0, 6);
  const faqs = [
    {
      q: `Do you serve buyers in ${c.name}?`,
      a: `Yes — we work with buyers across ${c.name} and the GTA. Availability is confirmed with the dealership.`,
    },
    {
      q: `Can I arrange financing or a trade-in from ${c.name}?`,
      a: `You can start both online. Financing is reviewed on approved credit and trade-in values are confirmed after review.`,
    },
  ];

  return (
    <div className="py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(faqs))} />
      <Section>
        <SectionHeading
          eyebrow={`Serving ${c.name}`}
          title={`Used cars in ${c.name}`}
          description={`Certified, inspected vehicles for buyers in ${c.name} and the GTA. Fast answers, online booking, and clear next steps.`}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/inventory" variant="gold" size="md">
            Browse inventory
          </ButtonLink>
          <ButtonLink href="/finance" variant="navy" size="md">
            Request finance callback
          </ButtonLink>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, i) => (
            <Reveal key={v.id} delayMs={i * 50}>
              <VehicleCard vehicle={v} />
            </Reveal>
          ))}
        </div>

        <div className="mt-12 max-w-3xl space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-display text-base font-semibold text-ink-100">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}
