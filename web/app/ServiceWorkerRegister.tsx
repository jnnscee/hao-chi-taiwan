"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) that makes the guide
 * work offline. Production only — in development the worker would
 * fight the dev server's hot reloading — and only where the
 * browser supports service workers at all.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* Offline support is an enhancement; the guide itself
           must never break because registration failed. */
      });
  }, []);
  return null;
}
