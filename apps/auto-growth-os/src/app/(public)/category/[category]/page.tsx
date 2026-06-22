import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { VehicleCard } from '@/components/landing/VehicleCard';
import { CATEGORIES, categoryBySlug, vehiclesForCategory } from '@/lib/inventory';

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const c = categoryBySlug(category);
  if (!c) return { title: 'Category' };
  return { title: c.name, description: `Browse ${c.name.toLowerCase()} in Toronto and the GTA.` };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = categoryBySlug(category);
  if (!c) notFound();
  const vehicles = vehiclesForCategory(category);

  return (
    <div className="py-12 sm:py-16">
      <Section>
        <SectionHeading
          eyebrow="Browse by category"
          title={c.name}
          description="A focused selection — check availability or book a test drive on any vehicle."
        />
        <div className="mt-6">
          <ButtonLink href="/inventory" variant="outline" size="sm">
            View all inventory
          </ButtonLink>
        </div>

        {vehicles.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v, i) => (
              <Reveal key={v.id} delayMs={i * 50}>
                <VehicleCard vehicle={v} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-xl border border-line bg-surface-2 p-6 text-sm text-ink-400">
            Nothing in this category right now — browse all inventory or contact us for current
            options.
          </p>
        )}
      </Section>
    </div>
  );
}
