// Anonymous action counters — Layer 2 of the stats Jenny
// approved on 2026-11-24 (Layer 1 is Vercel's cookieless visit
// counts, see app/WebAnalytics.tsx).
//
// When a visitor taps Save, Share, Add to calendar or one of the
// Get-directions modes, this fires ONE fire-and-forget call to
// the `bump_action` Postgres function, which adds 1 to that
// action's total for the current UTC day and place in the
// `action_counts` table. That is the whole design:
//
//  - Aggregates only: day, action, place id, count. No user or
//    device identifiers, no IP/UA captured by our code, no
//    timestamps finer than the day, no search terms, no text.
//  - The table itself is unreachable with the publishable key
//    (RLS on, no policies, no grants); the SECURITY DEFINER
//    function is the only door, and it validates the action
//    against a fixed allowlist and the place id against the
//    places table.
//  - Counting must never get in the visitor's way: the call is
//    not awaited, failures are swallowed, and when the browser
//    says it is offline the call is skipped entirely (the app
//    is offline-first; a missed count is fine, a queued replay
//    is not wanted). The service worker never intercepts it —
//    it is a POST to Supabase, and sw.js is network-only for
//    both of those.
//
// A raw fetch (with keepalive, so a tap that opens Google Maps
// or Calendar in a new tab still lands) instead of the Supabase
// client keeps supabase-js out of the public pages' bundle.

export type TrackAction =
  | "save"
  | "unsave"
  | "share"
  | "calendar"
  | "directions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function trackAction(
  action: TrackAction,
  placeId?: string | null
): void {
  try {
    if (!supabaseUrl || !supabasePublishableKey) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void fetch(`${supabaseUrl}/rest/v1/rpc/bump_action`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_action: action,
        p_place_id: placeId ?? null,
      }),
      keepalive: true,
    }).catch(() => {
      // Counting is best-effort: a failed count changes nothing.
    });
  } catch {
    // Never let counting break the action it counts.
  }
}
