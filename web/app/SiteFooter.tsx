import { STRINGS, type Lang } from "@/lib/i18n";
import { INFO_PAGES } from "@/lib/pages";
import { contactPath, infoPath } from "@/lib/routes";
import InstallButton from "./InstallButton";

/**
 * The site footer with real links: About · Privacy · Terms ·
 * Contact & feedback navigate to their own pages in the current
 * language (they were overlay buttons before the real-addresses
 * slice). Shared by the home pages and the standalone pages.
 */
export default function SiteFooter({ lang }: { lang: Lang }) {
  const t = STRINGS[lang];
  const pages = INFO_PAGES[lang];
  return (
    <footer className="site-footer">
      <p>{t.foot1}</p>
      <p>{t.foot2}</p>
      <nav className="foot-links" aria-label="About / 關於">
        <a className="foot-link" href={infoPath(lang, "about")}>
          {pages.about_btn}
        </a>
        <a className="foot-link" href={infoPath(lang, "privacy")}>
          {pages.privacy_btn}
        </a>
        <a className="foot-link" href={infoPath(lang, "terms")}>
          {pages.terms_btn}
        </a>
        <a className="foot-link" href={contactPath(lang)}>
          {t.contact_h}
        </a>
        {/* The live app's footer entry: fires the browser's install
            prompt where one exists, else shows the Add to Home
            Screen steps. Renders nothing once installed. */}
        <InstallButton lang={lang} />
        {/* The one public trace of the admin area: a discreet link
            to Jenny's sign-in. Visitors gain nothing from it —
            /admin asks for an email code and only her account
            gets in. */}
        <a className="foot-link" href="/admin">
          Admin
        </a>
      </nav>
    </footer>
  );
}
