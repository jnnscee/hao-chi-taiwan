// Pure helpers for the place details view: directions / calendar
// links, deep-link parsing, the saved-places set and the hours-checked
// label. Kept free of React and browser globals (origin and "now" are
// passed in) so the behaviour can be unit-checked in plain node.
// (The "report a problem" flow lives in lib/contact.ts: it opens the
// Contact & feedback form pre-filled for the place.)

import type { Place } from "./places";
import type { Lang } from "./i18n";

export const SAVED_STORAGE_KEY = "hao-chi-saved-v1"; // same key as the live app
export const CONTACT_EMAIL = "haochitaiwan@muse.ai";

/** Google Maps directions to the place: coordinates first, address fallback. */
export function directionsUrl(place: Place): string {
  let destination: string;
  if (place.lat != null && place.lng != null) {
    destination = `${place.lat},${place.lng}`;
  } else {
    destination = place.address_en ?? place.name_en;
  }
  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination)
  );
}

/**
 * The shareable deep link for a place, carrying the sender's language so
 * the recipient lands in the same language, e.g.
 * "https://host/?place=r12&lang=zh" (mirrors the live app, whose share
 * links point at the language variant matching the current toggle).
 */
export function deepLinkFor(
  origin: string,
  legacyId: string,
  lang: Lang
): string {
  return (
    `${origin}/?place=${encodeURIComponent(legacyId)}` +
    `&lang=${encodeURIComponent(lang)}`
  );
}

/** Extract the ?place= id from a query string ("?place=r12&x=1"), or null. */
export function placeIdFromSearch(search: string): string | null {
  try {
    const id = new URLSearchParams(search).get("place");
    return id ? id : null;
  } catch {
    return null;
  }
}

/** Parse the stored saved-ids JSON; anything unusable becomes an empty set. */
export function parseSavedIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Toggle one id in the saved set. Pure: returns a new array. */
export function toggleSavedId(ids: string[], legacyId: string): string[] {
  return ids.includes(legacyId)
    ? ids.filter((id) => id !== legacyId)
    : [...ids, legacyId];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-11-20" -> "Nov 2026". Returns null for missing/invalid input. */
export function lastCheckedLabel(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return `${MONTHS[month - 1]} ${match[1]}`;
}

/**
 * The full "last checked" line in the current language, in the live
 * app's wording: EN "Last checked Nov 2026" (its hours_last_checked
 * string, with the month/year taken from the stored date) and ZH
 * "最後確認：2026 年 11 月". Returns null for missing/invalid input.
 */
export function lastCheckedText(
  isoDate: string | null,
  lang: Lang
): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  if (lang === "zh") return `最後確認：${match[1]} 年 ${month} 月`;
  return `Last checked ${MONTHS[month - 1]} ${match[1]}`;
}

/** Format a Date as Google Calendar's basic format in Asia/Taipei time. */
function formatTaipei(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return (
    `${get("year")}${get("month")}${get("day")}` +
    `T${get("hour")}${get("minute")}${get("second")}`
  );
}

/**
 * Google Calendar "add event" template link: a 1-hour event starting at
 * the next whole hour after `now`, titled with the place name, located at
 * the English address, in Asia/Taipei, with the deep link in the details.
 */
export function calendarUrl(
  place: Place,
  deepLink: string,
  now: Date,
  viewInLabel: string = "View in Hao Chi Taiwan"
): string {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const title = place.name_en || place.name_zh;
  const details = `${viewInLabel}: ${deepLink}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatTaipei(start)}/${formatTaipei(end)}`,
    ctz: "Asia/Taipei",
    location: place.address_en ?? "",
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
