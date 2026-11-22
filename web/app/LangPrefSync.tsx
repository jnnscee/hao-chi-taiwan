"use client";

import { useEffect } from "react";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";

/**
 * Applies a page's path language on the client: the html lang
 * attribute follows it, and a /zh/ page also records Chinese as
 * the stored preference (hao-chi-lang-v1) — the /zh/ path is
 * authoritative for language, so arriving on any /zh/ page makes
 * Chinese the visitor's remembered choice. English pages leave
 * the stored preference alone (the English home resolves it as
 * before; a toggle tap records its own choice — see LangSwitch).
 */
export default function LangPrefSync({ lang }: { lang: Lang }) {
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    if (lang === "zh") {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, "zh");
      } catch {
        // storage unavailable: the page is still Chinese
      }
    }
  }, [lang]);
  return null;
}
