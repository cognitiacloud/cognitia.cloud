'use client';

// components/portal/InventoryForm.tsx
// Create/edit a vehicle. Sensitive fields require human attestation, and a
// listing cannot be published unless attested AND approved.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Vehicle, AccidentHistory, ApprovalStatus } from '@/types';
import { useAppState } from '@/lib/store/useAppState';
import { Field, TextInput, Select, CheckboxRow } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { RiskBadge } from '@/components/portal/RiskBadge';
import { DisclosureNote } from '@/components/portal/DisclosureNote';
import { generateVehicleListingDraft, type DraftBase } from '@/lib/ai-drafts';
import { makeId } from '@/lib/id';

function slugify(v: Vehicle) {
  return `${v.year}-${v.make}-${v.model}-${v.trim}-${v.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const BODY_TYPES = ['Sedan', 'SUV', 'Truck', 'Hatchback', 'Wagon', 'Coupe', 'Van'];
const DRIVETRAINS = ['FWD', 'AWD', 'RWD', '4WD'];
const ACCIDENT: AccidentHistory[] = ['none', 'minor', 'major', 'unknown'];
const APPROVALS: ApprovalStatus[] = ['draft', 'pending_review', 'approved', 'rejected'];

export function InventoryForm({ vehicleId }: { vehicleId?: string }) {
  const { vehicles, createVehicle, publishVehicle } = useAppState();
  const router = useRouter();
  const existing = vehicleId ? vehicles.find((v) => v.id === vehicleId) : undefined;

  const [form, setForm] = useState<Vehicle>(
    () =>
      existing ?? {
        id: makeId('V'),
        year: 2021,
        make: '',
        model: '',
        trim: '',
        priceCad: 0,
        odometerKm: 0,
        bodyType: 'Sedan',
        fuelType: 'Gasoline',
        transmission: 'Automatic',
        drivetrain: 'FWD',
        exteriorColor: '',
        accent: ['#0a1124', '#36d2e6'],
        badges: [],
        status: 'Available',
        vin: '',
        stockNumber: '',
        accidentHistory: 'unknown',
        carfaxAvailable: false,
        warranty: '',
        availabilityStatus: 'available',
        approvalStatus: 'draft',
        publishedStatus: 'unpublished',
        sensitiveFieldsConfirmed: false,
      },
  );
  const [draft, setDraft] = useState<DraftBase | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof Vehicle>(k: K, v: Vehicle[K]) => setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    const next = { ...form, slug: slugify(form) };
    createVehicle(next);
    setForm(next);
    setMsg('Saved.');
    if (!existing) router.push(`/portal/inventory/${next.id}`);
  };

  const publish = () => {
    createVehicle({ ...form, slug: slugify(form) });
    const res = publishVehicle(form.id);
    setMsg(res.ok ? 'Published to the public site.' : (res.reason ?? 'Could not publish.'));
  };

  const canPublish = useMemo(
    () => form.sensitiveFieldsConfirmed === true && form.approvalStatus === 'approved',
    [form.sensitiveFieldsConfirmed, form.approvalStatus],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="rounded-2xl border border-line glass p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Year">
            <TextInput
              type="number"
              value={form.year}
              onChange={(e) => set('year', Number(e.target.value))}
            />
          </Field>
          <Field label="Make">
            <TextInput value={form.make} onChange={(e) => set('make', e.target.value)} />
          </Field>
          <Field label="Model">
            <TextInput value={form.model} onChange={(e) => set('model', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Trim">
            <TextInput value={form.trim} onChange={(e) => set('trim', e.target.value)} />
          </Field>
          <Field label="Price (CAD)">
            <TextInput
              type="number"
              value={form.priceCad}
              onChange={(e) => set('priceCad', Number(e.target.value))}
            />
          </Field>
          <Field label="Odometer (km)">
            <TextInput
              type="number"
              value={form.odometerKm}
              onChange={(e) => set('odometerKm', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="VIN">
            <TextInput value={form.vin ?? ''} onChange={(e) => set('vin', e.target.value)} />
          </Field>
          <Field label="Stock #">
            <TextInput
              value={form.stockNumber ?? ''}
              onChange={(e) => set('stockNumber', e.target.value)}
            />
          </Field>
          <Field label="Exterior color">
            <TextInput
              value={form.exteriorColor}
              onChange={(e) => set('exteriorColor', e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Body type">
            <Select value={form.bodyType} onChange={(e) => set('bodyType', e.target.value)}>
              {BODY_TYPES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>
          <Field label="Drivetrain">
            <Select value={form.drivetrain} onChange={(e) => set('drivetrain', e.target.value)}>
              {DRIVETRAINS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Accident history">
            <Select
              value={form.accidentHistory ?? 'unknown'}
              onChange={(e) => set('accidentHistory', e.target.value as AccidentHistory)}
            >
              {ACCIDENT.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Warranty">
            <TextInput
              value={form.warranty ?? ''}
              onChange={(e) => set('warranty', e.target.value)}
              placeholder="e.g. Balance of factory warranty"
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-gold-400/30 bg-gold-400/[0.06] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">
            Sensitive fields gate
          </p>
          <p className="mt-1 text-sm text-ink-300">
            Price, accident history, warranty, and Carfax must be confirmed by a human before
            publishing.
          </p>
          <div className="mt-3 space-y-2">
            <CheckboxRow
              checked={form.carfaxAvailable ?? false}
              onChange={(v) => set('carfaxAvailable', v)}
              label="CarFax available"
            />
            <CheckboxRow
              checked={form.sensitiveFieldsConfirmed ?? false}
              onChange={(v) => set('sensitiveFieldsConfirmed', v)}
              label="I confirm the sensitive fields are accurate"
              description="Human attestation (CASL / accuracy)."
            />
          </div>
          <div className="mt-3">
            <Field label="Approval status">
              <Select
                value={form.approvalStatus ?? 'draft'}
                onChange={(e) => set('approvalStatus', e.target.value as ApprovalStatus)}
              >
                {APPROVALS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="gold" size="md" onClick={save}>
            Save
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => setDraft(generateVehicleListingDraft(form))}
          >
            Generate listing copy
          </Button>
          <Button variant="navy" size="md" onClick={publish} disabled={!canPublish}>
            Publish
          </Button>
        </div>
        {!canPublish && (
          <DisclosureNote>
            Publish is disabled until sensitive fields are confirmed and approval status is
            “approved”.
          </DisclosureNote>
        )}
        {msg && <DisclosureNote tone="info">{msg}</DisclosureNote>}

        {draft && (
          <div className="rounded-2xl border border-line glass p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Listing draft
              </p>
              <RiskBadge level={draft.riskLevel} />
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 font-sans text-sm text-ink-200">
              {draft.content}
            </pre>
            {draft.requiresApproval && (
              <DisclosureNote>
                This copy references sensitive fields and requires approval before it is attached to
                a published listing.
              </DisclosureNote>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
