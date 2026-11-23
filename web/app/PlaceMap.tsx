"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CLUSTER_FIT_MAX_ZOOM,
  FIT_MAX_ZOOM,
  FIT_PADDING_PX,
  TAIWAN_BOUNDS,
  clusterMarkers,
  frameBounds,
  markerBounds,
  markerSetSignature,
  type MapMarkerSet,
} from "@/lib/map";
import type { Place } from "@/lib/places";

// The real interactive map: Leaflet with OpenStreetMap tiles (the tile
// source the live app already discloses on its privacy page). This
// component is only ever imported via next/dynamic with ssr:false from
// PlaceBrowser, so Leaflet — which needs `window` — never runs during
// the server render or the static prerender. Plain Leaflet in effects,
// no react-leaflet.
//
// The map draws the CURRENT filtered set (the same places as the list):
// numbered pins at ≤60 results; above that, places group into count
// badges (clusters) that separate as the visitor zooms in, with any
// ungrouped place drawn as the plain dot it always was — the badge
// counts plus the dots always add up to the set's size. The view fits
// the set's frame (with generous padding, and whole Taiwan for an
// empty set) only when the set itself changes — panning/zooming and
// then toggling Cards/Compact does not move the visitor's view.

type PlaceMapProps = {
  markerSet: MapMarkerSet;
  onSelect: (place: Place) => void;
};

export default function PlaceMap({ markerSet, onSelect }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const fittedSignatureRef = useRef<string | null>(null);
  // Latest props, readable from the Leaflet callbacks and effects below
  // without re-creating the map.
  const markerSetRef = useRef(markerSet);
  const onSelectRef = useRef(onSelect);

  // Keep the refs current (declared first so they run before the
  // marker-update effect below).
  useEffect(() => {
    markerSetRef.current = markerSet;
    onSelectRef.current = onSelect;
  });

  function drawMarkers(L: typeof Leaflet, map: Leaflet.Map, refit: boolean) {
    const layer = layerRef.current;
    if (!layer) return;
    const set = markerSetRef.current;
    // Replace, never accumulate: the layer is emptied on every draw.
    layer.clearLayers();
    if (set.markers.length > 0 && set.markers[0].kind === "numbered") {
      for (const marker of set.markers) {
        const icon = L.divIcon({
          className: "map-pin-wrap",
          html: `<span class="map-pin">${marker.number}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        L.marker([marker.lat, marker.lng], { icon, keyboard: false })
          .on("click", () => onSelectRef.current(marker.place))
          .addTo(layer);
      }
    } else if (set.markers.length > 0) {
      // Large set: group the dots at the current zoom. A group of one
      // is drawn as the plain dot; a larger group as a count badge
      // whose tap fits the group's own bounds, so taps keep
      // separating clusters as the visitor dives in. getZoom is only
      // unset before the first fit, which the mount effect performs
      // before the first draw — the fallback is whole-Taiwan zoom.
      const zoom = map.getZoom() || 8;
      for (const group of clusterMarkers(set.markers, zoom)) {
        if (group.count === 1) {
          const marker = group.markers[0];
          // Circle markers give the dot a tappable area larger than
          // its visible radius via the stroke; radius 8 reads clearly
          // at whole-Taiwan zoom without swamping the map.
          L.circleMarker([marker.lat, marker.lng], {
            radius: 8,
            color: "#ffffff",
            weight: 2,
            fillColor: "#7a4a12",
            fillOpacity: 0.9,
          })
            .on("click", () => onSelectRef.current(marker.place))
            .addTo(layer);
        } else {
          const icon = L.divIcon({
            className: "map-cluster-wrap",
            html: `<span class="map-cluster">${group.count}</span>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          L.marker([group.lat, group.lng], { icon, keyboard: false })
            .on("click", () => {
              const bounds = markerBounds(group.markers);
              if (!bounds) return;
              map.fitBounds(
                [
                  [bounds.south, bounds.west],
                  [bounds.north, bounds.east],
                ],
                {
                  padding: [FIT_PADDING_PX, FIT_PADDING_PX],
                  maxZoom: CLUSTER_FIT_MAX_ZOOM,
                }
              );
            })
            .addTo(layer);
        }
      }
    }
    // The visitor's own position, when known: a distinct blue dot,
    // drawn last so it sits above the place markers. Not interactive —
    // it is not a place.
    if (set.user) {
      const icon = L.divIcon({
        className: "map-you-wrap",
        html: '<span class="map-you"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker([set.user.lat, set.user.lng], {
        icon,
        keyboard: false,
        interactive: false,
      }).addTo(layer);
    }
    // Refit only when the set's identity actually changed, and only
    // on a set-driven draw — a zoom-driven redraw (clusters
    // regrouping) must never move the visitor's view.
    if (!refit) return;
    const signature = markerSetSignature(set);
    if (signature !== fittedSignatureRef.current) {
      fittedSignatureRef.current = signature;
      // frameBounds falls back to whole Taiwan for an empty set, so a
      // no-match search returns the visitor to the island instead of
      // leaving the map wherever it happened to be.
      const bounds = frameBounds(set);
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [FIT_PADDING_PX, FIT_PADDING_PX], maxZoom: FIT_MAX_ZOOM }
      );
    }
  }

  // Create the map once, on mount.
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    let observer: IntersectionObserver | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const onWindowLoad = () => map?.invalidateSize();
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      map = L.map(containerRef.current);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        // Rapid-zoom hardening: with the default (updateWhenZooming
        // on), every frame of every queued zoom animation discards
        // the current tiles and requests the next level's, and on a
        // slow connection the pane can be left showing bare
        // background long after the zooms settle — the audit's
        // "solid blank" after four fast zoom-ins. Keeping the current
        // tiles (scaled) until the zoom ends, then loading the new
        // level once, removes the thrash; a deeper keepBuffer means
        // the pane is never bare while those tiles arrive.
        updateWhenZooming: false,
        keepBuffer: 4,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Clusters regroup with the zoom; the numbered pins don't
      // depend on it. A zoom-driven redraw never refits.
      map.on("zoomend", () => {
        if (!map || !leafletRef.current) return;
        const set = markerSetRef.current;
        if (set.markers.length > 0 && set.markers[0].kind === "dot") {
          drawMarkers(leafletRef.current, map, false);
        }
      });
      map.fitBounds([
        [TAIWAN_BOUNDS.south, TAIWAN_BOUNDS.west],
        [TAIWAN_BOUNDS.north, TAIWAN_BOUNDS.east],
      ]);
      drawMarkers(L, map, true);
      // Grey-hole remedies: the map sits below the list, and the page
      // around it is still settling when it first sizes itself
      // (fonts, the hero photo, the list's first batch) — a size
      // Leaflet measured early leaves unpainted strips where tiles
      // were never requested. Re-measure once the page has settled,
      // again when it finishes loading, and whenever the map scrolls
      // into view; invalidateSize is cheap and idempotent.
      map.whenReady(() => {
        requestAnimationFrame(() => map?.invalidateSize());
      });
      settleTimer = setTimeout(() => map?.invalidateSize(), 400);
      window.addEventListener("load", onWindowLoad);
      if (containerRef.current && "IntersectionObserver" in window) {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              map?.invalidateSize();
            }
          },
          { rootMargin: "200px" }
        );
        observer.observe(containerRef.current);
      }
    })();
    return () => {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      window.removeEventListener("load", onWindowLoad);
      if (observer) observer.disconnect();
      if (map) map.remove();
      leafletRef.current = null;
      mapRef.current = null;
      layerRef.current = null;
      fittedSignatureRef.current = null;
    };
    // Mount-only: later set changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when the filtered set changes. If Leaflet has not loaded yet
  // this is a no-op — the mount effect draws the latest set on arrival.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    drawMarkers(L, map, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerSet]);

  return <div ref={containerRef} className="place-map" />;
}
