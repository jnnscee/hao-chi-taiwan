"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { INSTALL, INSTALL_DISMISSED_KEY } from "@/lib/install";
import { InstallStepsDialog, useInstallFlow } from "./InstallButton";

/**
 * A phone visitor, in the live app's terms: iOS (an iPad on a
 * desktop-class user agent counts, as there) or Android. On
 * phones the live app shows its install bar without waiting for
 * a browser offer — iOS has none to wait for.
 */
function isMobileDevice(): boolean {
  const ua = window.navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  if (
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return /android/i.test(ua);
}

/**
 * The install banner (Phase B gap B-9, restored at Jenny's
 * request 2026-11-23): the live app's dismissible "Add to Home
 * Screen" bar, in the night theme. Its rules mirror the live
 * app's updateInstallBar —
 *   show when not dismissed, not running installed (standalone),
 *   and either the browser has offered an install prompt or the
 *   visitor is on a phone;
 *   the Add button runs the same install flow as the footer
 *   button (the browser's own offer where one was captured, the
 *   per-device steps dialog everywhere else);
 *   appinstalled retires it for good.
 * One deliberate difference from the live app: its dismissal
 * lives in a page-session variable, so the bar returns on the
 * next visit; here the dismissal is remembered on the device
 * (hao-chi-install-dismissed-v1, named on the Privacy page), so
 * a dismissed banner stays dismissed.
 *
 * While the bar shows, the body wears has-install and the
 * floating search button lifts above the bar — the live app's
 * own arrangement, so the bar never covers it. The live app
 * lifts by a fixed 118px; the rebuild's card runs taller (its
 * text wraps further at phone widths), so the bar measures
 * itself and the button lifts by the measured height instead.
 */
export default function InstallBanner({ lang }: { lang: Lang }) {
  const t = INSTALL[lang];
  const flow = useInstallFlow();
  // Decided on the client after mount: a stored dismissal and a
  // desktop-class browser must not flash the bar during hydration.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");
    } catch {
      /* Storage unavailable — treat as not dismissed. */
    }
    setMobile(isMobileDevice());
    setReady(true);
  }, []);

  const visible =
    ready &&
    !dismissed &&
    !flow.installed &&
    (flow.hasPrompt || mobile);

  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const bar = barRef.current;
    document.body.classList.add("has-install");
    const syncLift = () => {
      if (bar) {
        document.body.style.setProperty(
          "--install-bar-lift",
          `${bar.offsetHeight + 10}px`
        );
      }
    };
    syncLift();
    const observer =
      bar && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncLift)
        : null;
    if (observer && bar) observer.observe(bar);
    return () => {
      observer?.disconnect();
      document.body.classList.remove("has-install");
      document.body.style.removeProperty("--install-bar-lift");
    };
  }, [visible]);

  function dismiss() {
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      /* Storage unavailable — the bar still hides for this page. */
    }
    setDismissed(true);
  }

  if (!visible) return null;

  return (
    <>
      <div className="install-bar" ref={barRef}>
        <div className="install-bar-card">
          {/* The app icon the manifest installs (generated, like
              /icon — no binary files in the repo). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/192" alt="" width={46} height={46} />
          <div className="install-bar-text">
            <b>{t.bannerTitle}</b>
            <span>{t.text}</span>
          </div>
          <button
            type="button"
            className="install-bar-btn"
            onClick={flow.startInstall}
          >
            {t.bannerBtn}
          </button>
          <button
            type="button"
            className="install-bar-x"
            aria-label={t.bannerDismiss}
            onClick={dismiss}
          >
            ✕
          </button>
        </div>
      </div>
      {flow.showHow && (
        <InstallStepsDialog
          lang={lang}
          kind={flow.kind}
          onClose={flow.closeHow}
        />
      )}
    </>
  );
}
