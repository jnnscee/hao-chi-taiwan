// Unit checks for lib/track.ts — the anonymous action counter
// (Jenny's stats approval, 2026-11-24). The helper's contract:
// exactly one fire-and-forget POST per call, carrying only the
// action and the place id; a skip when offline; and silence on
// every failure, so counting can never break the action counted.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const URL_VALUE = "https://example.supabase.co";
const KEY_VALUE = "publishable-test-key";

let fetchMock: ReturnType<typeof vi.fn>;

async function loadTrack() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_VALUE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY_VALUE);
  return import("../lib/track");
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("trackAction", () => {
  it("posts one bump for the action and place, with keepalive", async () => {
    const { trackAction } = await loadTrack();
    trackAction("save", "r12");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL_VALUE}/rest/v1/rpc/bump_action`);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual({
      p_action: "save",
      p_place_id: "r12",
    });
    expect(init.headers.apikey).toBe(KEY_VALUE);
  });

  it("sends a null place id when the action has no place", async () => {
    const { trackAction } = await loadTrack();
    trackAction("share");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_action: "share",
      p_place_id: null,
    });
  });

  it("skips entirely while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { trackAction } = await loadTrack();
    trackAction("save", "1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a rejected fetch — the call itself never throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { trackAction } = await loadTrack();
    expect(() => trackAction("directions", "1")).not.toThrow();
    // Let the rejection settle; an unhandled rejection would
    // fail the run on its own.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
