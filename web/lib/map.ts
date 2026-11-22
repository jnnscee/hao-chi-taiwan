// Pure marker logic for the rebuild's interactive map: turns the
// currently displayed set (tab + search + filters + sort, with display
// numbers assigned) into the marker set the Leaflet component draws.
// Kept free of Leaflet and React imports so the behaviour can be
// unit-checked in plain node against the real data, like lib/places.ts.

import type { LatLng, Place } from "./places";

/**
 * At or below this many results the map draws numbered pins (the number
 * matches the place's number in the list). Above it, small dots — the
 * full 242 would bury the map under badges.
 */
export const NUMBERED_PIN_LIMIT = 60;

export type MapMarker = {
  place: Place;
  /** The place's displayed list number (see assignDisplayNumbers). */
  number: number;
  kind: "numbered" | "dot";
  lat: number;
  lng: number;
};

/**
 * The visitor's own position, drawn as the distinct "you are here"
 * marker. `fit` says whether the position takes part in the fitted
 * bounds: true while Near me is filtering by a real range (the map
 * frames "you + what's near you"); false when the location is only
 * known for Nearest sorting, or the range is "Any distance" (framing
 * stays on the places themselves).
 */
export type MapUserPoint = LatLng & { fit: boolean };

export type MapMarkerSet = {
  markers: MapMarker[];
  /** Displayed places with no coordinates: they stay in the list only. */
  missingCoords: Place[];
  /** The visitor's position, or null when no location is known. */
  user: MapUserPoint | null;
};

export function buildMapMarkers(
  displayed: Place[],
  numbers: Map<string, number>,
  user: MapUserPoint | null = null
): MapMarkerSet {
  const kind: MapMarker["kind"] =
    displayed.length <= NUMBERED_PIN_LIMIT ? "numbered" : "dot";
  const markers: MapMarker[] = [];
  const missingCoords: Place[] = [];
  for (const place of displayed) {
    if (place.lat == null || place.lng == null) {
      missingCoords.push(place);
      continue;
    }
    markers.push({
      place,
      number: numbers.get(place.legacy_id) ?? 0,
      kind,
      lat: place.lat,
      lng: place.lng,
    });
  }
  return { markers, missingCoords, user };
}

/**
 * A stable identity for a marker set. It changes exactly when the set of
 * places (or a place's number/kind) changes, so the map component refits
 * the view only on a real set change — a Cards/Compact toggle or a plain
 * re-render produces the same signature and keeps the visitor's pan/zoom.
 */
export function markerSetSignature(set: MapMarkerSet): string {
  const placesPart = set.markers
    .map((m) => `${m.place.legacy_id}:${m.number}:${m.kind}`)
    .join("|");
  // A fitted user position is part of the view's identity: gaining one
  // (Near me switched on) refits once; a position known only for
  // sorting (fit: false) never moves the visitor's view.
  const userPart =
    set.user && set.user.fit
      ? `|u:${set.user.lat.toFixed(5)},${set.user.lng.toFixed(5)}`
      : "";
  return placesPart + userPart;
}

export type LatLngBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Bounds covering every marker, or null when there are none. */
export function markerBounds(markers: MapMarker[]): LatLngBounds | null {
  if (markers.length === 0) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const marker of markers) {
    if (marker.lat < south) south = marker.lat;
    if (marker.lat > north) north = marker.lat;
    if (marker.lng < west) west = marker.lng;
    if (marker.lng > east) east = marker.lng;
  }
  return { south, west, north, east };
}

/**
 * The bounds the map fits to for a set: the markers' bounds, extended
 * to include the visitor's position when it is a fitted point (Near me
 * with a real range). With no markers but a fitted position, the bounds
 * collapse to that point ("you are here, nothing near"). Null when
 * there is nothing to fit.
 */
export function fitBounds(set: MapMarkerSet): LatLngBounds | null {
  const bounds = markerBounds(set.markers);
  if (!set.user || !set.user.fit) return bounds;
  if (!bounds) {
    return {
      south: set.user.lat,
      west: set.user.lng,
      north: set.user.lat,
      east: set.user.lng,
    };
  }
  return {
    south: Math.min(bounds.south, set.user.lat),
    west: Math.min(bounds.west, set.user.lng),
    north: Math.max(bounds.north, set.user.lat),
    east: Math.max(bounds.east, set.user.lng),
  };
}

/** Whole-Taiwan view: the map's opening frame and empty-set fallback. */
export const TAIWAN_BOUNDS: LatLngBounds = {
  south: 21.9,
  west: 119.3,
  north: 25.3,
  east: 122.0,
};

/**
 * Cap applied when fitting a set's bounds, so a single place or a tight
 * cluster lands at street-district level rather than building level.
 */
export const FIT_MAX_ZOOM = 15;
