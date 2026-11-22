"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/places";
import {
  SAVED_STORAGE_KEY,
  parseSavedIds,
  toggleSavedId,
} from "@/lib/details";
import { STRINGS, type Lang } from "@/lib/i18n";
import { homePath } from "@/lib/routes";
import PlaceDetailView from "./PlaceDetailView";
import ContactForm, { type ContactOpenRequest } from "./ContactForm";
import PageHeader from "./PageHeader";
import SiteFooter from "./SiteFooter";
import LangPrefSync from "./LangPrefSync";

type Props = {
  place: Place;
  lang: Lang;
};

/**
 * A place's own page (/place/<id>, /zh/place/<id>): the site
 * header, a back-to-the-list link, the full details (the same
 * PlaceDetailView the dialog renders), and the footer. Save works
 * on the same device-local saved set as the home list; Report a
 * problem opens the same contact form overlay, pre-filled. There
 * is no Near me here, so no distance row — that stays a home-list
 * feature, as the location is only ever requested there.
 */
export default function PlacePageClient({ place, lang }: Props) {
  const t = STRINGS[lang];
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [contactRequest, setContactRequest] =
    useState<ContactOpenRequest | null>(null);
  const contactNonceRef = useRef(0);

  // On mount: load the device-local saved set. (The page's
  // language — html lang attribute, and the stored preference on
  // /zh/ pages — is applied by LangPrefSync.)
  useEffect(() => {
    try {
      setSavedIds(
        parseSavedIds(window.localStorage.getItem(SAVED_STORAGE_KEY))
      );
    } catch {
      // storage unavailable: no saved places
    }
  }, []);

  function toggleSave(target: Place) {
    setSavedIds((current) => {
      const next = toggleSavedId(current, target.legacy_id);
      try {
        window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: the choice just won't persist
      }
      return next;
    });
  }

  function openReport(target: Place) {
    contactNonceRef.current += 1;
    setContactRequest({
      category: "problem",
      place: target,
      nonce: contactNonceRef.current,
    });
  }

  return (
    <div className="browser">
      <LangPrefSync lang={lang} />
      <PageHeader lang={lang} />

      <p className="back-row">
        <a className="back-link" href={homePath(lang)}>
          ← {t.back_to_list}
        </a>
      </p>

      <PlaceDetailView
        place={place}
        lang={lang}
        isSaved={savedIds.includes(place.legacy_id)}
        distanceKm={null}
        onToggleSave={toggleSave}
        onReport={openReport}
      />

      <SiteFooter lang={lang} />

      <ContactForm
        lang={lang}
        request={contactRequest}
        onClose={() => setContactRequest(null)}
      />
    </div>
  );
}
