// components/brand/DealerWordmark.tsx
// The dealership's own brand for the public car-buyer site (Client Zero =
// BudgetWheels). A subtle "powered by" line keeps the platform attribution light.
import { PRODUCT } from '@/lib/copy';

export function DealerWordmark({ showPlatform = true }: { showPlatform?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 font-display text-sm font-bold text-navy-950">
        BW
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-ink-100">
          {PRODUCT.dealer}
        </span>
        {showPlatform && (
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400">
            Used Cars · Toronto
          </span>
        )}
      </span>
    </span>
  );
}
