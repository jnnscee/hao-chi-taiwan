"use client";

import { useEffect, useState } from "react";
import { formatDist, type Place } from "@/lib/places";
import { calendarUrl, directionsUrl, lastCheckedText } from "@/lib/details";
import { placeUrl } from "@/lib/routes";
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
  /**
   * Optional external control of the Show driver overlay. The
   * details dialog uses it so its Escape handling can close the
   * driver card before the dialog; the place page leaves it
   * uncontrolled and the view manages (and Escape-closes) it.
   */
  driverOpen?: boolean;
  onDriverOpenChange?: (open: boolean) => void;
};

/**
 * A place's full details — the content of the details dialog and
 * of the place's own page (/place/<id>, /zh/place/<id>), identical
 * in both: names and gloss, badges, facts, hours, contact links,
 * "Good to know", and the actions (Open in Google Maps + save hint,
 * Get directions, Show driver, Save, Share, Add to calendar,
 * Report a problem). The dialog adds its backdrop/close chrome
 * around this; the page adds the site header and a back link.
 */
export default function PlaceDetailView({
  place,
  lang,
  isSaved,
  distanceKm,
  onToggleSave,
  onReport,
  driverOpen: driverControlled,
  onDriverOpenChange,
}: Props) {
  const t = STRINGS[lang];
  const [driverInternal, setDriverInternal] = useState(false);
  const driverOpen = driverControlled ?? driverInternal;
  const setDriverOpen = onDriverOpenChange ?? setDriverInternal;
  const [shareNote, setShareNote] = useState<string | null>(null);

  // The origin is only known on the client; before mount the share
  // / calendar links carry the root-relative path, which resolves
  // to the same address. (This view is also server-rendered, as a
  // place page's body, where `window` does not exist.)
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Uncontrolled (place page): Escape closes the driver card. In
  // the dialog the wrapper owns Escape ordering instead.
  useEffect(() => {
    if (driverControlled !== undefined || !driverInternal) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDriverInternal(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [driverControlled, driverInternal]);

  // The place's own page URL: what Share shares, what the calendar
  // event links back to, and what a problem report references.
  const pageUrl = placeUrl(origin, lang, place.legacy_id);
  const checkedText = lastCheckedText(place.hours_checked_on, lang);

  async function share() {
    // Mirrors the live app: the share title uses the place's English
    // name in English mode and its Chinese name in Chinese mode, plus
    // the language-matched suffix; the link is the place's own page
    // in the current language.
    const title =
      (lang === "zh" ? place.name_zh : place.name_en) + t.share_title_suffix;
    const hasShare =
      typeof navigator !== "undefined" && "share" in navigator;
    if (hasShare) {
      try {
        await navigator.share({ title, url: pageUrl });
        return;
      } catch {
        // User dismissed the share sheet (or it failed): fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
      setShareNote(hasShare ? t.link_copied : t.share_no_sheet);
    } catch {
      setShareNote(pageUrl);
    }
  }

  return (
    <div className="place-detail">
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
          href={calendarUrl(place, pageUrl, new Date(), t.cal_view_in)}
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
          {/* Jenny's polite request line (her exact wording, settled
              2026-11-22): fixed Chinese in BOTH languages — the card is
              shown to the driver, so it speaks to the driver, politely,
              as someone already in the taxi. */}
          <p className="driver-request">師傅，請帶我到這個地址，謝謝！</p>
          <p className="driver-name">{place.name_zh}</p>
          <p className="driver-address">{place.address_zh}</p>
        </div>
      ) : null}
    </div>
  );
}
