"use client";

import { useEffect, useRef, useState } from "react";
import { formatDist, type Place } from "@/lib/places";
import {
  calendarUrl,
  deepLinkFor,
  directionsUrl,
  lastCheckedText,
} from "@/lib/details";
import { STRINGS, cityLabel, type Lang } from "@/lib/i18n";

type Props = {
  place: Place;
  lang: Lang;
  isSaved: boolean;
  /** Distance from the visitor in km while a location is known, else null. */
  distanceKm: number | null;
  onToggleSave: (place: Place) => void;
  /** Opens the Contact & feedback form pre-filled for this place. */
  onReport: (place: Place) => void;
  /** True while the contact form is open above this dialog: Escape
   *  then belongs to the form, not to this dialog. */
  suspended: boolean;
  onClose: () => void;
};

export default function PlaceDetails({
  place,
  lang,
  isSaved,
  distanceKm,
  onToggleSave,
  onReport,
  suspended,
  onClose,
}: Props) {
  const t = STRINGS[lang];
  const [driverOpen, setDriverOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Sensible focus: land on the close button when the dialog opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape closes the driver card first, then the dialog — but not
  // while the contact form is open above this dialog (its own
  // Escape handling closes it, and this dialog stays underneath).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || suspended) return;
      if (driverOpen) setDriverOpen(false);
      else onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [driverOpen, suspended, onClose]);

  const deepLink = deepLinkFor(window.location.origin, place.legacy_id, lang);
  const checkedText = lastCheckedText(place.hours_checked_on, lang);

  async function share() {
    // Mirrors the live app: the share title uses the place's English
    // name in English mode and its Chinese name in Chinese mode, plus
    // the language-matched suffix; the deep link carries the language.
    const title =
      (lang === "zh" ? place.name_zh : place.name_en) + t.share_title_suffix;
    const hasShare =
      typeof navigator !== "undefined" && "share" in navigator;
    if (hasShare) {
      try {
        await navigator.share({ title, url: deepLink });
        return;
      } catch {
        // User dismissed the share sheet (or it failed): fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(deepLink);
      setShareNote(hasShare ? t.link_copied : t.share_no_sheet);
    } catch {
      setShareNote(deepLink);
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${t.details}: ${place.name_zh}`}
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

        <div className="dialog-badges">
          <span className="badge list-badge">
            {place.list_type === "recommended"
              ? t.list_recommended
              : t.list_want}
          </span>
          {place.temporarily_closed ? (
            <span className="badge closed-badge">{t.temp_closed}</span>
          ) : null}
        </div>

        <h2 className="dialog-name-zh">{place.name_zh}</h2>
        <p className="dialog-name-en">{place.name_en}</p>
        {place.gloss ? <p className="dialog-gloss">{place.gloss}</p> : null}

        <dl className="dialog-facts">
          {place.cuisine ? (
            <div className="fact">
              <dt>{t.label_cuisine}</dt>
              <dd>{place.cuisine}</dd>
            </div>
          ) : null}
          {place.city || place.district ? (
            <div className="fact">
              <dt>{t.f_area}</dt>
              <dd>
                {[place.district, cityLabel(lang, place.city ?? "")]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
          ) : null}
          {distanceKm != null ? (
            <div className="fact">
              <dt>{t.f_distance}</dt>
              <dd>{formatDist(distanceKm)}</dd>
            </div>
          ) : null}
          {place.address_en ? (
            <div className="fact">
              <dt>{t.f_address}</dt>
              <dd>{place.address_en}</dd>
            </div>
          ) : null}
          {place.address_zh ? (
            <div className="fact">
              <dt>{t.f_address_zh}</dt>
              <dd>{place.address_zh}</dd>
            </div>
          ) : null}
          {place.rating_value != null ? (
            <div className="fact">
              <dt>{t.google_rating}</dt>
              <dd className="dialog-rating">
                {place.rating_value.toFixed(1)}
                {place.rating_count != null
                  ? ` · ${place.rating_count.toLocaleString()} ${t.reviews_word}`
                  : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        {place.hours ? (
          <section className="dialog-section">
            <h3>{t.f_hours}</h3>
            <p className="hours-text">{place.hours}</p>
            {place.hours_note ? (
              <p className="hours-note">{place.hours_note}</p>
            ) : null}
            {checkedText ? (
              <p className="hours-checked">{checkedText}</p>
            ) : null}
            {place.maps_url ? (
              <p>
                <a href={place.maps_url} target="_blank" rel="noreferrer">
                  {t.check_todays_hours}
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {place.phone || place.website || place.instagram || place.facebook ? (
          <section className="dialog-section">
            <h3>{t.label_contact}</h3>
            <ul className="link-list">
              {place.phone ? (
                <li>
                  <a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>
                    {place.phone}
                  </a>
                </li>
              ) : null}
              {place.website ? (
                <li>
                  <a href={place.website} target="_blank" rel="noreferrer">
                    {t.f_website}
                  </a>
                </li>
              ) : null}
              {place.instagram ? (
                <li>
                  <a href={place.instagram} target="_blank" rel="noreferrer">
                    {t.f_instagram}
                    {place.instagram_handle
                      ? ` ${place.instagram_handle}`
                      : ""}
                  </a>
                </li>
              ) : null}
              {place.facebook ? (
                <li>
                  <a href={place.facebook} target="_blank" rel="noreferrer">
                    {t.f_facebook}
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {place.visitor_notes || place.cash_only ? (
          <section className="dialog-section good-to-know">
            <h3>{t.good_to_know}</h3>
            {place.visitor_notes ? <p>{place.visitor_notes}</p> : null}
            {place.cash_only ? <p>{t.cash_only_place}</p> : null}
          </section>
        ) : null}

        <div className="dialog-actions">
          {place.maps_url ? (
            <div className="maps-action">
              <a
                className="action primary"
                href={place.maps_url}
                target="_blank"
                rel="noreferrer"
              >
                {t.open_maps}
              </a>
              <p className="hint">{t.maps_save_hint}</p>
            </div>
          ) : null}

          <a
            className="action"
            href={directionsUrl(place)}
            target="_blank"
            rel="noreferrer"
          >
            {t.dir_title}
          </a>

          {place.address_zh ? (
            <button
              type="button"
              className="action"
              onClick={() => setDriverOpen(true)}
            >
              {t.driver}
            </button>
          ) : null}

          <button
            type="button"
            className="action"
            aria-pressed={isSaved}
            onClick={() => onToggleSave(place)}
          >
            {isSaved ? t.saved : t.save}
          </button>

          <button type="button" className="action" onClick={share}>
            {t.share}
          </button>

          <a
            className="action"
            href={calendarUrl(place, deepLink, new Date(), t.cal_view_in)}
            target="_blank"
            rel="noreferrer"
          >
            {t.cal_btn}
          </a>
          {shareNote ? (
            <p className="share-note" aria-live="polite">
              {shareNote}
            </p>
          ) : null}
        </div>

        <p className="report-row">
          <button
            type="button"
            className="report-link"
            onClick={() => onReport(place)}
          >
            {t.report_place}
          </button>
        </p>
      </div>

      {driverOpen ? (
        <div
          className="driver-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={place.name_zh}
        >
          <button
            type="button"
            className="driver-close"
            aria-label={t.close}
            onClick={() => setDriverOpen(false)}
          >
            ✕
          </button>
          <p className="driver-name">{place.name_zh}</p>
          <p className="driver-address">{place.address_zh}</p>
        </div>
      ) : null}
    </div>
  );
}
