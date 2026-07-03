# 14 — Sensitive Exclusions and Redaction Policy

## Hard exclusions

Do not copy or print contents of:

- environment files;
- Vercel environment check files;
- raw Vercel project metadata;
- tokens;
- secrets;
- private keys;
- service-account files;
- OAuth/session/cookie files;
- customer exports;
- lead exports;
- subscriber exports;
- raw PII;
- raw B1 private internals;
- raw egress maps;
- Telegram/VIP subscriber exports;
- exchange/provider configs;
- database dumps;
- deployment credentials.

## If encountered

Record only:

```text
SKIPPED_SENSITIVE | SOURCE_ALIAS | relative/non-sensitive description | reason
```

Never include raw values.

## Safe context packaging rules

- Prefer summaries over source dumps.
- Use aliases instead of local paths.
- Use fake/reserved fixtures only.
- Keep raw customer/prospect/subscriber material out of repo.
- Keep MoverOS source out of this repo.
- Keep Budget Wheels as internal demo/design only.
- Do not include private machine paths in Claude-facing build prompts.

## Redaction scan interpretation

Keyword appearances in this policy are not secrets. A stop condition requires a real secret-looking value, credential body, private key block, cookie/session payload, raw env value, raw PII, or customer/prospect export content.
