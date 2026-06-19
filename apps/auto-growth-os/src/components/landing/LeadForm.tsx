'use client';

// components/landing/LeadForm.tsx
// Public lead capture. Computes a live score preview, creates a scored lead in the
// shared store (visible on /dashboard), and shows a success state.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeadFormInput, ScoringSignals } from '@/types';
import { useAppState } from '@/lib/store/useAppState';
import { scoreAndStage } from '@/lib/scoring';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StageBadge } from '@/components/ui/Badge';
import { Field, TextInput, TextArea, Select, CheckboxRow } from '@/components/ui/Field';
import vehiclesRaw from '@/data/vehicles.json';
import type { Vehicle } from '@/types';

const VEHICLES = vehiclesRaw as Vehicle[];

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  vehicleId: '',
  budget: '',
  message: '',
  appointment: false,
  financing: false,
  tradeIn: false,
  respondToday: false,
  consentEmail: true,
  consentSms: false,
  consentWhatsapp: false,
};

export function LeadForm({ defaultVehicleId = '' }: { defaultVehicleId?: string }) {
  const { addLead } = useAppState();
  const [form, setForm] = useState({ ...EMPTY, vehicleId: defaultVehicleId });
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<null | {
    name: string;
    score: number;
    stage: ReturnType<typeof scoreAndStage>['stage'];
  }>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const signals: ScoringSignals = useMemo(
    () => ({
      appointmentRequested: form.appointment,
      financingRequested: form.financing,
      tradeInMentioned: form.tradeIn,
      budgetProvided: Number(form.budget) > 0,
      respondToday: form.respondToday,
      specificVehicleSelected: Boolean(form.vehicleId),
    }),
    [form],
  );

  const preview = useMemo(() => scoreAndStage(signals), [signals]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError('Please add your name and email so we can follow up.');
      return;
    }
    setError(null);

    const vehicle = VEHICLES.find((v) => v.id === form.vehicleId);
    const input: LeadFormInput = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      vehicleId: form.vehicleId || null,
      vehicleInterest: vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`
        : 'General inquiry',
      budgetCad: Number(form.budget) > 0 ? Number(form.budget) : null,
      message: form.message,
      appointmentRequested: form.appointment,
      financingRequested: form.financing,
      tradeInMentioned: form.tradeIn,
      respondToday: form.respondToday,
      consent: {
        email: form.consentEmail,
        sms: form.consentSms,
        whatsapp: form.consentWhatsapp,
      },
      source: 'Website',
    };

    const lead = addLead(input);
    setSubmitted({ name: lead.name, score: lead.score, stage: lead.stage });
  };

  if (submitted) {
    return (
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 text-mint-600">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold uppercase tracking-wider">Lead captured</span>
        </div>
        <h3 className="mt-4 font-display text-2xl font-semibold text-ink-100">
          Thanks, {submitted.name.split(' ')[0]} — we&apos;re on it.
        </h3>
        <p className="mt-2 text-sm text-ink-300">
          Your inquiry was scored and routed instantly. A specialist will reach out
          {form.respondToday ? ' today' : ' shortly'}.
        </p>

        <div className="mt-6 flex items-center gap-6 rounded-xl border border-line bg-surface-2 p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-500">Lead score</p>
            <p className="font-display text-4xl font-bold text-gradient-gold">{submitted.score}</p>
          </div>
          <div className="h-12 w-px bg-line" />
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wider text-ink-500">Routed as</p>
            <StageBadge stage={submitted.stage} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="cta-gold inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            See it in the dashboard →
          </Link>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setForm({ ...EMPTY, vehicleId: defaultVehicleId });
              setSubmitted(null);
            }}
          >
            Submit another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="lf-name" required>
            <TextInput
              id="lf-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Jordan Avery"
              autoComplete="name"
            />
          </Field>
          <Field label="Email" htmlFor="lf-email" required>
            <TextInput
              id="lf-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Phone" htmlFor="lf-phone">
            <TextInput
              id="lf-phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+1 (000) 000-0000"
              autoComplete="tel"
            />
          </Field>
          <Field
            label="Budget (CAD)"
            htmlFor="lf-budget"
            hint="Optional — helps us match inventory"
          >
            <TextInput
              id="lf-budget"
              type="number"
              min={0}
              value={form.budget}
              onChange={(e) => set('budget', e.target.value)}
              placeholder="30000"
            />
          </Field>
        </div>

        <Field label="Vehicle of interest" htmlFor="lf-vehicle">
          <Select
            id="lf-vehicle"
            value={form.vehicleId}
            onChange={(e) => set('vehicleId', e.target.value)}
          >
            <option value="">I&apos;m not sure yet</option>
            {VEHICLES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} {v.trim}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Anything we should know?" htmlFor="lf-message">
          <TextArea
            id="lf-message"
            rows={3}
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="Timing, must-haves, questions…"
          />
        </Field>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <CheckboxRow
            checked={form.appointment}
            onChange={(v) => set('appointment', v)}
            label="Book a test drive"
          />
          <CheckboxRow
            checked={form.financing}
            onChange={(v) => set('financing', v)}
            label="I'd like financing options"
          />
          <CheckboxRow
            checked={form.tradeIn}
            onChange={(v) => set('tradeIn', v)}
            label="I have a trade-in"
          />
          <CheckboxRow
            checked={form.respondToday}
            onChange={(v) => set('respondToday', v)}
            label="Please respond today"
          />
        </div>

        <fieldset className="rounded-xl border border-line bg-surface-2 p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wider text-ink-400">
            Contact consent (CASL)
          </legend>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-200">
            {(
              [
                ['consentEmail', 'Email'],
                ['consentSms', 'SMS'],
                ['consentWhatsapp', 'WhatsApp'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-ink-400">
            <span>Live lead score</span>
            <span className="font-display text-2xl font-bold text-gradient-gold">
              {preview.score}
            </span>
            <StageBadge stage={preview.stage} />
          </div>
          <Button type="submit" variant="gold" size="lg">
            Get my matches
          </Button>
        </div>
      </form>
    </Card>
  );
}
