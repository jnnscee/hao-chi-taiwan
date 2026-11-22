"use client";

import { useEffect, useRef } from "react";
import { INFO_PAGES, type InfoPageKey } from "@/lib/pages";
import { STRINGS, type Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  /** The open page, or null while all info overlays are closed. */
  page: InfoPageKey | null;
  onOpenPage: (page: InfoPageKey) => void;
  onOpenContact: () => void;
  onClose: () => void;
};

/**
 * The About / Privacy / Terms overlays: one component, three pages,
 * cross-linked exactly as the live app's info overlays are — each
 * page offers the other two pages plus Contact & feedback. Content
 * comes from lib/pages.ts (the live app's INFO_PAGES, with the
 * Privacy text adapted to stay true of the rebuild).
 */
export default function InfoOverlay({
  lang,
  page,
  onOpenPage,
  onOpenContact,
  onClose,
}: Props) {
  const t = STRINGS[lang];
  const pages = INFO_PAGES[lang];
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // On open or page switch: start at the top and land focus on the
  // close button, mirroring the live app's openInfo.
  useEffect(() => {
    if (!page) return;
    if (backdropRef.current) backdropRef.current.scrollTop = 0;
    closeRef.current?.focus();
  }, [page]);

  // Escape closes this overlay (the ✕-only rule applies only to the
  // search panel, not to the app's content overlays).
  useEffect(() => {
    if (!page) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, onClose]);

  if (!page) return null;

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
    <div className="dialog-backdrop overlay-top" ref={backdropRef}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="infoTitle"
      >
        <button
          type="button"
          ref={closeRef}
          className="dialog-close"
          aria-label={t.close}
          onClick={onClose}
        >
          ✕
        </button>

        <h2 id="infoTitle" className="dialog-title">
          {title}
        </h2>
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
              <button
                key="contact"
                type="button"
                className="action primary"
                onClick={onOpenContact}
              >
                {t.contact_h}
              </button>
            ) : (
              <button
                key={item}
                type="button"
                className="action"
                onClick={() => onOpenPage(item)}
              >
                {btnLabel[item]}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
