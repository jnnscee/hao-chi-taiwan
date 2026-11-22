import { INFO_PAGES, type InfoPageKey } from "@/lib/pages";
import { STRINGS, type Lang } from "@/lib/i18n";
import { contactPath, homePath, infoPath } from "@/lib/routes";
import PageHeader from "./PageHeader";
import SiteFooter from "./SiteFooter";
import LangPrefSync from "./LangPrefSync";

type Props = {
  lang: Lang;
  page: InfoPageKey;
};

/**
 * An info page (/about, /privacy, /terms and their /zh/ twins):
 * the same texts the overlays carried (lib/pages.ts, Privacy
 * adapted to stay true of the rebuild), now at a real address.
 * Cross-links follow the live overlays' own per-page order, but
 * navigate to the real routes in the page's language.
 */
export default function InfoPageView({ lang, page }: Props) {
  const t = STRINGS[lang];
  const pages = INFO_PAGES[lang];

  const title =
    page === "about"
      ? pages.about_title
      : page === "privacy"
        ? pages.privacy_title
        : pages.terms_title;
  const html =
    page === "about"
      ? pages.about_html
      : page === "privacy"
        ? pages.privacy_html
        : pages.terms_html;
  const btnLabel: Record<InfoPageKey, string> = {
    about: pages.about_btn,
    privacy: pages.privacy_btn,
    terms: pages.terms_btn,
  };
  // The live overlays' action rows, in their own order per page:
  // About leads with Contact; Privacy and Terms lead with the pages.
  const order: (InfoPageKey | "contact")[] =
    page === "about"
      ? ["contact", "privacy", "terms"]
      : page === "privacy"
        ? ["about", "terms", "contact"]
        : ["about", "privacy", "contact"];

  return (
    <div className="browser">
      <LangPrefSync lang={lang} />
      <PageHeader lang={lang} />

      <p className="back-row">
        <a className="back-link" href={homePath(lang)}>
          ← {t.back_to_list}
        </a>
      </p>

      <h1 className="dialog-title">{title}</h1>
      {page !== "about" ? (
        <p className="info-updated">{pages.updated}</p>
      ) : null}
      <div
        className="info-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="info-actions">
        {order.map((item) =>
          item === "contact" ? (
            <a
              key="contact"
              className="action primary"
              href={contactPath(lang)}
            >
              {t.contact_h}
            </a>
          ) : (
            <a key={item} className="action" href={infoPath(lang, item)}>
              {btnLabel[item]}
            </a>
          )
        )}
      </div>

      <SiteFooter lang={lang} />
    </div>
  );
}
