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

/**
 * Padding (px) applied on every fit. Leaflet's fitBounds frames the
 * marker POINTS; a numbered pin extends 15px beyond its point and a
 * cluster badge 20px, so the old 24px padding left edge pins nearly
 * touching — and, once the map sized itself late, clipped at — the
 * frame. 56px keeps every badge visibly inside with margin to spare.
 */
export const FIT_PADDING_PX = 56;

/**
 * The bounds the map frames for a set: its fit bounds, or the
 * whole-Taiwan view when there is nothing to fit (an empty result
 * set). Before Phase A an empty set simply left the map wherever it
 * was — an audit caught it sitting on a wide South-East Asia view
 * after a no-match search; now a no-match search always returns the
 * visitor to Taiwan.
 */
export function frameBounds(set: MapMarkerSet): LatLngBounds {
  return fitBounds(set) ?? TAIWAN_BOUNDS;
}

// --- Clustering (large sets) ---
//
// Above NUMBERED_PIN_LIMIT the map used to draw one plain dot per
// place: at whole-Taiwan zoom the 242 dots pile onto the same few
// pixels in Kaohsiung and there is no way to see how many places a
// pile holds. Now large sets are grouped into clusters whose badges
// carry the count, so the counts on screen always add up to the
// size of the filtered set. The grouping is a pure function of the
// markers and the zoom, kept here (Leaflet-free) so the sums can be
// unit-checked; the component re-runs it whenever the zoom changes.

/** Pixel distance (at the current zoom) within which dots cluster. */
export const CLUSTER_RADIUS_PX = 56;

/** Deepest zoom a cluster tap fits to, so taps keep separating. */
export const CLUSTER_FIT_MAX_ZOOM = 17;

/** Web Mercator's latitude limit (the projection's square edge). */
const MAX_PROJECTED_LAT = 85.05112878;

/**
 * Project a coordinate to Web Mercator world pixel coordinates at a
 * zoom level (256px tiles) — the same space Leaflet positions tiles
 * and markers in, computed here so clustering needs no Leaflet.
 */
export function projectToPixels(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const clamped = Math.max(-MAX_PROJECTED_LAT, Math.min(MAX_PROJECTED_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: (scale * (lng + 180)) / 360,
    y: scale * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)),
  };
}

/** Inverse of projectToPixels. */
export function unprojectFromPixels(
  x: number,
  y: number,
  zoom: number
): LatLng {
  const scale = 256 * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI * (1 - (2 * y) / scale);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

export type MapClusterGroup = {
  /** The places in this group, in set order. */
  markers: MapMarker[];
  /** How many places the group holds (markers.length, named for use). */
  count: number;
  /** The group's centre: the mean of its members' positions. */
  lat: number;
  lng: number;
};

/**
 * Group markers into clusters at a zoom: each marker joins the
 * first existing cluster whose centre is within `radiusPx` screen
 * pixels (projected at that zoom), or starts a new cluster. Greedy
 * and order-stable — the same set at the same zoom always groups
 * identically. Every marker lands in exactly one group, so the
 * group counts sum to markers.length at any zoom; a group of one
 * is drawn as the plain dot it always was.
 */
export function clusterMarkers(
  markers: MapMarker[],
  zoom: number,
  radiusPx: number = CLUSTER_RADIUS_PX
): MapClusterGroup[] {
  type Working = {
    markers: MapMarker[];
    sumX: number;
    sumY: number;
  };
  const groups: Working[] = [];
  for (const marker of markers) {
    const point = projectToPixels(marker.lat, marker.lng, zoom);
    let target: Working | null = null;
    for (const group of groups) {
      const cx = group.sumX / group.markers.length;
      const cy = group.sumY / group.markers.length;
      const dx = point.x - cx;
      const dy = point.y - cy;
      if (dx * dx + dy * dy <= radiusPx * radiusPx) {
        target = group;
        break;
      }
    }
    if (!target) {
      target = { markers: [], sumX: 0, sumY: 0 };
      groups.push(target);
    }
    target.markers.push(marker);
    target.sumX += point.x;
    target.sumY += point.y;
  }
  return groups.map((group) => {
    const centre = unprojectFromPixels(
      group.sumX / group.markers.length,
      group.sumY / group.markers.length,
      zoom
    );
    return {
      markers: group.markers,
      count: group.markers.length,
      lat: centre.lat,
      lng: centre.lng,
    };
  });
}
