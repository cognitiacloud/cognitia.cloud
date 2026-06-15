# Lane A — Operator UI Shell (Handoff)

Owner: Lane A (app shell + global dashboard structure)
Stack: Next.js App Router (15.x) · TypeScript · Tailwind CSS 3

This document is the contract between the shell and downstream lanes. The shell
renders **chrome and structure only** — no business logic. Downstream lanes fill
the placeholders without touching shell internals.

---

## 1. What shipped

- **App frame** — fixed sidebar + sticky topbar + one main scroll region.
- **Routes** — `/overview`, `/approvals`, `/runs`, `/contacts`, `/meetings`,
  `/audit`, `/integrations`, `/settings` (under a `(dashboard)` route group),
  plus `/` → `/overview` redirect and a global `not-found`.
- **Command palette** — global ⌘K / Ctrl-K search with a provider hook.
- **Reusable primitives** — Card, StatCard, Badge, Button, Drawer,
  TableContainer (+ Table/Th/Td/Tr), EmptyState, ErrorState, LoadingState,
  Skeleton.
- **States** — route-level `loading.tsx` and `error.tsx` for the dashboard group.
- **Design tokens** — semantic CSS variables mapped into Tailwind.

Verified: `pnpm typecheck`, `pnpm lint` (via build), and `pnpm build` all pass.

```bash
pnpm install
pnpm dev        # local dev
pnpm build      # production build (runs lint + typecheck)
pnpm typecheck  # tsc --noEmit
```

---

## 2. Directory map

```
src/
  app/
    layout.tsx                # root <html>, metadata, theme
    page.tsx                  # redirect → /overview
    not-found.tsx             # global 404
    globals.css               # design tokens + base styles
    (dashboard)/
      layout.tsx              # wraps all routes in <AppShell>
      loading.tsx             # group loading skeleton
      error.tsx               # group error boundary
      overview/page.tsx       # …and approvals, runs, contacts,
      …                       #    meetings, audit, integrations, settings
  components/
    shell/                    # AppShell, Sidebar, Topbar, CommandBar,
                              #   PageContainer, PageHeader  (+ index.ts)
    ui/                       # Card, StatCard, Badge, Button, Drawer,
                              #   TableContainer, EmptyState, ErrorState,
                              #   LoadingState, Skeleton  (+ index.ts)
  lib/
    cn.ts                     # className merge helper
    nav.ts                    # navigation model + active-route resolver
  types/
    shell.ts                  # shared TS contracts
docs/handoffs/lane-a.md       # this file
```

---

## 3. Contracts other lanes must follow

### 3.1 Page composition

Every route body uses the same two primitives so spacing stays uniform:

```tsx
import { PageContainer, PageHeader } from "@/components/shell";

export default function MyPage() {
  return (
    <PageContainer size="wide">           {/* "default" | "wide" */}
      <PageHeader title="…" subtitle="…" actions={<…/>} />
      {/* lane content here */}
    </PageContainer>
  );
}
```

- Do **not** add your own outer scroll container — the shell owns the single
  scroll region (`<main>` in `AppShell`). Just render content.
- Keep text density low: `PageHeader` is title + one-line subtitle + actions.

### 3.2 Shared types (`@/types/shell`)

| Type | Use |
| --- | --- |
| `RouteKey` | Union of the 8 route keys. |
| `NavItem` | Sidebar entry shape (used by `lib/nav.ts`). |
| `StatusTone` | `neutral \| success \| warning \| danger \| info \| accent` — the only allowed tones for `Badge`/`StatCard`. |
| `AsyncState<T>` | Standard envelope: `loading \| empty \| error \| ready`. Render the matching shell state for each branch. |
| `ShellError` | `{ title, message, code? }` — shape consumed by `ErrorState`. |
| `CommandResult` | Result returned to the command palette by a provider. |

Map your data to `AsyncState<T>` and render:
`loading → <LoadingState/>`, `empty → <EmptyState/>`,
`error → <ErrorState error={…}/>`, `ready → your content`.

### 3.3 Command palette providers

The palette ships navigation results. To contribute (contacts, runs, actions),
pass `CommandProvider`s. A provider takes the query and returns
`CommandResult[]` (sync or async):

```tsx
const contactsProvider: CommandProvider = async (q) => [
  { id: "c:1", title: "Jane Doe", group: "Contacts", href: "/contacts/1" },
];
<CommandBar providers={[contactsProvider]} />
```

> Note: `CommandBar` is currently mounted by `Topbar` with no providers. To wire
> live providers, lift them via a context/provider that `Topbar` reads, or expose
> a registration hook — coordinate before changing `Topbar`'s signature.

### 3.4 Detail drawer

Inspecting a single record (approval, run, contact) uses `Drawer`, not a new
route, to preserve the single scroll region:

```tsx
const [open, setOpen] = useState(false);
<Drawer open={open} onClose={() => setOpen(false)} title="…" footer={<…/>}>
  {/* record detail */}
</Drawer>
```

### 3.5 Tables

Use `TableContainer` for the frame and the `Table/THead/TBody/Tr/Th/Td`
primitives for consistent styling. Lane A owns the frame; you own the columns.

### 3.6 Design tokens

Style against **semantic** Tailwind tokens, never raw hex:
`bg-canvas`, `bg-surface`, `bg-surface-raised`, `border-line`,
`border-line-strong`, `text-foreground`, `text-muted`, `text-faint`,
`text-accent` / `bg-accent`, and status colors `success/warning/danger/info`.
Tokens are defined in `src/app/globals.css` and mapped in `tailwind.config.ts`.

### 3.7 Navigation

Routes are defined once in `src/lib/nav.ts` (`NAV_ITEMS`). To surface a live
count (e.g. pending approvals) set the `badge` field — the sidebar renders it
automatically. Don't hardcode nav links elsewhere; import from `nav.ts`.

---

## 4. Shared files touched (all new)

Configuration:
- `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`,
  `tailwind.config.ts`, `eslint.config.mjs`, `.gitignore`

Source (all under `src/`): see the directory map in §2.

Docs:
- `docs/handoffs/lane-a.md`

No existing files were modified outside this lane (the repo previously contained
only `hermes/` skills, which were left untouched).

---

## 5. Deliberately out of scope (downstream lanes)

- Live data / fetching for any route (overview metrics, queues, tables).
- Approval decision logic, run execution, meeting intelligence, audit stream.
- Integration connect/disconnect flows and provider status.
- Auth / session for the operator chip and notifications.

These have placeholders (`EmptyState`, `StatCard value="—"`, disabled buttons)
marking exactly where to plug in.
