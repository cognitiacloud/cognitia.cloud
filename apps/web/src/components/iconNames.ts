/**
 * Icon name union — kept in a `.ts` module (no JSX) so plain `.ts` files like
 * `nav.ts` can import the type without the root tsconfig (which globs `*.ts`
 * without `jsx`) trying to load a `.tsx` module.
 */
export type IconName =
  | 'overview'
  | 'approvals'
  | 'runs'
  | 'contacts'
  | 'meetings'
  | 'audit'
  | 'integrations'
  | 'settings'
  | 'search'
  | 'inbox'
  | 'alert'
  | 'shield'
  | 'plug';
