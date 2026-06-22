'use client';

// components/public/PublicInquiryForm.tsx
// One flexible public lead-capture form. Powers /finance, /trade-in,
// /book-test-drive, /contact, the home quick form, and vehicle-detail CTAs.
// Writes a real Lead (+ proof/ledger) through the demo store.
import { useState, type FormEvent } from 'react';
import type { LeadFormInput } from '@/types';
import { useAppState } from '@/lib/store/useAppState';
import { Field, TextInput, TextArea, Select, CheckboxRow, Label } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { FormSuccess } from '@/components/public/FormSuccess';
import { DISCLAIMERS } from '@/lib/copy';

type Variant = 'general' | 'finance' | 'trade_in' | 'test_drive' | 'contact';

const CONFIG: Record<Variant, { submit: string; success: string }> = {
  general: { submit: 'Send inquiry', success: 'Inquiry received' },
  finance: { submit: 'Request finance callback', success: 'Finance request received' },
  trade_in: { submit: 'Submit trade-in for review', success: 'Trade-in submitted for review' },
  test_drive: { submit: 'Book test drive', success: 'Test drive requested' },
  contact: { submit: 'Send message', success: 'Message received' },
};

export function PublicInquiryForm({
  variant = 'general',
  vehicleId = null,
  vehicleLabel = '',
}: {
  variant?: Variant;
  vehicleId?: string | null;
  vehicleLabel?: string;
}) {
  const { createLead, createAppointment } = useAppState();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicleInterest: vehicleLabel,
    budget: '',
    timeline: 'Just researching',
    preferredTime: '',
    tradeDetails: '',
    message: '',
    consentEmail: true,
    consentSms: false,
    consentWhatsapp: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    const budgetCad = form.budget ? Number(form.budget.replace(/[^\d]/g, '')) || null : null;
    const parts = [form.message];
    if (variant === 'trade_in' && form.tradeDetails)
      parts.unshift(`Trade-in: ${form.tradeDetails}`);
    if (variant !== 'contact' && form.timeline) parts.push(`Timeline: ${form.timeline}`);

    const input: LeadFormInput = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      vehicleId,
      vehicleInterest:
        form.vehicleInterest || (variant === 'contact' ? 'General contact' : 'General inquiry'),
      budgetCad,
      message: parts.filter(Boolean).join(' · '),
      appointmentRequested: variant === 'test_drive',
      financingRequested: variant === 'finance',
      tradeInMentioned: variant === 'trade_in',
      respondToday: false,
      consent: { email: form.consentEmail, sms: form.consentSms, whatsapp: form.consentWhatsapp },
      source: 'Website',
    };
    createLead(input);
    if (variant === 'test_drive') {
      createAppointment({
        leadId: null,
        customerName: form.name.trim(),
        vehicleId,
        vehicleLabel: form.vehicleInterest || vehicleLabel || 'Vehicle TBD',
        type: 'test_drive',
        preferredTime: form.preferredTime || 'To be confirmed',
        status: 'requested',
        owner: 'Unassigned',
        channel: 'Website',
      });
    }
    setDone(true);
  };

  if (done) {
    return (
      <FormSuccess
        title={CONFIG[variant].success}
        lines={[`We'll contact ${form.name.split(' ')[0] || 'you'} to confirm details.`]}
      />
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line glass p-6 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required htmlFor="pf-name">
          <TextInput
            id="pf-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            placeholder="Your name"
          />
        </Field>
        <Field label="Phone" htmlFor="pf-phone">
          <TextInput
            id="pf-phone"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="Best callback number"
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Email" required htmlFor="pf-email">
          <TextInput
            id="pf-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
            placeholder="you@example.com"
          />
        </Field>
      </div>

      {variant !== 'contact' && (
        <div className="mt-4">
          <Field label="Vehicle of interest" htmlFor="pf-veh">
            <TextInput
              id="pf-veh"
              value={form.vehicleInterest}
              onChange={(e) => set('vehicleInterest', e.target.value)}
              placeholder="e.g. 2021 Toyota RAV4 XLE AWD"
            />
          </Field>
        </div>
      )}

      {variant === 'finance' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Budget / monthly comfort" htmlFor="pf-bud" hint="Optional">
            <TextInput
              id="pf-bud"
              value={form.budget}
              onChange={(e) => set('budget', e.target.value)}
              placeholder="e.g. $350/mo or $30,000"
            />
          </Field>
          <Field label="Timeline" htmlFor="pf-tl">
            <Select
              id="pf-tl"
              value={form.timeline}
              onChange={(e) => set('timeline', e.target.value)}
            >
              {['Just researching', 'This month', 'This week', 'ASAP'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {variant === 'trade_in' && (
        <div className="mt-4">
          <Field
            label="Trade-in details"
            htmlFor="pf-trade"
            hint="Year, make, model, trim, mileage, condition"
          >
            <TextArea
              id="pf-trade"
              rows={3}
              value={form.tradeDetails}
              onChange={(e) => set('tradeDetails', e.target.value)}
              placeholder="e.g. 2017 Honda CR-V EX, 95,000 km, good condition"
            />
          </Field>
        </div>
      )}

      {variant === 'test_drive' && (
        <div className="mt-4">
          <Field label="Preferred date & time" htmlFor="pf-pt">
            <TextInput
              id="pf-pt"
              value={form.preferredTime}
              onChange={(e) => set('preferredTime', e.target.value)}
              placeholder="e.g. Saturday afternoon"
            />
          </Field>
        </div>
      )}

      <div className="mt-4">
        <Field label="Message" htmlFor="pf-msg">
          <TextArea
            id="pf-msg"
            rows={3}
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="How can we help?"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Label>Consent (CASL)</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          <CheckboxRow
            checked={form.consentEmail}
            onChange={(v) => set('consentEmail', v)}
            label="Email"
          />
          <CheckboxRow
            checked={form.consentSms}
            onChange={(v) => set('consentSms', v)}
            label="SMS"
          />
          <CheckboxRow
            checked={form.consentWhatsapp}
            onChange={(v) => set('consentWhatsapp', v)}
            label="WhatsApp"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-500">{DISCLAIMERS.confirmDetails}</p>
      <Button type="submit" variant="gold" size="lg" className="mt-5 w-full">
        {CONFIG[variant].submit}
      </Button>
    </form>
  );
}
