// Real web addresses for the rebuild: per-place pages, the info
// routes and the /zh/ language twin of every page. Pure helpers —
// path building, language-from-path resolution, twin paths and the
// pages' metadata — kept free of React and browser globals (the
// origin is passed in) so the behaviour can be unit-checked in
// plain node.
//
// Language lives in the path: anything under /zh/ is Chinese,
// everything else is English. The /zh/ path is authoritative for
// the language of its pages and, on the client, also updates the
// stored preference (hao-chi-lang-v1) to Chinese; the English home
// keeps its ?lang= → stored → English resolution.

import type { Metadata } from "next";
import type { Place } from "./places";
import { INFO_PAGES, type InfoPageKey } from "./pages";
import {
  STRINGS,
  cityLabel,
  cuisineLabel,
  districtLabel,
  type Lang,
} from "./i18n";

/**
 * The site's canonical production origin, used for og:url. The
 * rebuild is previewed on its own Vercel domain for now, but this
 * is the address the guide will live at (and where the live site's
 * own metadata already points).
 */
export const SITE_ORIGIN = "https://hao-chi-taiwan.vercel.app";

/**
 * Share-preview image for every page: the default banner, as on the
 * live site. INTERIM: it is referenced at the live site's absolute
 * URL because the rebuild cannot host the binary yet — the GitHub
 * snapshot push rejects binary files. Self-host it at launch.
 */
export const OG_IMAGE_URL = "https://hao-chi-taiwan.vercel.app/og-image.jpg";

/** The home page path for a language: "/" or "/zh". */
export function homePath(lang: Lang): string {
  return lang === "zh" ? "/zh" : "/";
}

/** A place page's path: "/place/<id>" or "/zh/place/<id>". */
export function placePath(lang: Lang, legacyId: string): string {
  return `${lang === "zh" ? "/zh" : ""}/place/${encodeURIComponent(legacyId)}`;
}

/**
 * The one place-URL helper: the absolute, language-matched URL of a
 * place's own page. Share, the calendar event's "View in Hao Chi
 * Taiwan" line and the contact form's "Place page:" line all use
 * this. (The home pages still honour the old ?place=<id> links by
 * opening the details dialog — see PlaceBrowser.)
 */
export function placeUrl(
  origin: string,
  lang: Lang,
  legacyId: string
): string {
  return origin + placePath(lang, legacyId);
}

/** An info page's path: "/about" or "/zh/about", etc. */
export function infoPath(lang: Lang, key: InfoPageKey): string {
  return `${lang === "zh" ? "/zh" : ""}/${key}`;
}

/** The contact page's path (the form also lives there as a page). */
export function contactPath(lang: Lang): string {
  return `${lang === "zh" ? "/zh" : ""}/contact`;
}

/** The language a pathname is in: /zh and everything under it is Chinese. */
export function langFromPathname(pathname: string): Lang {
  return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
}

/**
 * The same page in the other language — the EN/中文 toggle now
 * navigates between path twins: /place/r6 ⇄ /zh/place/r6,
 * /privacy ⇄ /zh/privacy, / ⇄ /zh. Anything the path doesn't
 * carry (list state, query strings) is not preserved.
 */
export function twinPath(pathname: string, target: Lang): string {
  const current = langFromPathname(pathname);
  if (current === target) return pathname;
  if (target === "zh") return pathname === "/" ? "/zh" : `/zh${pathname}`;
  const stripped = pathname.slice("/zh".length);
  return stripped === "" ? "/" : stripped;
}

/* --- Metadata (share previews) --- */

// The two established home variants, exactly as the live site
// serves them (its <meta name="description"> / og: tags, EN on /
// and ZH on /zh/).
const HOME_META: Record<
  Lang,
  { title: string; description: string }
> = {
  en: {
    title: "Hao Chi Taiwan",
    description:
      "Jenny's personal guide to 242 small restaurants, cafés and street-food spots across Taiwan — every Recommended place personally tried and tested. Bilingual, with maps, opening hours and directions.",
  },
  zh: {
    title: "Hao Chi Taiwan 好吃台灣",
    description:
      "Jenny 的台灣美食指南 — 242 家小餐館、咖啡館和街頭小吃，推薦名單上的店都是她親自吃過、真心推薦的。雙語介面，附地圖、營業時間和交通方式。",
  },
};

function baseOpenGraph(
  title: string,
  description: string,
  path: string
): NonNullable<Metadata["openGraph"]> {
  return {
    title,
    description,
    type: "website",
    url: SITE_ORIGIN + path,
    images: [OG_IMAGE_URL],
  };
}

/** Home page metadata: the live site's EN variant on /, ZH on /zh/. */
export function homeMetadata(lang: Lang): Metadata {
  const m = HOME_META[lang];
  return {
    title: m.title,
    description: m.description,
    openGraph: baseOpenGraph(m.title, m.description, homePath(lang)),
  };
}

/**
 * A place page's share title: the place's names in the app's
 * heading order (Chinese name first, English name after), plus the
 * language-matched site suffix — the same composition as the
 * details dialog's share title, with both names kept.
 */
export function placeTitle(place: Place, lang: Lang): string {
  const names = [place.name_zh, place.name_en]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" ");
  const suffix = lang === "zh" ? " — 好吃台灣" : " — Hao Chi Taiwan";
  return names + suffix;
}

/**
 * A place page's share description, from its gloss, cuisine and
 * location, in the page's language. (The gloss itself is stored
 * English-only data, as everywhere else in the app; the cuisine /
 * city / district labels follow the page's language.)
 */
export function placeDescription(place: Place, lang: Lang): string {
  const where = [
    place.district ? districtLabel(lang, place.district) : null,
    place.city ? cityLabel(lang, place.city) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return [place.gloss, place.cuisine ? cuisineLabel(lang, place.cuisine) : null, where]
    .filter(Boolean)
    .join(" · ");
}

/** Per-place metadata for /place/<id> and /zh/place/<id>. */
export function placeMetadata(place: Place, lang: Lang): Metadata {
  const title = placeTitle(place, lang);
  const description = placeDescription(place, lang);
  return {
    title,
    description,
    openGraph: baseOpenGraph(
      title,
      description,
      placePath(lang, place.legacy_id)
    ),
  };
}

// Info-page share descriptions. NEW wording (the live app's info
// pages are overlays and carry no descriptions of their own) —
// plain summaries of each page's own text, flagged in the slice
// report for Jenny's review.
const INFO_DESCRIPTIONS: Record<Lang, Record<InfoPageKey | "contact", string>> = {
  en: {
    about:
      "How Hao Chi Taiwan works: Jenny's personal guide to small restaurants, cafés and street-food spots across Taiwan — what Recommended and Want to Try mean, no paid placements, and where the details come from.",
    privacy:
      "Hao Chi Taiwan's privacy page: no accounts and no tracking — what stays on your own device, how Near me uses your location only when you ask, and the services the guide uses or links to.",
    terms:
      "The plain terms for using Hao Chi Taiwan: a personal guide rather than a guarantee, details that can change, and ratings and links that belong to their owners.",
    contact:
      "Contact Hao Chi Taiwan — send feedback, report a problem with a place (closed, moved, wrong hours, a broken link), or suggest somewhere Jenny should try.",
  },
  zh: {
    about:
      "「好吃台灣」怎麼運作：Jenny 個人的台灣美食指南 — 「推薦」和「想去試試」是什麼意思、沒有付費置入，以及店家資訊從哪裡來。",
    privacy:
      "「好吃台灣」的隱私頁面：沒有帳號、沒有追蹤 — 哪些東西只留在你自己的裝置上、「我附近」只在你要求時才使用你的位置，以及這份指南使用或連結到的服務。",
    terms:
      "使用「好吃台灣」的簡單條款：這是個人指南而不是保證、資訊可能有變動，以及評分與連結屬於其擁有者。",
    contact:
      "聯絡「好吃台灣」 — 寄送意見回饋、回報某家店的問題（歇業、搬家、營業時間錯誤、連結壞掉），或推薦 Jenny 去試的店。",
  },
};

/** Metadata for an info page (/about, /privacy, /terms + /zh/ twins). */
export function infoMetadata(lang: Lang, key: InfoPageKey): Metadata {
  const pages = INFO_PAGES[lang];
  const title =
    key === "about"
      ? pages.about_title
      : key === "privacy"
        ? pages.privacy_title
        : pages.terms_title;
  const description = INFO_DESCRIPTIONS[lang][key];
  return {
    title,
    description,
    openGraph: baseOpenGraph(title, description, infoPath(lang, key)),
  };
}

/** Metadata for the contact page (/contact + /zh/contact). */
export function contactMetadata(lang: Lang): Metadata {
  const title = STRINGS[lang].cf_title;
  const description = INFO_DESCRIPTIONS[lang].contact;
  return {
    title,
    description,
    openGraph: baseOpenGraph(title, description, contactPath(lang)),
  };
}
