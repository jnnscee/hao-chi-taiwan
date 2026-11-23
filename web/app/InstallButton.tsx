"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { INSTALL } from "@/lib/install";

/** The browser's deferred install offer (Chrome/Edge/Android). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

type PlatformKind = "ios" | "android" | "generic";

function platformKind(): PlatformKind {
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "generic";
}

/**
 * The footer's "Add to Home Screen" entry, mirroring the live
 * app's footer button: where the browser offers an install prompt
 * (beforeinstallprompt) the tap fires that prompt; everywhere
 * else — iOS above all, which has no prompt — it opens a small
 * dialog with the Share → "Add to Home Screen" steps for the
 * visitor's kind of device. Hidden entirely once the guide is
 * running installed (standalone), since there is nothing to add.
 */
export default function InstallButton({ lang }: { lang: Lang }) {
  const t = INSTALL[lang];
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [kind, setKind] = useState<PlatformKind>("generic");

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true
    ) {
      setInstalled(true);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showHow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHow(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHow]);

  if (installed) return null;

  async function handleClick() {
    const evt = deferred.current;
    if (evt) {
      deferred.current = null;
      try {
        await evt.prompt();
        await evt.userChoice;
        return;
      } catch {
        /* The prompt failed — fall through to the instructions. */
      }
    }
    setKind(platformKind());
    setShowHow(true);
  }

  const steps =
    kind === "ios"
      ? t.iosSteps
      : kind === "android"
        ? t.androidSteps
        : t.genericSteps;
  const note =
    kind === "ios"
      ? t.iosNote
      : kind === "android"
        ? t.androidNote
        : t.genericNote;

  return (
    <>
      <button type="button" className="foot-link" onClick={handleClick}>
        {t.btn}
      </button>
      {showHow && (
        <div className="dialog-backdrop overlay-top">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="installTitle"
          >
            <button
              type="button"
              className="dialog-close"
              aria-label={lang === "zh" ? "關閉" : "Close"}
              onClick={() => setShowHow(false)}
            >
              ✕
            </button>
            <h2 id="installTitle" className="dialog-title">
              {t.title}
            </h2>
            <p className="install-text">{t.text}</p>
            <ol className="install-steps">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="install-note">{note}</p>
          </div>
        </div>
      )}
    </>
  );
}
