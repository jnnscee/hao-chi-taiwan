"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/places";
import {
  calendarUrl,
  deepLinkFor,
  directionsUrl,
  lastCheckedLabel,
  reportMailto,
} from "@/lib/details";

type Props = {
  place: Place;
  isSaved: boolean;
  onToggleSave: (place: Place) => void;
  onClose: () => void;
};

export default function PlaceDetails({
  place,
  isSaved,
  onToggleSave,
  onClose,
}: Props) {
  const [driverOpen, setDriverOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Sensible focus: land on the close button when the dialog opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape closes the driver card first, then the dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (driverOpen) setDriverOpen(false);
      else onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [driverOpen, onClose]);

  const deepLink = deepLinkFor(window.location.origin, place.legacy_id);
  const checkedLabel = lastCheckedLabel(place.hours_checked_on);

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `${place.name_zh} · Hao Chi Taiwan`,
          url: deepLink,
        });
        return;
      } catch {
        // User dismissed the share sheet (or it failed): fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(deepLink);
      setShareNote("Link copied");
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
        aria-label={`Details for ${place.name_en}`}
      >
        <button
          type="button"
          ref={closeRef}
          className="dialog-close"
          aria-label="Close details"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="dialog-badges">
          <span className="badge list-badge">
            {place.list_type === "recommended" ? "Recommended" : "Want to Try"}
          </span>
          {place.temporarily_closed ? (
            <span className="badge closed-badge">Temporarily closed</span>
          ) : null}
        </div>

        <h2 className="dialog-name-zh">{place.name_zh}</h2>
        <p className="dialog-name-en">{place.name_en}</p>
        {place.gloss ? <p className="dialog-gloss">{place.gloss}</p> : null}

        <dl className="dialog-facts">
          {place.cuisine ? (
            <div className="fact">
              <dt>Cuisine</dt>
              <dd>{place.cuisine}</dd>
            </div>
          ) : null}
          {place.city || place.district ? (
            <div className="fact">
              <dt>Area</dt>
              <dd>
                {[place.city, place.district].filter(Boolean).join(" · ")}
              </dd>
            </div>
          ) : null}
          {place.address_en ? (
            <div className="fact">
              <dt>Address</dt>
              <dd>{place.address_en}</dd>
            </div>
          ) : null}
          {place.address_zh ? (
            <div className="fact">
              <dt>地址</dt>
              <dd>{place.address_zh}</dd>
            </div>
          ) : null}
          {place.rating_value != null ? (
            <div className="fact">
              <dt>Google rating</dt>
              <dd className="dialog-rating">
                {place.rating_value.toFixed(1)}
                {place.rating_count != null
                  ? ` (${place.rating_count.toLocaleString()} reviews)`
                  : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        {place.hours ? (
          <section className="dialog-section">
            <h3>Hours</h3>
            <p className="hours-text">{place.hours}</p>
            {place.hours_note ? (
              <p className="hours-note">{place.hours_note}</p>
            ) : null}
            {checkedLabel ? (
              <p className="hours-checked">Last checked {checkedLabel}</p>
            ) : null}
            {place.maps_url ? (
              <p>
                <a href={place.maps_url} target="_blank" rel="noreferrer">
                  Check today&rsquo;s hours
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {place.phone || place.website || place.instagram || place.facebook ? (
          <section className="dialog-section">
            <h3>Contact</h3>
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
                    Website
                  </a>
                </li>
              ) : null}
              {place.instagram ? (
                <li>
                  <a href={place.instagram} target="_blank" rel="noreferrer">
                    Instagram
                    {place.instagram_handle
                      ? ` ${place.instagram_handle}`
                      : ""}
                  </a>
                </li>
              ) : null}
              {place.facebook ? (
                <li>
                  <a href={place.facebook} target="_blank" rel="noreferrer">
                    Facebook
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {place.visitor_notes || place.cash_only ? (
          <section className="dialog-section good-to-know">
            <h3>Good to know</h3>
            {place.visitor_notes ? <p>{place.visitor_notes}</p> : null}
            {place.cash_only ? <p>Cash only</p> : null}
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
                Open in Google Maps
              </a>
              <p className="hint">
                Want to keep this place? Once it opens in Google Maps, tap
                Save there and it&rsquo;s in your own lists.
              </p>
            </div>
          ) : null}

          <a
            className="action"
            href={directionsUrl(place)}
            target="_blank"
            rel="noreferrer"
          >
            Get directions
          </a>

          {place.address_zh ? (
            <button
              type="button"
              className="action"
              onClick={() => setDriverOpen(true)}
            >
              Show driver
            </button>
          ) : null}

          <button
            type="button"
            className="action"
            aria-pressed={isSaved}
            onClick={() => onToggleSave(place)}
          >
            {isSaved ? "Saved" : "Save"}
          </button>

          <button type="button" className="action" onClick={share}>
            Share
          </button>

          <a
            className="action"
            href={calendarUrl(place, deepLink, new Date())}
            target="_blank"
            rel="noreferrer"
          >
            Add to calendar
          </a>
          {shareNote ? (
            <p className="share-note" aria-live="polite">
              {shareNote}
            </p>
          ) : null}
        </div>

        <p className="report-row">
          <a className="report-link" href={reportMailto(place, deepLink)}>
            Report a problem with this place
          </a>
        </p>
      </div>

      {driverOpen ? (
        <div
          className="driver-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Show to driver: ${place.name_en}`}
        >
          <button
            type="button"
            className="driver-close"
            aria-label="Close driver card"
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
