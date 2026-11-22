// Pure logic for Jenny's floating search button and its panel: the
// badge rule and the per-session close behaviour. Kept free of React
// and DOM imports so it can be unit-checked in plain node. The rules
// are the live app's own (its syncBadge / closeSearchPanel), lifted
// as-is — do not "improve" them here.

/**
 * The floating button's badge: the current result count, shown only
 * while the set is narrowed below the full set FOR THE CURRENT TAB
 * (the live app compares against the tab total, so merely switching
 * to the Recommended tab — 45 of 45 — shows no badge, while any
 * search, filter or Near me narrowing does). Returns null when the
 * badge is hidden.
 */
export function badgeCountFor(
  resultCount: number,
  tabTotal: number
): number | null {
  return resultCount < tabTotal ? resultCount : null;
}

/**
 * Whether a Clear all press marks the current panel session as
 * cleared. Only a press made while the panel is open counts (the
 * live app checks panelOpen); a press on the in-page controls never
 * marks anything, and the flag is sticky within the session — a
 * clear followed by re-filtering still counts as cleared.
 */
export function sessionClearedOnClearAll(
  panelOpen: boolean,
  alreadyCleared: boolean
): boolean {
  return alreadyCleared || panelOpen;
}

/** What closing the panel must do, decided by the session flag. */
export type PanelClosePlan = {
  /** Smooth-scroll the page back to the search area / list heading. */
  scrollOnClose: boolean;
  /** The panel reopens at its top next time instead of where it was left. */
  reopenAtTop: boolean;
};

/**
 * The close behaviour Jenny settled: if Clear all was pressed during
 * this panel session, closing is a fresh start — the page scrolls
 * back up and the panel reopens at its top. If it was not, closing
 * changes nothing: no page scroll, and the panel keeps its internal
 * scroll position for next time.
 */
export function planPanelClose(sessionCleared: boolean): PanelClosePlan {
  return { scrollOnClose: sessionCleared, reopenAtTop: sessionCleared };
}
