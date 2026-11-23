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
// A set-change fit is never trusted to Leaflet's animated path —
// it is issued synchronously (animate: false), deferred while a
// zoom animation is in flight, and afterwards VERIFIED. Leaflet's
// animated setView is
// fire-and-forget: inside its animated band (zoom delta within
// zoomAnimationThreshold, zoom origin within one screen) it defers
// the whole view change to a single requestAnimationFrame callback
// — which a frame-starved renderer (an occluded or agent-driven
// browser, composited scrolling that never runs a main frame) may
// never deliver — and when a zoom animation is already in flight
// it silently DROPS the request, returning as if it had complied.
// The 2026-11-23 live failure was exactly this: the pins redrew for
// the searched set while the view stayed on the old frame, and
// because the fit had been recorded as applied, no retry ever
// fired. So set-change fits are issued two ways, neither of which
// trusts the call: with animate: false when no zoom animation is
// running (setView then resets the view synchronously, before
// fitBounds returns — it cannot defer), and DEFERRED through the
// pending-fit mechanism when one is (the drop check precedes the
// animate check in Leaflet, and nothing can cancel a zoom
// animation mid-flight; the fit retries on the animation's own
// zoomend and on a plain timer until the view is free). Either
// way, the landed fit's centre/zoom are recorded so the settle
// remedies and two plain timers can verify the view actually
// arrived and re-apply it if anything ever swallows one anyway.
// A set change ALWAYS ends with the map framed on the new
// set: regardless of whether the map is on- or off-screen, and
// regardless of size-settle state (a queued fit lands via the
// pending retries). The visitor-owned guard below may only ever
// suppress these verification/size-correction refits — never the
// set-change fit itself.
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
  // view ownership is tracked by the timestamps further below.
  const lastFitRef = useRef<{
    signature: string;
    width: number;
    height: number;
    /** The view the fit produced, read back from the map right
     * after the (synchronous) fitBounds returned: the expectation
     * the fit verification below checks the real view against. */
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const pendingFitRef = useRef(false);
  // View ownership, as timestamps: userMovedAtRef records when the
  // visitor last took over the view (drag, zoom, cluster tap);
  // fitAtRef records when the latest fit was applied. The visitor
  // owns the view only against fits from BEFORE their gesture — a
  // gesture that predates a set-change fit must not suppress that
  // fit's verification (the gesture's own zoom animation can still
  // be in flight when the fit lands, and its completion callback
  // would otherwise drag the view back to the animation's target),
  // while any gesture after a fit suppresses verification and
  // size-correction refits, as it should.
  const userMovedAtRef = useRef(0);
  const fitAtRef = useRef(0);
  const visitorOwnsView = () => userMovedAtRef.current > fitAtRef.current;
  // True only during the synchronous body of one of our own fits:
  // a fit's own zoomstart fires inside that window, so a zoomstart
  // observed outside it is the visitor's (or another animation's),
  // never our fit's. (This replaces a 600ms timing beat that tried
  // to guess the same distinction for animated fits and misjudged
  // it more than once; synchronous fits make it exact.)
  const fitSyncRef = useRef(false);
  // The fit-verification timers (plain setTimeout — they fire
  // regardless of animation frames).
  const verifyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The one-shot retry for a fit deferred behind an in-flight zoom
  // animation (see applyFit).
  const fitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Fit the current set, but only against a settled size and never
  // into an in-flight zoom animation. When the size is not settled,
  // or a zoom animation is running, the fit is queued
  // (pendingFitRef) instead of computed — the settle remedies, the
  // ResizeObserver, the animation's own zoomend and a plain timer
  // retry it until it lands. Returns whether the fit was applied.
  //
  // The fit itself is SYNCHRONOUS (animate: false — see the header
  // note): Leaflet's animated setView can defer the view change to
  // an animation frame that never comes, or silently drop it when a
  // zoom animation is already in flight, while reporting success
  // either way. A synchronous fit stops any in-flight animation and
  // resets the view before fitBounds returns, so the centre/zoom
  // read back immediately afterwards ARE the fitted view — and are
  // recorded for the verification below.
  // Whether a zoom animation is currently in flight. Leaflet marks
  // the whole duration by putting its zoom-animation class on the
  // map pane (and removes it before firing zoomend) — a public,
  // observable signal for a state that decides whether a fitBounds
  // would be silently discarded: _tryAnimatedZoom returns
  // "handled" at once while a zoom animation is running, BEFORE it
  // ever looks at the animate option, and no Leaflet API cancels a
  // zoom animation mid-flight. So a fit due during one is never
  // issued into the void — it is deferred (the pending mechanism)
  // and retried when the animation ends.
  function zoomAnimationInFlight(map: Leaflet.Map): boolean {
    return !!map.getContainer().querySelector(".leaflet-zoom-anim");
  }

  // Retry a deferred fit on plain passage of time: a zoom
  // animation runs 250ms, so a 400ms beat lands after it — and
  // timers fire even in a frame-starved renderer, where the
  // zoomend trigger below might be the only other retry that
  // demonstrably fires. Each retry re-arms while an animation is
  // still in flight (a visitor mid-pinch, say), so the fit lands
  // the moment the view is free.
  function scheduleFitRetry(map: Leaflet.Map) {
    if (fitRetryTimerRef.current) clearTimeout(fitRetryTimerRef.current);
    fitRetryTimerRef.current = setTimeout(() => {
      fitRetryTimerRef.current = null;
      if (mapRef.current === map && pendingFitRef.current) {
        applyFit(map, markerSetRef.current);
      }
    }, 400);
  }

  function applyFit(
    map: Leaflet.Map,
    set: MapMarkerSet,
    scheduleVerify = true
  ): boolean {
    if (zoomAnimationInFlight(map)) {
      pendingFitRef.current = true;
      scheduleFitRetry(map);
      return false;
    }
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
    if (fitRetryTimerRef.current) {
      clearTimeout(fitRetryTimerRef.current);
      fitRetryTimerRef.current = null;
    }
    // frameBounds falls back to whole Taiwan for an empty set, so a
    // no-match search returns the visitor to the island instead of
    // leaving the map wherever it happened to be.
    const bounds = frameBounds(set);
    // The fit's own zoomstart fires synchronously inside this call;
    // the flag tells the gesture guard below not to mistake it for
    // the visitor taking over the view.
    fitSyncRef.current = true;
    try {
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        {
          padding: [FIT_PADDING_PX, FIT_PADDING_PX],
          maxZoom: FIT_MAX_ZOOM,
          animate: false,
        }
      );
    } finally {
      fitSyncRef.current = false;
    }
    const container = containerRef.current;
    const centre = map.getCenter();
    lastFitRef.current = {
      signature: markerSetSignature(set),
      width: container?.clientWidth ?? 0,
      height: container?.clientHeight ?? 0,
      lat: centre?.lat ?? 0,
      lng: centre?.lng ?? 0,
      zoom: map.getZoom() ?? 0,
    };
    fittedSignatureRef.current = lastFitRef.current.signature;
    fitAtRef.current = performance.now();
    if (scheduleVerify) scheduleFitVerification(map);
    return true;
  }

  // The fit verification: if the map's actual view is not the view
  // the current set's fit produced, re-apply that fit. Synchronous
  // fits make this a formality — it exists so that no present or
  // future swallow in the view machinery (a deferred animation, a
  // stale gesture animation landing after our fit) can ever leave a
  // set change unframed: the check runs on every size re-measurement
  // (the settle remedies, the ResizeObserver, and scroll-into-view
  // via the IntersectionObserver — all triggers that demonstrably
  // fire in the live sequence) and on plain timers after each fit
  // (timers fire regardless of animation frames). It never touches
  // a visitor-owned view: a drag, zoom or cluster tap AFTER the fit
  // suppresses it, exactly as it suppresses size-correction refits —
  // but a gesture from BEFORE the fit does not (see the ownership
  // timestamps below: that gesture's animation may be what moved
  // the view away). It also stands down while a
  // fit is queued behind an unsettled size (the pending retries own
  // that case) and when the recorded fit belongs to an older set.
  function verifyFit(map: Leaflet.Map) {
    const last = lastFitRef.current;
    if (!last || pendingFitRef.current || visitorOwnsView()) return;
    if (last.signature !== markerSetSignature(markerSetRef.current)) return;
    const centre = map.getCenter();
    const zoom = map.getZoom();
    if (!centre || zoom === undefined) return;
    if (
      Math.abs(zoom - last.zoom) > 0.001 ||
      Math.abs(centre.lat - last.lat) > 0.0001 ||
      Math.abs(centre.lng - last.lng) > 0.0001
    ) {
      applyFit(map, markerSetRef.current, false);
    }
  }

  // After each fit, check at two plain-timer beats that the view
  // really arrived (and stayed). Re-scheduling replaces the
  // previous fit's timers; unmount clears them.
  function scheduleFitVerification(map: Leaflet.Map) {
    for (const timer of verifyTimersRef.current) clearTimeout(timer);
    verifyTimersRef.current = [600, 1800].map((delay) =>
      setTimeout(() => {
        if (mapRef.current === map) verifyFit(map);
      }, delay)
    );
  }

  // Called after every size re-measurement (the settle remedies and
  // the ResizeObserver): if a fit is still pending, land it now that
  // the size may have settled; otherwise, if the container's size has
  // materially changed since the current fit was computed and the
  // visitor has not taken over the view, re-apply the current set's
  // fit exactly once at the corrected size; and in all cases give
  // the fit verification its chance to catch a swallowed fit.
  function refitAfterResize(map: Leaflet.Map) {
    if (pendingFitRef.current) {
      if (sizeSettled(map)) applyFit(map, markerSetRef.current);
      return;
    }
    const last = lastFitRef.current;
    const container = containerRef.current;
    if (!last || !container || visitorOwnsView()) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (Math.abs(width - last.width) > 2 || Math.abs(height - last.height) > 2) {
      applyFit(map, markerSetRef.current);
      return;
    }
    verifyFit(map);
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
              userMovedAtRef.current = performance.now();
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
      // depend on it. A zoom-driven redraw never refits. And a fit
      // that was deferred behind THIS animation gets its retry the
      // moment the animation ends (Leaflet has already removed its
      // zoom-animation class by the time zoomend fires, so the
      // retry's own in-flight check passes).
      map.on("zoomend", () => {
        if (!map || !leafletRef.current) return;
        const set = markerSetRef.current;
        if (set.markers.length > 0 && set.markers[0].kind === "dot") {
          drawMarkers(leafletRef.current, map, false);
        }
        if (pendingFitRef.current) {
          applyFit(map, markerSetRef.current);
        }
      });
      // Once the visitor drags or zooms the view is theirs: a later
      // size correction (or fit verification) must not re-apply a
      // fit over their view. Our own fits are synchronous and fire
      // their zoomstart inside the fit call itself (fitSyncRef is
      // set for exactly that window), so any zoomstart observed
      // outside it — a zoom button, the wheel, a pinch, a cluster
      // tap's animation — is the visitor taking over.
      map.on("dragstart", () => {
        userMovedAtRef.current = performance.now();
      });
      map.on("zoomstart", () => {
        if (!fitSyncRef.current) {
          userMovedAtRef.current = performance.now();
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
      // Synchronous like every set fit, with the same guard flag, so
      // its zoomstart is not mistaken for a visitor gesture.
      if (sizeSettled(map)) {
        fitSyncRef.current = true;
        try {
          map.fitBounds(
            [
              [TAIWAN_BOUNDS.south, TAIWAN_BOUNDS.west],
              [TAIWAN_BOUNDS.north, TAIWAN_BOUNDS.east],
            ],
            { animate: false }
          );
        } finally {
          fitSyncRef.current = false;
        }
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
      for (const timer of verifyTimersRef.current) clearTimeout(timer);
      verifyTimersRef.current = [];
      if (fitRetryTimerRef.current) {
        clearTimeout(fitRetryTimerRef.current);
        fitRetryTimerRef.current = null;
      }
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
      userMovedAtRef.current = 0;
      fitAtRef.current = 0;
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
