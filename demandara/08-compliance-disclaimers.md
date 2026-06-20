# Compliance Disclaimers (US Automotive)

A ready-to-use disclaimer library for `{{DEALER_NAME}}`. Each block lists **when
it's required**, the **template text** (with placeholders), and **usage notes**.

> **Not legal advice.** These are starting templates. The dealer's **Counsel**
> must review and adapt them for `{{STATE}}` law and the specific offer before
> first use. State advertising rules and DMV/AG requirements vary widely.
> Cross-check the banned-language list in [09](09-what-not-to-claim.md).

## How to use

- Pick the blocks **triggered** by your ad/landing page (table below).
- Keep disclaimers **legible** — readable at mobile speed, not hidden in 6px gray.
- On video/reels, keep price/financing disclaimers **persistently on screen**
  while the related claim is visible.
- When in doubt, include the disclaimer and route to Counsel.

## Trigger matrix

| If your ad/page contains… | Required block(s) |
|---------------------------|-------------------|
| Any advertised vehicle price | A (fees), C (one vehicle / VIN) |
| The word "payment", "APR", "$X/mo", "lease" | B (OAC), D (financing example w/ Reg Z) — **+ Counsel** |
| "Sale", "save", "discount" | E (price comparison basis) |
| "Limited", "while supplies last", expiring offer | F (availability/expiration) |
| A customer testimonial or review | G (testimonial) |
| Stock/illustrative imagery | H (illustration only) |
| Lease quote | I (lease terms) |
| A trade-in value claim | J (trade-in) |
| Any offer at all | K (general / "see dealer") |

---

## A — Price: taxes, title, license & fees
**Required when:** any price is advertised.
> `{{DISCLAIMER_FEES}}`: Advertised price excludes applicable taxes, title,
> license, and registration fees, and includes all dealer-added charges as
> required. Price reflects the total amount payable to the dealer for the
> vehicle before government taxes and fees. See dealer for complete details.

**Notes:** Per Google's pricing policy and FTC guidance, the *advertised* price
must be the real, all-in dealer price — **do not** hide doc/prep/shipping/
"market adjustment" fees and reveal them later. Only genuine government
taxes/fees may sit outside the advertised number, and they must be disclosed.

## B — On approved credit (OAC)
**Required when:** any financing/credit is referenced. **+ Counsel.**
> `{{DISCLAIMER_OAC}}`: Financing on approved credit through authorized lenders.
> Not all applicants will qualify. Terms vary based on creditworthiness, down
> payment, and lender approval. This is not an offer or guarantee of credit.

**Notes:** Never imply guaranteed approval. See [09](09-what-not-to-claim.md).

## C — Single vehicle / VIN availability
**Required when:** a specific priced vehicle is shown.
> `{{DISCLAIMER_VIN}}`: Price applies to the specific vehicle shown (VIN
> available on request) and is subject to prior sale. One only at this price.

## D — Financing example (Truth in Lending / Reg Z)
**Required when:** you state a rate, payment, term, or down payment. **+ Counsel.**
> `{{DISCLAIMER_REGZ}}`: Example: `{{APR}}`% APR for `{{TERM}}` months,
> `{{PAYMENT}}` per $1,000 financed, with `{{DOWN}}` down, on approved credit.
> Your terms may vary. Total of payments and amount financed available on
> request. Offer subject to lender approval.

**Notes — Reg Z "trigger terms":** If an ad states **any** of: the down payment
amount, the payment amount, the number of payments, the period of repayment, or
the finance charge — then it **must also clearly disclose** (1) the amount or
percentage of down payment, (2) terms of repayment, and (3) the APR (and whether
it may increase). Stating only "0% APR" or "low monthly payments" without these
triggers a violation. **Counsel must approve all financing examples.**

## E — Price comparison / savings basis
**Required when:** "save $X", "was/now", "% off".
> `{{DISCLAIMER_SAVINGS}}`: Savings based on `{{BASIS}}` (e.g., manufacturer
> MSRP). MSRP may not reflect actual selling price. Dealer sets final price.

**Notes:** The comparison basis must be real and substantiated — no fictitious
"original" prices.

## F — Availability / expiration
**Required when:** "limited", "while supplies last", time-bound offer.
> `{{DISCLAIMER_AVAIL}}`: Offer valid through `{{END_DATE}}` or while supplies
> last. Vehicle subject to prior sale. Quantities limited.

**Notes:** No fake/“evergreen” countdowns — see [09](09-what-not-to-claim.md).

## G — Testimonial / review
**Required when:** any customer quote, review, or results story.
> `{{DISCLAIMER_TESTIMONIAL}}`: Individual experience. Results and experiences
> vary. Testimonial reflects this customer's opinion and is not a guarantee of
> any outcome. Customer was not compensated unless otherwise stated.

**Notes:** Per FTC endorsement rules — disclose any material connection or
incentive; never fabricate or buy reviews. Get a **signed media release** for
identifiable people.

## H — Illustration / stock imagery
**Required when:** images aren't the actual vehicle/feature.
> `{{DISCLAIMER_ILLUSTRATION}}`: Images for illustration only. Actual vehicle,
> color, trim, and features may differ.

## I — Lease terms
**Required when:** a lease is advertised. **+ Counsel.**
> `{{DISCLAIMER_LEASE}}`: Lease example: `{{TERM}}`-month lease, `{{MILES}}`
> miles/year, `{{DUE}}` due at signing, on approved credit. Excludes taxes,
> title, license. Lessee responsible for excess wear and `{{OVERAGE}}`/mile over
> the limit. See dealer for full lease terms.

**Notes:** Consumer Leasing Act / Reg M disclosures apply — Counsel required.

## J — Trade-in
**Required when:** any trade-in value or offer is referenced.
> `{{DISCLAIMER_TRADE}}`: Trade-in value subject to vehicle inspection,
> condition, mileage, and market. Estimates are not a guaranteed offer.

## K — General catch-all
**Required when:** any offer is present (always safe to include).
> `{{DISCLAIMER_GENERAL}}`: `{{DEALER_NAME}}`, `{{CITY}}`, `{{STATE}}`. See
> dealer for complete details. `{{DEALER_NAME}}` not responsible for typographic
> errors. Prices and availability subject to change without notice. Equal
> opportunity — `{{DEALER_NAME}}` does not discriminate on any protected basis.

---

## Platform-required disclosures (in addition to the above)

- **Paid creator/influencer content:** use each platform's paid-partnership /
  Branded Content toggle **and** a clear "#ad"/"paid partnership" label (FTC).
- **AI-generated or altered media:** label per platform policy if synthetic media
  depicts the vehicle/people in a misleading way.
- **Accessibility:** captions on video; sufficient contrast on on-screen
  disclaimers.

## Pre-publish disclaimer checklist

- [ ] Every triggered block from the matrix is present.
- [ ] Financing/lease blocks reviewed by **Counsel**.
- [ ] Disclaimers legible (size/contrast/duration on video).
- [ ] Advertised price is all-in (fees included); matches landing page.
- [ ] Testimonials carry the disclosure + signed release on file.
- [ ] Nothing here contradicts [09](09-what-not-to-claim.md).

---

**Reference (verify with Counsel):** FTC Truth-in-advertising & endorsement
guides; Truth in Lending Act / Regulation Z (12 CFR 1026.24 advertising,
trigger terms); Consumer Leasing Act / Regulation M; applicable `{{STATE}}`
motor-vehicle advertising regulations.
