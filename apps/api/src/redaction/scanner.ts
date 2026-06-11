/**
 * PII / secret scanner for Proof Registry redaction checks (COG-003).
 *
 * Ported from the proven regex set in `hermes/skills/vision-skill/
 * vision_skill.py` (`_scan_text_for_pii`): emails, phone numbers, API keys &
 * tokens, filesystem paths, and financial digit runs. Doctrine
 * (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md §6): a proof summary may only be
 * marked public_safe when this scan finds nothing — default-deny.
 *
 * Keep patterns in sync with the Hermes skill when either side changes.
 */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s\-.])?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}/g;
const KEY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, label: 'anthropic-key' },
  { re: /sk-[A-Za-z0-9_-]{20,}/, label: 'openai-key' },
  { re: /AIza[0-9A-Za-z_-]{35}/, label: 'google-api-key' },
  { re: /xox[abprs]-[A-Za-z0-9-]{10,}/, label: 'slack-token' },
  { re: /gh[pousr]_[A-Za-z0-9]{30,}/, label: 'github-token' },
  { re: /AKIA[0-9A-Z]{16}/, label: 'aws-access-key-id' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'private-key-block' },
  { re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, label: 'jwt' },
  { re: /hf_[A-Za-z0-9]{30,}/, label: 'huggingface-token' },
  { re: /glpat-[A-Za-z0-9_-]{20,}/, label: 'gitlab-token' },
];
const PATH_RE = /(?:[A-Z]:\\\\[^\s"<>]+|\/(?:home|root|Users|var|etc|mnt|tmp|opt)\/[^\s"<>]+)/g;
const FINANCIAL_RE = /\b(?:\d[ -]?){13,16}\b|routing\s*[:#]?\s*\d{9}\b|acct\s*[:#]?\s*\d{6,}/i;

export interface PiiScanResult {
  emails_detected: string[];
  phone_numbers_detected: string[];
  api_keys_or_tokens_detected: string[];
  file_paths_detected: string[];
  financial_data_detected: boolean;
  /** True only when nothing above was detected. */
  publish_safe: boolean;
}

function uniqueMatches(text: string, re: RegExp): string[] {
  return [...new Set(text.match(re) ?? [])].sort();
}

/** Scan free text for PII/secrets. Empty/absent text is publish-safe. */
export function scanTextForPii(text: string | null | undefined): PiiScanResult {
  const value = text ?? '';
  const emails = uniqueMatches(value, EMAIL_RE);
  const phones = uniqueMatches(value, PHONE_RE);
  const keys = KEY_PATTERNS.filter(({ re }) => re.test(value))
    .map(({ label }) => label)
    .sort();
  const paths = uniqueMatches(value, PATH_RE);
  const financial = FINANCIAL_RE.test(value);
  return {
    emails_detected: emails,
    phone_numbers_detected: phones,
    api_keys_or_tokens_detected: keys,
    file_paths_detected: paths,
    financial_data_detected: financial,
    publish_safe:
      emails.length === 0 &&
      phones.length === 0 &&
      keys.length === 0 &&
      paths.length === 0 &&
      !financial,
  };
}

/**
 * Findings as audit-safe strings (counts + labels, never the matched PII
 * itself — findings end up in audit detail and must not relocate the PII).
 */
export function describeFindings(result: PiiScanResult): string[] {
  const findings: string[] = [];
  if (result.emails_detected.length) findings.push(`emails:${result.emails_detected.length}`);
  if (result.phone_numbers_detected.length) {
    findings.push(`phones:${result.phone_numbers_detected.length}`);
  }
  for (const label of result.api_keys_or_tokens_detected) findings.push(`key:${label}`);
  if (result.file_paths_detected.length)
    findings.push(`paths:${result.file_paths_detected.length}`);
  if (result.financial_data_detected) findings.push('financial-digits');
  return findings;
}
