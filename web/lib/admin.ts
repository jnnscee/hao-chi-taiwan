// Pure logic for the /admin place manager: who counts as the
// admin, the form <-> row mapping for the `places` and
// `place_internal` tables, and the next-free-legacy_id suggestion.
// No React and no Supabase imports, so the mapping can be
// unit-checked in plain node. The matching database rules live in
// the Supabase migration `admin_jenny_write_policies`: Row Level
// Security lets only this email write, whatever the UI does.

import type { Place } from "./places";
import { legacyNumber, matchesQuery } from "./places";

/** The one and only admin account. Visitors never have accounts. */
export const ADMIN_EMAIL = "jnnscee@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

/** A `places` row as the admin reads and writes it (id included). */
export type AdminPlaceRow = Place & { id: string };

/**
 * The manager's search: exactly the public search (matchesQuery in
 * lib/places.ts — the same SEARCH_FIELDS and the same
 * case-insensitive substring rule, so the two always agree) PLUS
 * the legacy_id, since this is an admin tool and Jenny looks places
 * up by ID. Jenny asked for the manager and public searches to
 * match after 'noodle' gave 4 in the manager vs 14 in the app.
 */
export function managerMatchesQuery(
  row: AdminPlaceRow,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (row.legacy_id.toLowerCase().includes(q)) return true;
  return matchesQuery(row, query);
}

/** A `place_internal` row — Jenny's working notes, never public. */
export type InternalRow = {
  place_id: string;
  confidence: string | null;
  check_status: number | null;
  notes: string | null;
};

/**
 * The edit form's state: every text/number/date field as a string
 * ("" = empty = NULL for the nullable columns), the two flags as
 * booleans. Mirrors the form inputs one-to-one.
 */
export type PlaceFormState = {
  legacy_id: string;
  list_type: "recommended" | "want_to_try";
  name_zh: string;
  name_en: string;
  name_rom: string;
  gloss: string;
  gloss_zh: string;
  cuisine: string;
  rating_value: string;
  rating_count: string;
  city: string;
  district: string;
  address_en: string;
  address_zh: string;
  lat: string;
  lng: string;
  maps_url: string;
  maps_short_url: string;
  phone: string;
  website: string;
  instagram: string;
  instagram_handle: string;
  facebook: string;
  hours: string;
  hours_note: string;
  hours_checked_on: string; // "yyyy-mm-dd" or ""
  visitor_notes: string;
  cash_only: boolean;
  temporarily_closed: boolean;
};

export type InternalFormState = {
  confidence: string;
  check_status: string; // integer as text, "" = none
  notes: string;
};

export function emptyPlaceForm(
  listType: "recommended" | "want_to_try",
  legacyId: string
): PlaceFormState {
  return {
    legacy_id: legacyId,
    list_type: listType,
    name_zh: "",
    name_en: "",
    name_rom: "",
    gloss: "",
    gloss_zh: "",
    cuisine: "",
    rating_value: "",
    rating_count: "",
    city: "",
    district: "",
    address_en: "",
    address_zh: "",
    lat: "",
    lng: "",
    maps_url: "",
    maps_short_url: "",
    phone: "",
    website: "",
    instagram: "",
    instagram_handle: "",
    facebook: "",
    hours: "",
    hours_note: "",
    hours_checked_on: "",
    visitor_notes: "",
    cash_only: false,
    temporarily_closed: false,
  };
}

const str = (v: string | null | undefined): string => v ?? "";
const num = (v: number | null | undefined): string =>
  v == null ? "" : String(v);

export function placeToForm(row: AdminPlaceRow): PlaceFormState {
  return {
    legacy_id: row.legacy_id,
    list_type: row.list_type,
    name_zh: row.name_zh,
    name_en: row.name_en,
    name_rom: str(row.name_rom),
    gloss: str(row.gloss),
    gloss_zh: str(row.gloss_zh),
    cuisine: str(row.cuisine),
    rating_value: num(row.rating_value),
    rating_count: num(row.rating_count),
    city: str(row.city),
    district: str(row.district),
    address_en: str(row.address_en),
    address_zh: str(row.address_zh),
    lat: num(row.lat),
    lng: num(row.lng),
    maps_url: str(row.maps_url),
    maps_short_url: str(row.maps_short_url),
    phone: str(row.phone),
    website: str(row.website),
    instagram: str(row.instagram),
    instagram_handle: str(row.instagram_handle),
    facebook: str(row.facebook),
    hours: str(row.hours),
    hours_note: str(row.hours_note),
    hours_checked_on: str(row.hours_checked_on),
    visitor_notes: str(row.visitor_notes),
    cash_only: row.cash_only,
    temporarily_closed: row.temporarily_closed,
  };
}

/** "" (after trimming) becomes NULL; a present value is trimmed. */
const orNull = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

const floatOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const intOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Form state -> the column payload for an INSERT or UPDATE on
 * `places` (everything except the row's uuid `id`, which is never
 * written from the form).
 */
export function formToPlaceRow(
  form: PlaceFormState
): Omit<AdminPlaceRow, "id"> {
  return {
    legacy_id: form.legacy_id.trim(),
    list_type: form.list_type,
    name_zh: form.name_zh.trim(),
    name_en: form.name_en.trim(),
    name_rom: orNull(form.name_rom),
    gloss: orNull(form.gloss),
    gloss_zh: orNull(form.gloss_zh),
    cuisine: form.cuisine.trim(),
    rating_value: floatOrNull(form.rating_value),
    rating_count: intOrNull(form.rating_count),
    city: orNull(form.city),
    district: orNull(form.district),
    address_en: orNull(form.address_en),
    address_zh: orNull(form.address_zh),
    lat: floatOrNull(form.lat),
    lng: floatOrNull(form.lng),
    maps_url: orNull(form.maps_url),
    maps_short_url: orNull(form.maps_short_url),
    phone: orNull(form.phone),
    website: orNull(form.website),
    instagram: orNull(form.instagram),
    instagram_handle: orNull(form.instagram_handle),
    facebook: orNull(form.facebook),
    hours: orNull(form.hours),
    hours_note: orNull(form.hours_note),
    hours_checked_on: orNull(form.hours_checked_on),
    visitor_notes: orNull(form.visitor_notes),
    cash_only: form.cash_only,
    temporarily_closed: form.temporarily_closed,
  };
}

export function internalToForm(row: InternalRow | null): InternalFormState {
  if (!row) return { confidence: "", check_status: "", notes: "" };
  return {
    confidence: str(row.confidence),
    check_status: num(row.check_status),
    notes: str(row.notes),
  };
}

export function formToInternalRow(
  form: InternalFormState,
  placeId: string
): InternalRow {
  return {
    place_id: placeId,
    confidence: orNull(form.confidence),
    check_status: intOrNull(form.check_status),
    notes: orNull(form.notes),
  };
}

/** True when the working-notes form holds anything worth saving. */
export function internalFormHasContent(form: InternalFormState): boolean {
  return (
    form.confidence.trim() !== "" ||
    form.check_status.trim() !== "" ||
    form.notes.trim() !== ""
  );
}

/**
 * The next free legacy_id for a list: Recommended ids are plain
 * numbers ("46" after "45"), Want to Try ids carry the r prefix
 * ("r200" after "r199"). One past the highest number in use.
 */
export function nextLegacyId(
  existingIds: string[],
  listType: "recommended" | "want_to_try"
): string {
  let max = 0;
  for (const id of existingIds) {
    if (listType === "recommended" && /^\d+$/.test(id)) {
      max = Math.max(max, legacyNumber(id));
    }
    if (listType === "want_to_try" && /^r\d+$/.test(id)) {
      max = Math.max(max, legacyNumber(id));
    }
  }
  return listType === "recommended" ? String(max + 1) : `r${max + 1}`;
}

/**
 * Validate the form before it goes near the database. Returns a
 * plain-language error, or null when the form is saveable. The
 * database enforces the rest (NOT NULL, the list_type check, the
 * unique legacy_id) and RLS decides who may write at all.
 */
export function validatePlaceForm(
  form: PlaceFormState,
  existingIds: string[],
  editingLegacyId: string | null
): string | null {
  const legacyId = form.legacy_id.trim();
  if (form.list_type === "recommended" && !/^\d+$/.test(legacyId)) {
    return "A Recommended place's ID is a plain number, like 46.";
  }
  if (form.list_type === "want_to_try" && !/^r\d+$/.test(legacyId)) {
    return "A Want to Try place's ID is r plus a number, like r200.";
  }
  if (legacyId !== editingLegacyId && existingIds.includes(legacyId)) {
    return `ID ${legacyId} is already used by another place.`;
  }
  if (form.name_zh.trim() === "") return "The Chinese name is required.";
  if (form.name_en.trim() === "") return "The English name is required.";
  if (form.cuisine.trim() === "") return "The cuisine is required.";
  const numericFields: Array<[string, string]> = [
    ["Google rating", form.rating_value],
    ["Rating count", form.rating_count],
    ["Latitude", form.lat],
    ["Longitude", form.lng],
  ];
  for (const [label, value] of numericFields) {
    if (value.trim() !== "" && !Number.isFinite(Number(value.trim()))) {
      return `${label} must be a number, or left empty.`;
    }
  }
  return null;
}

export function validateInternalForm(form: InternalFormState): string | null {
  const cs = form.check_status.trim();
  if (cs !== "" && !Number.isFinite(Number(cs))) {
    return "Check status must be a whole number, or left empty.";
  }
  return null;
}
