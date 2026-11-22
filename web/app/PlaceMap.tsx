"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FIT_MAX_ZOOM,
  TAIWAN_BOUNDS,
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
// numbered pins at ≤60 results, dot markers above that, and refits to
// the set's bounds only when the set itself changes — panning/zooming
// and then toggling Cards/Compact does not move the visitor's view.

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

  function drawMarkers(L: typeof Leaflet, map: Leaflet.Map) {
    const layer = layerRef.current;
    if (!layer) return;
    const set = markerSetRef.current;
    // Replace, never accumulate: the layer is emptied on every draw.
    layer.clearLayers();
    for (const marker of set.markers) {
      if (marker.kind === "numbered") {
        const icon = L.divIcon({
          className: "map-pin-wrap",
          html: `<span class="map-pin">${marker.number}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        L.marker([marker.lat, marker.lng], { icon, keyboard: false })
          .on("click", () => onSelectRef.current(marker.place))
          .addTo(layer);
      } else {
        // Circle markers give the dot a tappable area larger than its
        // visible radius via the stroke; radius 8 reads clearly at
        // whole-Taiwan zoom without swamping the map.
        L.circleMarker([marker.lat, marker.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#7a4a12",
          fillOpacity: 0.9,
        })
          .on("click", () => onSelectRef.current(marker.place))
          .addTo(layer);
      }
    }
    // Refit only when the set's identity actually changed.
    const signature = markerSetSignature(set);
    if (signature !== fittedSignatureRef.current) {
      fittedSignatureRef.current = signature;
      const bounds = markerBounds(set.markers);
      if (bounds) {
        map.fitBounds(
          [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
          ],
          { padding: [24, 24], maxZoom: FIT_MAX_ZOOM }
        );
      }
      // Empty set: leave the map on its current (or whole-Taiwan) view.
    }
  }

  // Create the map once, on mount.
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      map = L.map(containerRef.current);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.fitBounds([
        [TAIWAN_BOUNDS.south, TAIWAN_BOUNDS.west],
        [TAIWAN_BOUNDS.north, TAIWAN_BOUNDS.east],
      ]);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      drawMarkers(L, map);
    })();
    return () => {
      cancelled = true;
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
    drawMarkers(L, map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerSet]);

  return <div ref={containerRef} className="place-map" />;
}
