"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
import {
  MAP_THEME_STORAGE_KEY,
  applyLabelLanguage,
  applyMapPaint,
  parseStoredMapTheme,
  type MapTheme,
  type StyleTarget,
} from "@/lib/mapStyle";
import { STRINGS, type Lang } from "@/lib/i18n";
import type { Place } from "@/lib/places";

// The real interactive map — TRIAL build (Jenny's go-ahead,
// 2026-11-24, staging only): MapLibre GL JS drawing OpenStreetMap
// data as VECTOR tiles (OpenFreeMap's hosted OpenMapTiles service,
// the calm "positron" base style repainted by lib/mapStyle.ts in
// the map's day (pastel) or night palette — the visitor's own
// toggle, day by default), replacing the Leaflet map's borrowed
// raster tile pictures. What the swap buys: vector tiles zoom
// smoothly instead of loading a new picture per level (the lag
// Jenny felt on pinch zoom), the labels are data the app can
// restyle — they follow the EN/中文 toggle and wear the night
// palette — and the map is styled as the app's own. Attribution to
// the OpenStreetMap contributors rides in the style's own
// attribution, shown by the attribution control, as before.
// This component is only ever imported via next/dynamic with
// ssr:false from PlaceBrowser, so MapLibre — which needs `window`
// and WebGL — never runs during the server render or the static
// prerender. Plain MapLibre in effects, no wrapper library.
//
// The map draws the CURRENT filtered set (the same places as the
// list): numbered pins at ≤60 results; above that, places group
// into count badges (clusters) that separate as the visitor zooms
// in, with any ungrouped place drawn as the plain dot it always
// was — the badge counts plus the dots always add up to the set's
// size. The view fits the set's frame (with generous padding, and
// whole Taiwan for an empty set) only when the set itself changes
// — panning/zooming and then toggling Cards/Compact does not move
// the visitor's view.
//
// The fit discipline is the one Phase A (2026-11-23) proved on the
// Leaflet build, ported control for control, because the failure
// it guards against — a set change whose pins redraw while the
// view stays on the old frame — must stay impossible:
//
//  - A fit is only ever computed against a settled size: if the
//    container has not reached its real size when a fit comes due
//    (the map sits below the fold while the page settles), the fit
//    is queued rather than computed against the wrong size, and
//    the map's own resize event lands it — or re-applies the
//    current fit exactly once — when the size corrects. A fit
//    computed against an unsettled size zooms to an extreme and
//    strands the map there.
//  - A set-change fit is issued SYNCHRONOUSLY (animate: false),
//    never into an in-flight camera animation (it is deferred
//    through the pending-fit mechanism and retried on the
//    animation's own moveend and on a plain timer), and afterwards
//    VERIFIED: the landed centre/zoom are recorded, and plain
//    timers plus resize/load triggers re-check that the view
//    actually arrived, re-applying the fit if anything ever
//    swallows one. (MapLibre's camera is better behaved than
//    Leaflet's animated path was — a non-animated fit applies
//    before the call returns, and a new camera command replaces
//    rather than drops behind an in-flight animation — but the
//    verification costs nothing and keeps the guarantee structural
//    rather than faith in either library.)
//  - A set change ALWAYS ends with the map framed on the new set:
//    on- or off-screen, settled size or not (a queued fit lands via
//    the pending retries). The visitor-owned guard below may only
//    ever suppress these verification/size-correction refits —
//    never the set-change fit itself.
//
// Wheel zoom is click-to-activate, exactly as on the Leaflet build:
// with wheel zoom live, a desktop visitor scrolling down the page
// with the pointer over the map has the wheel captured by the map
// — the page scroll stalls and the map zooms itself away from its
// framing (the confirmed cause of the 2026-11-23 live failure;
// programmatic test scrolls never produce wheel events, which is
// why the sandbox could not see it). So the map is created with
// scrollZoom off, a click/tap into the map (or keyboard focus)
// turns it on, and the pointer leaving the map (or the map losing
// focus) turns it off again. Touch pinch zoom and drag pan are
// separate handlers and are never gated.
//
// Two tools of Jenny's (2026-11-24) sit in a small stack over the
// map's top-right corner, working WITH the discipline above:
//  - Reset view re-applies the current set's fit — the same
//    synchronous, size-gated, verified applyFit — after handing
//    view ownership back to the fit (the visitor's gesture
//    timestamp is cleared, because the reset IS the visitor asking
//    for the frame back; it is the one deliberate override of the
//    visitor-owns-view guard).
//  - Expand opens the map as a full-viewport in-app overlay (a CSS
//    fixed position, NOT the browser Fullscreen API, which iPhone
//    Safari/PWA does not offer for elements) and collapses back.
//    The size change is deliberate, so a short camera hold
//    suppresses the size-correction refit in refitAfterResize for
//    the transition: MapLibre itself preserves centre/zoom across
//    a resize, and the hold keeps our machinery from "correcting"
//    the camera to a fit computed at the other size. The hold is
//    scoped to the transition only — a set change while expanded
//    still reframes as usual (it never travels through
//    refitAfterResize), and genuine resizes after the hold lapses
//    behave exactly as before.

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

type PlaceMapProps = {
  markerSet: MapMarkerSet;
  onSelect: (place: Place) => void;
  lang: Lang;
};

export default function PlaceMap({ markerSet, onSelect, lang }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<MLMarker[]>([]);
  const fittedSignatureRef = useRef<string | null>(null);
  // Fit bookkeeping for the size gate below: a fit is only ever
  // computed against a SETTLED size, and a later material size
  // correction re-applies the current set's fit exactly once.
  // lastFitRef records what was fitted and at what container size;
  // pendingFitRef marks a fit that is waiting for a settled size or
  // a free camera; view ownership is tracked by the timestamps
  // further below.
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
  // fit's verification, while any gesture after a fit suppresses
  // verification and size-correction refits, as it should.
  const userMovedAtRef = useRef(0);
  const fitAtRef = useRef(0);
  const visitorOwnsView = () => userMovedAtRef.current > fitAtRef.current;
  // True only during the synchronous body of one of our own fits:
  // a fit's own zoomstart fires inside that window, so a zoomstart
  // observed outside it is the visitor's (or another animation's),
  // never our fit's.
  const fitSyncRef = useRef(false);
  // The fit-verification timers (plain setTimeout — they fire
  // regardless of animation frames).
  const verifyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The one-shot retry for a fit deferred behind an in-flight
  // camera animation (see applyFit).
  const fitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The expand/collapse camera hold (see the header note): while
  // it stands, refitAfterResize must not treat the deliberate
  // size change as a size correction. Set by every expand/collapse
  // transition and cleared on a plain timer shortly after — the
  // resize events the transition causes land well inside the
  // window, and nothing else is affected meanwhile (set-change
  // fits never consult it).
  const cameraHoldRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The expanded (full-viewport overlay) state of the map.
  const [expanded, setExpanded] = useState(false);
  // The map's day/night theme (Jenny, 2026-11-24): DAY (the soft
  // pastel palette) is the first-visit default; the visitor's
  // toggle choice is remembered on this device only
  // (MAP_THEME_STORAGE_KEY, disclosed on the Privacy page). This
  // component is client-only (next/dynamic, ssr:false), so the
  // stored choice can be read in the initialiser — the map opens
  // in the visitor's own mode, pre-paint background included, with
  // no flash of the other theme.
  const [mapTheme, setMapTheme] = useState<MapTheme>(() => {
    try {
      return parseStoredMapTheme(
        window.localStorage.getItem(MAP_THEME_STORAGE_KEY)
      );
    } catch {
      return "day";
    }
  });
  const themeRef = useRef(mapTheme);
  // Latest props, readable from the MapLibre callbacks and effects
  // below without re-creating the map.
  const markerSetRef = useRef(markerSet);
  const onSelectRef = useRef(onSelect);
  const langRef = useRef(lang);

  // Keep the refs current (declared first so they run before the
  // marker-update effect below).
  useEffect(() => {
    markerSetRef.current = markerSet;
    onSelectRef.current = onSelect;
    langRef.current = lang;
    themeRef.current = mapTheme;
  });

  // A size is settled when the container has a real size and the
  // padded viewport (size minus the fit padding on both sides) is
  // still positive — a fit computed against a zero/negative
  // viewport zooms to an extreme and strands the map there.
  // (MapLibre tracks its canvas size itself, so unlike the Leaflet
  // build there is no cached-size comparison to make.)
  function sizeSettled(): boolean {
    const container = containerRef.current;
    if (!container) return false;
    return (
      container.clientWidth > FIT_PADDING_PX * 2 &&
      container.clientHeight > FIT_PADDING_PX * 2
    );
  }

  // Retry a deferred fit on plain passage of time: a camera
  // animation runs ~500ms at most, so a 400ms beat lands after it
  // — and timers fire even in a frame-starved renderer. Each retry
  // re-arms while an animation is still in flight (a visitor
  // mid-pinch, say), so the fit lands the moment the view is free.
  function scheduleFitRetry(map: MLMap) {
    if (fitRetryTimerRef.current) clearTimeout(fitRetryTimerRef.current);
    fitRetryTimerRef.current = setTimeout(() => {
      fitRetryTimerRef.current = null;
      if (mapRef.current === map && pendingFitRef.current) {
        applyFit(map, markerSetRef.current);
      }
    }, 400);
  }

  // Fit the current set, but only against a settled size and never
  // into an in-flight camera animation. When the size is not
  // settled, or the camera is animating, the fit is queued
  // (pendingFitRef) instead — the resize event, the animation's
  // own moveend and a plain timer retry it until it lands. Returns
  // whether the fit was applied.
  //
  // The fit itself is SYNCHRONOUS (animate: false — see the header
  // note): the centre/zoom read back immediately afterwards ARE
  // the fitted view, and are recorded for the verification below.
  function applyFit(
    map: MLMap,
    set: MapMarkerSet,
    scheduleVerify = true
  ): boolean {
    if (map.isEasing()) {
      pendingFitRef.current = true;
      scheduleFitRetry(map);
      return false;
    }
    if (!sizeSettled()) {
      pendingFitRef.current = true;
      return false;
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
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        {
          padding: FIT_PADDING_PX,
          maxZoom: FIT_MAX_ZOOM,
          animate: false,
          duration: 0,
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
      lat: centre.lat,
      lng: centre.lng,
      zoom: map.getZoom(),
    };
    fittedSignatureRef.current = lastFitRef.current.signature;
    fitAtRef.current = performance.now();
    if (scheduleVerify) scheduleFitVerification(map);
    return true;
  }

  // The fit verification: if the map's actual view is not the view
  // the current set's fit produced, re-apply that fit. Synchronous
  // fits make this a formality — it exists so that no present or
  // future swallow in the view machinery can ever leave a set
  // change unframed: the check runs on every size re-measurement
  // (the map's resize event, window load) and on plain timers
  // after each fit (timers fire regardless of animation frames).
  // It never touches a visitor-owned view: a drag, zoom or cluster
  // tap AFTER the fit suppresses it, exactly as it suppresses
  // size-correction refits — but a gesture from BEFORE the fit does
  // not (see the ownership timestamps: that gesture's animation may
  // be what moved the view away). It also stands down while a fit
  // is queued (the pending retries own that case) and when the
  // recorded fit belongs to an older set.
  function verifyFit(map: MLMap) {
    const last = lastFitRef.current;
    if (!last || pendingFitRef.current || visitorOwnsView()) return;
    if (last.signature !== markerSetSignature(markerSetRef.current)) return;
    const centre = map.getCenter();
    const zoom = map.getZoom();
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
  function scheduleFitVerification(map: MLMap) {
    for (const timer of verifyTimersRef.current) clearTimeout(timer);
    verifyTimersRef.current = [600, 1800].map((delay) =>
      setTimeout(() => {
        if (mapRef.current === map) verifyFit(map);
      }, delay)
    );
  }

  // Called on every map resize (MapLibre watches the container
  // itself): if a fit is still pending, land it now that the size
  // may have settled; otherwise, if the container's size has
  // materially changed since the current fit was computed and the
  // visitor has not taken over the view, re-apply the current
  // set's fit exactly once at the corrected size; and in all cases
  // give the fit verification its chance to catch a swallowed fit.
  function refitAfterResize(map: MLMap) {
    if (pendingFitRef.current) {
      if (sizeSettled()) applyFit(map, markerSetRef.current);
      return;
    }
    // An expand/collapse transition is a deliberate size change
    // with a deliberate camera: MapLibre preserves centre/zoom
    // across the resize, and the size-correction refit (and the
    // verification it falls through to) must not second-guess it.
    // The hold is short and transition-scoped — see holdCamera.
    if (cameraHoldRef.current) return;
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

  // Stand the camera hold for one expand/collapse transition
  // (see the header note and refitAfterResize). The window only
  // needs to cover the resize events the class change causes,
  // which land within a frame or two; 900ms is generous without
  // ever swallowing a later, genuine resize correction.
  function holdCamera() {
    cameraHoldRef.current = true;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      cameraHoldRef.current = false;
      holdTimerRef.current = null;
    }, 900);
  }

  // Reset view (Jenny, 2026-11-24): re-frame the CURRENT set
  // exactly as it was framed when it appeared. The visitor's
  // ownership timestamp is cleared first — the reset is the
  // visitor explicitly asking for the frame back, so the fit and
  // its verification own the view again from here; the fit itself
  // is the ordinary applyFit, with its usual size gate, deferral
  // behind an in-flight animation, and verification.
  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    userMovedAtRef.current = 0;
    applyFit(map, markerSetRef.current);
  }

  // Day/night theme (Jenny, 2026-11-24): switch the palette on the
  // LIVE style in place — a repaint only, no reload, no camera
  // change — and remember the choice on this device. The button
  // shows the mode it switches TO (a moon in day mode, a sun in
  // night mode) and its label names that destination mode.
  function toggleMapTheme(next: MapTheme) {
    themeRef.current = next;
    setMapTheme(next);
    try {
      window.localStorage.setItem(MAP_THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the mode still switches for this visit */
    }
    const map = mapRef.current;
    if (map) {
      // No isStyleLoaded gate: setPaintProperty is valid while
      // tiles are still streaming in, and gating on it would let a
      // tap in that window flip the button but not the map. If the
      // style is not up at all yet, applyMapPaint no-ops and the
      // style.load handler applies themeRef when it lands.
      applyMapPaint(map as unknown as StyleTarget, next);
    }
  }

  // Expand/collapse (Jenny, 2026-11-24): every transition holds
  // the camera first (the toggle's own click handler, and the
  // Escape handler in the effect below, both come through here).
  function toggleExpanded(next: boolean) {
    holdCamera();
    setExpanded(next);
  }

  function clearMarkers() {
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
  }

  function drawMarkers(ml: typeof import("maplibre-gl"), map: MLMap, refit: boolean) {
    // Replace, never accumulate: every marker is removed on redraw.
    clearMarkers();
    const set = markerSetRef.current;
    const addMarker = (
      element: HTMLDivElement,
      lng: number,
      lat: number,
      onTap?: () => void
    ) => {
      if (onTap) element.addEventListener("click", onTap);
      const marker = new ml.Marker({ element })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push(marker);
      return marker;
    };
    const badge = (wrapClass: string, innerClass: string, text?: string) => {
      const wrap = document.createElement("div");
      wrap.className = wrapClass;
      const inner = document.createElement("span");
      inner.className = innerClass;
      if (text != null) inner.textContent = text;
      wrap.appendChild(inner);
      return wrap;
    };

    if (set.markers.length > 0 && set.markers[0].kind === "numbered") {
      for (const marker of set.markers) {
        addMarker(
          badge("map-pin-wrap", "map-pin", String(marker.number)),
          marker.lng,
          marker.lat,
          () => onSelectRef.current(marker.place)
        );
      }
    } else if (set.markers.length > 0) {
      // Large set: group the dots at the current zoom. A group of
      // one is drawn as the plain dot; a larger group as a count
      // badge whose tap fits the group's own bounds, so taps keep
      // separating clusters as the visitor dives in. getZoom is 0
      // only before the first fit, which the mount effect performs
      // before the first draw settles — the fitted zoom's moveend
      // regroups at the real zoom immediately after.
      const zoom = map.getZoom();
      for (const group of clusterMarkers(set.markers, zoom)) {
        if (group.count === 1) {
          const marker = group.markers[0];
          addMarker(
            badge("map-dot-wrap", "map-dot"),
            marker.lng,
            marker.lat,
            () => onSelectRef.current(marker.place)
          );
        } else {
          addMarker(
            badge("map-cluster-wrap", "map-cluster", String(group.count)),
            group.lng,
            group.lat,
            () => {
              const bounds = markerBounds(group.markers);
              if (!bounds) return;
              // The visitor is steering the view now; a later size
              // correction must not undo this tap with a set refit.
              userMovedAtRef.current = performance.now();
              map.fitBounds(
                [
                  [bounds.west, bounds.south],
                  [bounds.east, bounds.north],
                ],
                {
                  padding: FIT_PADDING_PX,
                  maxZoom: CLUSTER_FIT_MAX_ZOOM,
                }
              );
            }
          );
        }
      }
    }
    // The visitor's own position, when known: a distinct blue dot,
    // drawn last so it sits above the place markers. Not
    // interactive — it is not a place.
    if (set.user) {
      const element = badge("map-you-wrap", "map-you");
      element.style.pointerEvents = "none";
      addMarker(element, set.user.lng, set.user.lat);
    }
    // Refit only when the set's identity actually changed, and only
    // on a set-driven draw — a zoom-driven redraw (clusters
    // regrouping) must never move the visitor's view. A fit that is
    // still pending (queued behind an unsettled size or an
    // in-flight animation) is retried on every set-driven draw
    // until it lands.
    if (!refit) return;
    const signature = markerSetSignature(set);
    if (signature !== fittedSignatureRef.current || pendingFitRef.current) {
      applyFit(map, set);
    }
  }

  // Create the map once, on mount.
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let containerEl: HTMLDivElement | null = null;
    let onContainerLeave: (() => void) | null = null;
    let onFocusIn: (() => void) | null = null;
    let onFocusOut: ((event: FocusEvent) => void) | null = null;
    const onWindowLoad = () => {
      if (map) verifyFit(map);
    };
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      mlRef.current = ml;
      containerEl = containerRef.current;
      // scrollZoom off at creation (see the header note): page
      // scrolling must never be captured by the map. It is switched
      // on only while the visitor is deliberately engaged with the
      // map, by the activation wiring right below.
      map = new ml.Map({
        container: containerEl,
        style: STYLE_URL,
        scrollZoom: false,
        maxZoom: 19,
        attributionControl: { compact: false },
      });
      mapRef.current = map;
      // The zoom control where Leaflet's sat, without the compass
      // (the app never rotates the map).
      map.addControl(
        new ml.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-left"
      );
      // A handle for the e2e specs (and console debugging): the
      // live map instance on its container element. Harmless in
      // production — one expando property, removed on unmount.
      (containerEl as unknown as { __haoChiMap?: MLMap }).__haoChiMap = map;

      // The theme repaint and the language-following labels apply
      // the moment the base style lands; both are live-style
      // changes (lib/mapStyle.ts), no reload.
      map.on("style.load", () => {
        if (!map) return;
        const target = map as unknown as StyleTarget;
        applyMapPaint(target, themeRef.current);
        applyLabelLanguage(target, langRef.current);
      });
      // Clusters regroup with the zoom; the numbered pins don't
      // depend on it. A zoom-driven redraw never refits. moveend is
      // the one completion signal every camera change — animated
      // or synchronous, visitor's or ours — ends with, so it also
      // carries the deferred fit's retry: a fit queued behind an
      // in-flight animation lands the moment the animation ends.
      map.on("moveend", () => {
        if (!map) return;
        const set = markerSetRef.current;
        if (set.markers.length > 0 && set.markers[0].kind === "dot") {
          drawMarkers(ml, map, false);
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
      // MapLibre watches the container's size itself and fires
      // resize after correcting the canvas: the hook the fit
      // machinery needs to land a queued fit, or re-apply the
      // current fit exactly once at a corrected size.
      map.on("resize", () => {
        if (map) refitAfterResize(map);
      });
      // Click-to-activate wheel zoom: a click/tap into the map (a
      // pin or badge tap bubbles up to a map click too, which is
      // fine — that is deliberate engagement) or keyboard focus on
      // the map turns wheel zoom on; the pointer leaving the
      // container or focus leaving the map turns it off again, so
      // a wheel that merely passes over the map while
      // page-scrolling can never zoom it. Only the wheel handler is
      // gated — touch pinch and dragging stay enabled throughout.
      const activateWheel = () => {
        map?.scrollZoom.enable();
      };
      const deactivateWheel = () => {
        map?.scrollZoom.disable();
      };
      map.on("click", activateWheel);
      onFocusIn = activateWheel;
      containerEl.addEventListener("focusin", onFocusIn);
      onFocusOut = (event: FocusEvent) => {
        if (!containerEl?.contains(event.relatedTarget as Node | null)) {
          deactivateWheel();
        }
      };
      containerEl.addEventListener("focusout", onFocusOut);
      onContainerLeave = deactivateWheel;
      containerEl.addEventListener("mouseleave", onContainerLeave);
      // Pre-frame Taiwan only if the size is already settled; the
      // draw below applies the real (gated) set fit either way, and
      // a queued fit lands via the resize event once the size
      // settles. Synchronous like every set fit, with the same
      // guard flag, so its zoomstart is not mistaken for a visitor
      // gesture.
      if (sizeSettled()) {
        fitSyncRef.current = true;
        try {
          map.fitBounds(
            [
              [TAIWAN_BOUNDS.west, TAIWAN_BOUNDS.south],
              [TAIWAN_BOUNDS.east, TAIWAN_BOUNDS.north],
            ],
            { animate: false, duration: 0 }
          );
        } finally {
          fitSyncRef.current = false;
        }
      }
      drawMarkers(ml, map, true);
      window.addEventListener("load", onWindowLoad);
    })();
    return () => {
      cancelled = true;
      for (const timer of verifyTimersRef.current) clearTimeout(timer);
      verifyTimersRef.current = [];
      if (fitRetryTimerRef.current) {
        clearTimeout(fitRetryTimerRef.current);
        fitRetryTimerRef.current = null;
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (containerEl) {
        if (onContainerLeave) {
          containerEl.removeEventListener("mouseleave", onContainerLeave);
        }
        if (onFocusIn) containerEl.removeEventListener("focusin", onFocusIn);
        if (onFocusOut) containerEl.removeEventListener("focusout", onFocusOut);
        delete (containerEl as unknown as { __haoChiMap?: MLMap }).__haoChiMap;
      }
      window.removeEventListener("load", onWindowLoad);
      clearMarkers();
      if (map) map.remove();
      mapRef.current = null;
      mlRef.current = null;
      fittedSignatureRef.current = null;
      lastFitRef.current = null;
      pendingFitRef.current = false;
      userMovedAtRef.current = 0;
      fitAtRef.current = 0;
    };
    // Mount-only: later set changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when the filtered set changes. If MapLibre has not
  // loaded yet this is a no-op — the mount effect draws the latest
  // set on arrival.
  useEffect(() => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ml || !map) return;
    drawMarkers(ml, map, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerSet]);

  // Labels follow the app language: rewrite the label layers'
  // text-field on the live style — no map reload, no view change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyLabelLanguage(map as unknown as StyleTarget, lang);
  }, [lang]);

  // Expand/collapse transitions (not the first render): hold the
  // camera again from this side of the class change, and resize
  // the map explicitly once the new size has applied — MapLibre
  // also watches the container itself, but the explicit resize
  // makes the transition deterministic rather than observer-timed.
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    holdCamera();
    const raf = requestAnimationFrame(() => {
      mapRef.current?.resize();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // While expanded: the page behind must not scroll, and Escape
  // collapses (desktop). Cleanup restores the body's overflow
  // exactly as it found it — including when the component unmounts
  // mid-expansion.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const t = STRINGS[lang];
  return (
    <div className={expanded ? "place-map-wrap expanded" : "place-map-wrap"}>
      <div ref={containerRef} className="place-map" data-map-theme={mapTheme} />
      <div className="map-tools">
        <button
          type="button"
          className="map-tool-btn map-reset-btn"
          aria-label={t.map_reset_view}
          title={t.map_reset_view}
          onClick={resetView}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="6.5" />
            <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          type="button"
          className="map-tool-btn map-expand-btn"
          aria-label={expanded ? t.map_collapse : t.map_expand}
          aria-expanded={expanded}
          title={expanded ? t.map_collapse : t.map_expand}
          onClick={() => toggleExpanded(!expanded)}
        >
          {expanded ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="map-tool-btn map-theme-btn"
          aria-label={mapTheme === "day" ? t.map_night : t.map_day}
          title={mapTheme === "day" ? t.map_night : t.map_day}
          onClick={() =>
            toggleMapTheme(mapTheme === "day" ? "night" : "day")
          }
        >
          {mapTheme === "day" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 13.6A8.6 8.6 0 1 1 10.4 4a7.2 7.2 0 0 0 9.6 9.6Z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
