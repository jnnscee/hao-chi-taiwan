// Pure composition logic for the Contact & feedback form: the email
// subject/body, the mailto and Gmail hrefs (with the live app's
// platform branch) and the Copy-message text. Kept free of React and
// browser globals (the user agent is passed in) so the behaviour can
// be unit-checked in plain node.
//
// Everything here mirrors the live app's contactCompose / syncCfSend /
// copyContactMessage exactly: the form itself sends nothing — the
// visitor's own email app opens with the message filled in, addressed
// to CONTACT_EMAIL, and nothing is sent until they press Send there.

import { CONTACT_EMAIL } from "./details";
import type { Place } from "./places";

export { CONTACT_EMAIL };

export type ContactCategoryKey = "feedback" | "problem" | "suggest" | "other";

/** The live app's CF_CATS: keys with their (always-English) email labels. */
export const CONTACT_CATEGORIES: { key: ContactCategoryKey; en: string }[] = [
  { key: "feedback", en: "Feedback" },
  { key: "problem", en: "Report a problem" },
  { key: "suggest", en: "Suggest a place" },
  { key: "other", en: "Other" },
];

export type ContactFields = {
  category: ContactCategoryKey;
  placeText: string;
  name: string;
  email: string;
  message: string;
};

/**
 * The place a message was opened from (a details "Report a problem"
 * tap), or null for a general message. Mirrors the live app's
 * contactPlace: while set, its name goes in the subject and its page
 * and Maps links join the body.
 */
export type ContactPlaceRef = {
  nameEn: string;
  placePageUrl: string;
  mapsUrl: string | null;
};

/** Build the ContactPlaceRef for a place, given its deep link. */
export function reportPlaceRef(place: Place, deepLink: string): ContactPlaceRef {
  return {
    nameEn: place.name_en || place.name_zh,
    placePageUrl: deepLink,
    // The live app prefers the short Maps link, falling back to the full one.
    mapsUrl: place.maps_short_url || place.maps_url,
  };
}

/** The Place field's pre-filled value for a reported place: "en (zh)". */
export function reportPlaceFieldValue(place: Place): string {
  return `${place.name_en} (${place.name_zh})`;
}

/** Compose the email from the current field values (live contactCompose). */
export function composeContactMessage(
  fields: ContactFields,
  placeRef: ContactPlaceRef | null
): { subject: string; body: string } {
  const cat =
    CONTACT_CATEGORIES.find((c) => c.key === fields.category) ??
    CONTACT_CATEGORIES[0];
  const placeTxt = fields.placeText.trim();
  const msg = fields.message.trim();
  const subject =
    "[Hao Chi Taiwan] " +
    cat.en +
    (placeRef ? " — " + placeRef.nameEn : placeTxt ? " — " + placeTxt : "");
  const lines: string[] = [];
  lines.push("Category: " + cat.en);
  if (placeTxt) lines.push("Place: " + placeTxt);
  if (placeRef) {
    lines.push("Place page: " + placeRef.placePageUrl);
    if (placeRef.mapsUrl) lines.push("Google Maps: " + placeRef.mapsUrl);
  }
  const nm = fields.name.trim();
  if (nm) lines.push("Name: " + nm);
  const em = fields.email.trim();
  if (em) lines.push("Reply to: " + em);
  lines.push("");
  lines.push(msg);
  lines.push("");
  lines.push(
    "(Sent from the Hao Chi Taiwan contact form — a screenshot can be attached to this email.)"
  );
  return { subject, body: lines.join("\n") };
}

/** The "Open in email app" href: a plain mailto with subject + body. */
export function mailtoHref(
  fields: ContactFields,
  placeRef: ContactPlaceRef | null
): string {
  const m = composeContactMessage(fields, placeRef);
  const q =
    "?subject=" +
    encodeURIComponent(m.subject) +
    "&body=" +
    encodeURIComponent(m.body);
  return "mailto:" + CONTACT_EMAIL + q;
}

/** The live app's mobile test for the Gmail platform branch. */
export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export type GmailLink = { href: string; targetBlank: boolean };

/**
 * The "Open in Gmail" href, platform-branched exactly as the live app:
 * the googlegmail:// app scheme only resolves where the Gmail app is
 * installed (phones); on desktop that click would do nothing, so
 * desktop gets Gmail on the web instead, opened in a new tab.
 */
export function gmailLinkFor(
  fields: ContactFields,
  placeRef: ContactPlaceRef | null,
  userAgent: string
): GmailLink {
  const m = composeContactMessage(fields, placeRef);
  if (isMobileUserAgent(userAgent)) {
    const q =
      "?subject=" +
      encodeURIComponent(m.subject) +
      "&body=" +
      encodeURIComponent(m.body);
    return {
      href: "googlegmail://co?to=" + CONTACT_EMAIL + "&" + q.slice(1),
      targetBlank: false,
    };
  }
  return {
    href:
      "https://mail.google.com/mail/?view=cm&fs=1&to=" +
      CONTACT_EMAIL +
      "&su=" +
      encodeURIComponent(m.subject) +
      "&body=" +
      encodeURIComponent(m.body),
    targetBlank: true,
  };
}

/** The Copy-message text: headers plus the composed body. */
export function copyMessageText(
  fields: ContactFields,
  placeRef: ContactPlaceRef | null
): string {
  const m = composeContactMessage(fields, placeRef);
  return "To: " + CONTACT_EMAIL + "\nSubject: " + m.subject + "\n\n" + m.body;
}
