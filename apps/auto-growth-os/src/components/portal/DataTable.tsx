// components/portal/DataTable.tsx
// Minimal generic table styled like the dashboard LeadTable. Server-safe.
import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  empty = 'Nothing here yet.',
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-xs uppercase tracking-wider text-ink-500">
              {columns.map((c) => (
                <th key={c.header} className={`px-4 py-3 font-medium ${c.className ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getKey(row)}
                className="border-b border-line last:border-0 hover:bg-surface-2"
              >
                {columns.map((c) => (
                  <td
                    key={c.header}
                    className={`px-4 py-3.5 align-top text-ink-300 ${c.className ?? ''}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-ink-400">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
