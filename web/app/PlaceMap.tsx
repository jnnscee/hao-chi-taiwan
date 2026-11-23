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
//
// A fit is only ever computed against a settled size: if the
// container has not reached its real size when a fit comes due (the
// map sits below the fold while the page settles), the fit is queued
// rather than computed against the wrong size, and a ResizeObserver
// plus the settle remedies land it — or re-apply the current fit
// exactly once — when the size corrects. A fit computed against an
// unsettled size zooms to an extreme and strands the map there,
// because Leaflet's own size corrections only pan, never refit.
//
// Wheel zoom is click-to-activate: with Leaflet's default
// scrollWheelZoom, a desktop visitor scrolling down the page with
// the pointer over the map has the wheel captured by the map — the
// page scroll stalls and the map zooms itself away from its framing
// (the confirmed cause of the 2026-11-23 live failure; programmatic
// test scrolls never produce wheel events, which is why the sandbox
// could not see it). So the map is created with scrollWheelZoom off,
// a click/tap into the map (or keyboard focus) turns it on, and the
// pointer leaving the map (or the map losing focus) turns it off
// again. Touch pinch zoom and drag pan are separate Leaflet
// handlers and are never gated.

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
  // Fit bookkeeping for the size gate below: a fit is only ever
  // computed against a SETTLED size, and a later material size
  // correction re-applies the current set's fit exactly once.
  // lastFitRef records what was fitted and at what container size;
  // pendingFitRef marks a fit that is waiting for a settled size;
  // userMovedRef records that the visitor has taken over the view
  // (drag, zoom, cluster tap), after which a size correction must
  // never yank the view back to a fit.
  const lastFitRef = useRef<{
    signature: string;
    width: number;
    height: number;
  } | null>(null);
  const pendingFitRef = useRef(false);
  const userMovedRef = useRef(false);
  const lastFitAtRef = useRef(0);
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

  // A size is settled when the container has a real size, the padded
  // viewport (size minus the fit padding on both sides) is still
  // positive — a fit computed against a zero/negative viewport zooms
  // to an extreme and strands the map there — and Leaflet's cached
  // size agrees with the container's actual size.
  function sizeSettled(map: Leaflet.Map): boolean {
    const container = containerRef.current;
    if (!container) return false;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= FIT_PADDING_PX * 2 || height <= FIT_PADDING_PX * 2) {
      return false;
    }
    const size = map.getSize();
    return Math.abs(size.x - width) <= 1 && Math.abs(size.y - height) <= 1;
  }

  // Fit the current set, but only against a settled size. When the
  // size is not settled the fit is queued (pendingFitRef) instead of
  // computed — the settle remedies and the ResizeObserver below retry
  // it until it lands. Returns whether the fit was applied.
  function applyFit(map: Leaflet.Map, set: MapMarkerSet): boolean {
    if (!sizeSettled(map)) {
      // Leaflet's cached size may simply be stale; re-measuring now
      // can settle it immediately.
      map.invalidateSize();
      if (!sizeSettled(map)) {
        pendingFitRef.current = true;
        return false;
      }
    }
    pendingFitRef.current = false;
    // frameBounds falls back to whole Taiwan for an empty set, so a
    // no-match search returns the visitor to the island instead of
    // leaving the map wherever it happened to be.
    const bounds = frameBounds(set);
    // Timestamp BEFORE the call: the fit's zoom animation fires
    // zoomstart a frame later, and the gesture guard below must not
    // mistake our own fit for the visitor taking over the view.
    lastFitAtRef.current = performance.now();
    map.fitBounds(
      [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      { padding: [FIT_PADDING_PX, FIT_PADDING_PX], maxZoom: FIT_MAX_ZOOM }
    );
    const container = containerRef.current;
    lastFitRef.current = {
      signature: markerSetSignature(set),
      width: container?.clientWidth ?? 0,
      height: container?.clientHeight ?? 0,
    };
    fittedSignatureRef.current = lastFitRef.current.signature;
    return true;
  }

  // Called after every size re-measurement (the settle remedies and
  // the ResizeObserver): if a fit is still pending, land it now that
  // the size may have settled; otherwise, if the container's size has
  // materially changed since the current fit was computed and the
  // visitor has not taken over the view, re-apply the current set's
  // fit exactly once at the corrected size.
  function refitAfterResize(map: Leaflet.Map) {
    if (pendingFitRef.current) {
      if (sizeSettled(map)) applyFit(map, markerSetRef.current);
      return;
    }
    const last = lastFitRef.current;
    const container = containerRef.current;
    if (!last || !container || userMovedRef.current) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (Math.abs(width - last.width) > 2 || Math.abs(height - last.height) > 2) {
      applyFit(map, markerSetRef.current);
    }
  }

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
      // (Nullish, not ||: zoom 0 is a real zoom and must not be
      // silently regrouped as zoom 8.)
      const zoom = map.getZoom() ?? 8;
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
              // The visitor is steering the view now; a later size
              // correction must not undo this tap with a set refit.
              userMovedRef.current = true;
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
    // regrouping) must never move the visitor's view. A fit that is
    // still pending (queued behind an unsettled size) is retried on
    // every set-driven draw until it lands.
    if (!refit) return;
    const signature = markerSetSignature(set);
    if (signature !== fittedSignatureRef.current || pendingFitRef.current) {
      applyFit(map, set);
    }
  }

  // Create the map once, on mount.
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    let containerEl: HTMLDivElement | null = null;
    let onContainerLeave: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    // Every size re-measurement also gives a queued or size-invalidated
    // fit its chance to land at the corrected size.
    const remeasure = () => {
      if (!map) return;
      map.invalidateSize();
      refitAfterResize(map);
    };
    const onWindowLoad = () => remeasure();
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      containerEl = containerRef.current;
      // scrollWheelZoom off at creation (see the header note): page
      // scrolling must never be captured by the map. It is switched
      // on only while the visitor is deliberately engaged with the
      // map, by the activation wiring right below.
      map = L.map(containerEl, { scrollWheelZoom: false });
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
      // Once the visitor drags or zooms the view is theirs: a later
      // size correction must not re-apply a fit over their view. Our
      // own fits fire zoomstart too (from the zoom animation, shortly
      // after the fit call), so zooms that begin within a beat of a
      // fit are not counted as the visitor's.
      map.on("dragstart", () => {
        userMovedRef.current = true;
      });
      map.on("zoomstart", () => {
        if (performance.now() - lastFitAtRef.current > 600) {
          userMovedRef.current = true;
        }
      });
      // Click-to-activate wheel zoom: a click/tap into the map (the
      // map click also fires for badge taps, which is fine — that is
      // deliberate engagement) or keyboard focus on the map turns
      // wheel zoom on; the pointer leaving the container or the map
      // losing focus turns it off again, so a wheel that merely
      // passes over the map while page-scrolling can never zoom it.
      // Only the wheel handler is gated — touchZoom and dragging
      // stay enabled throughout.
      const activateWheel = () => {
        map?.scrollWheelZoom.enable();
      };
      const deactivateWheel = () => {
        map?.scrollWheelZoom.disable();
      };
      map.on("click", activateWheel);
      map.on("focus", activateWheel);
      map.on("blur", deactivateWheel);
      onContainerLeave = deactivateWheel;
      containerEl.addEventListener("mouseleave", onContainerLeave);
      // Pre-frame Taiwan only if the size is already settled; the
      // draw below applies the real (gated) set fit either way, and a
      // queued fit lands via the remedies below once the size settles.
      // Timestamped like every programmatic fit, so its zoomstart is
      // not mistaken for a visitor gesture.
      if (sizeSettled(map)) {
        lastFitAtRef.current = performance.now();
        map.fitBounds([
          [TAIWAN_BOUNDS.south, TAIWAN_BOUNDS.west],
          [TAIWAN_BOUNDS.north, TAIWAN_BOUNDS.east],
        ]);
      }
      drawMarkers(L, map, true);
      // Grey-hole remedies: the map sits below the list, and the page
      // around it is still settling when it first sizes itself
      // (fonts, the hero photo, the list's first batch) — a size
      // Leaflet measured early leaves unpainted strips where tiles
      // were never requested. Re-measure once the page has settled,
      // again when it finishes loading, and whenever the map scrolls
      // into view; invalidateSize is cheap and idempotent.
      map.whenReady(() => {
        requestAnimationFrame(() => remeasure());
      });
      settleTimer = setTimeout(() => remeasure(), 400);
      window.addEventListener("load", onWindowLoad);
      if (containerRef.current && "IntersectionObserver" in window) {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              remeasure();
            }
          },
          { rootMargin: "200px" }
        );
        observer.observe(containerRef.current);
      }
      // The direct watch: any change to the container's own size —
      // the page settling, a window resize, a layout shift — re-
      // measures Leaflet and gives the fit machinery its chance to
      // land a queued fit or re-apply the current fit exactly once at
      // the corrected size. (invalidateSize never changes the
      // container's own size, so this cannot loop.)
      if (containerRef.current && "ResizeObserver" in window) {
        let raf = 0;
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => remeasure());
        });
        resizeObserver.observe(containerRef.current);
      }
    })();
    return () => {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      if (containerEl && onContainerLeave) {
        containerEl.removeEventListener("mouseleave", onContainerLeave);
      }
      window.removeEventListener("load", onWindowLoad);
      if (observer) observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      if (map) map.remove();
      leafletRef.current = null;
      mapRef.current = null;
      layerRef.current = null;
      fittedSignatureRef.current = null;
      lastFitRef.current = null;
      pendingFitRef.current = false;
      userMovedRef.current = false;
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
