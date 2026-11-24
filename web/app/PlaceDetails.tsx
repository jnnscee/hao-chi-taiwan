"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng, Place } from "@/lib/places";
import { STRINGS, type Lang } from "@/lib/i18n";
import PlaceDetailView from "./PlaceDetailView";

type Props = {
  place: Place;
  lang: Lang;
  isSaved: boolean;
  /** Distance from the visitor in km while a location is known, else null. */
  distanceKm: number | null;
  /** The visitor's shared location, for the directions origin. */
  visitorOrigin: LatLng | null;
  onToggleSave: (place: Place) => void;
  /** Opens the Contact & feedback form pre-filled for this place. */
  onReport: (place: Place) => void;
  /** True while the contact form is open above this dialog: Escape
   *  then belongs to the form, not to this dialog. */
  suspended: boolean;
  onClose: () => void;
};

/**
 * The details dialog: backdrop + close chrome around
 * PlaceDetailView (which the place's own page renders directly).
 * Escape closes the driver card first, then the dialog.
 */
export default function PlaceDetails({
  place,
  lang,
  isSaved,
  distanceKm,
  visitorOrigin,
  onToggleSave,
  onReport,
  suspended,
  onClose,
}: Props) {
  const t = STRINGS[lang];
  const [driverOpen, setDriverOpen] = useState(false);
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

        <PlaceDetailView
          place={place}
          lang={lang}
          isSaved={isSaved}
          distanceKm={distanceKm}
          visitorOrigin={visitorOrigin}
          onToggleSave={onToggleSave}
          onReport={onReport}
          driverOpen={driverOpen}
          onDriverOpenChange={setDriverOpen}
        />
      </div>
    </div>
  );
}
