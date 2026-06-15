import { Icon } from './Icon';

/**
 * Top command/search bar. The input is a presentational affordance in this phase
 * (command palette wiring is a later slice); it never fabricates results.
 */
export function TopBar() {
  return (
    <div className="topbar">
      <div className="cmd">
        <Icon name="search" style={{ width: 15, height: 15 }} />
        <input
          type="text"
          placeholder="Search runs, contacts, meetings…"
          aria-label="Search"
          disabled
        />
        <kbd>⌘K</kbd>
      </div>
      <div className="topbar-spacer" />
      <span className="chip neutral">Pilot · internal</span>
    </div>
  );
}
