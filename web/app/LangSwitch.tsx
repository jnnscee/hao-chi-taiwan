"use client";

import { usePathname } from "next/navigation";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";
import { twinPath } from "@/lib/routes";

/**
 * The EN / 中文 toggle, as navigation: each side links to the
 * current page's twin in that language (/place/r6 ⇄ /zh/place/r6,
 * /privacy ⇄ /zh/privacy, / ⇄ /zh). Clicking also records the
 * choice in hao-chi-lang-v1 — a toggle tap is an explicit language
 * choice, exactly as the old in-place toggle recorded it. (Landing
 * on any /zh/ page records Chinese too; that happens in the page
 * components, not here.)
 */
export default function LangSwitch({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? "/";

  function remember(next: Lang) {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // storage unavailable: navigation still switches the page
    }
  }

  return (
    <div className="langtoggle" role="group" aria-label="Language / 語言">
      <a
        href={twinPath(pathname, "en")}
        className={lang === "en" ? "lang-btn active" : "lang-btn"}
        aria-current={lang === "en" ? "page" : undefined}
        onClick={() => remember("en")}
      >
        EN
      </a>
      <a
        href={twinPath(pathname, "zh")}
        className={lang === "zh" ? "lang-btn active" : "lang-btn"}
        aria-current={lang === "zh" ? "page" : undefined}
        onClick={() => remember("zh")}
      >
        中文
      </a>
    </div>
  );
}
