"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/places";
import { CONTACT_EMAIL } from "@/lib/details";
import { placeUrl } from "@/lib/routes";
import {
  CONTACT_CATEGORIES,
  copyMessageText,
  gmailLinkFor,
  mailtoHref,
  reportPlaceFieldValue,
  reportPlaceRef,
  type ContactCategoryKey,
  type ContactFields,
  type ContactPlaceRef,
} from "@/lib/contact";
import { STRINGS, type Lang } from "@/lib/i18n";

/**
 * One request to open the form. `nonce` changes on every open so the
 * prefill effect re-runs even for the same category/place; the place
 * is the details "Report a problem" target, or null for a general
 * message (footer, contact section, info pages).
 */
export type ContactOpenRequest = {
  category: ContactCategoryKey;
  place: Place | null;
  nonce: number;
};

type Props = {
  lang: Lang;
  /** The latest open request, or null while the form is closed. The
   *  component stays mounted either way, so typed name/email/message
   *  survive a close/reopen, exactly as the live app's persistent
   *  overlay keeps its field values. */
  request: ContactOpenRequest | null;
  onClose: () => void;
  /**
   * "overlay" (default): the form floats over the page in a dialog,
   * as it has since the contact slice. "page": the same form is the
   * body of the /contact page itself — no backdrop, no close
   * button, no Escape handling; it is simply always shown.
   */
  variant?: "overlay" | "page";
};

export default function ContactForm({
  lang,
  request,
  onClose,
  variant = "overlay",
}: Props) {
  const t = STRINGS[lang];
  const [category, setCategory] = useState<ContactCategoryKey>("feedback");
  const [placeText, setPlaceText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  // The reported place's links, resolved at open time (the deep link
  // needs the current origin + language). Mirrors the live app's
  // contactPlace: set by a report tap, cleared by a general open.
  const [placeRef, setPlaceRef] = useState<ContactPlaceRef | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // On each open: apply the request's category and place prefill and
  // clear the status, as the live app's openContact does. Name,
  // email and message are left as the visitor last typed them.
  useEffect(() => {
    if (!request) return;
    setCategory(request.category);
    setPlaceText(
      request.place ? reportPlaceFieldValue(request.place) : ""
    );
    setPlaceRef(
      request.place
        ? reportPlaceRef(
            request.place,
            placeUrl(window.location.origin, lang, request.place.legacy_id)
          )
        : null
    );
    setStatus(null);
    closeRef.current?.focus();
    // lang is read at open time only; a mid-session toggle keeps the
    // links composed at open, as in the live app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // Escape closes this overlay (the ✕-only rule applies only to the
  // search panel, not to the app's content overlays). The page
  // variant has nothing to close.
  useEffect(() => {
    if (!request || variant === "page") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, onClose, variant]);

  if (!request) return null;

  const fields: ContactFields = { category, placeText, name, email, message };
  // The send controls are real links whose hrefs are composed from
  // the current fields on every render, so the visitor's own tap on
  // a link is what opens their mail app — as in the live app.
  const sendHref = mailtoHref(fields, placeRef);
  const gmail = gmailLinkFor(
    fields,
    placeRef,
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  const categoryLabels: Record<ContactCategoryKey, string> = {
    feedback: t.cf_cat_feedback,
    problem: t.cf_cat_problem,
    suggest: t.cf_cat_suggest,
    other: t.cf_cat_other,
  };

  // Empty-message guard for both send links, as in the live app: the
  // tap is stopped, the inline prompt shows, and focus moves to the
  // message box. With a message present the handler steps aside and
  // the real link opens the mail app on its own.
  function onSendClick(event: React.MouseEvent) {
    if (!message.trim()) {
      event.preventDefault();
      setStatus(t.cf_need);
      messageRef.current?.focus();
      return;
    }
    setStatus(t.cf_opened);
  }

  async function onCopy() {
    if (!message.trim()) {
      setStatus(t.cf_need);
      messageRef.current?.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(copyMessageText(fields, placeRef));
      setStatus(t.cf_copied);
    } catch {
      setStatus(t.cf_copy_fail);
    }
  }

  const formBody = (
    <>
      {variant === "overlay" ? (
        <button
          type="button"
          ref={closeRef}
          className="dialog-close"
          aria-label={t.close}
          onClick={onClose}
        >
          ✕
        </button>
      ) : null}

      <h2 id="cfTitle" className="dialog-title">
        {t.cf_title}
      </h2>
      <p className="cf-intro">{t.cf_intro}</p>

      <div className="cf-fields">
        <label>
          <span>{t.cf_category}</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ContactCategoryKey)
            }
          >
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {categoryLabels[c.key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.cf_place}</span>
          <input
            type="text"
            value={placeText}
            placeholder={t.cf_place_ph}
            autoComplete="off"
            onChange={(event) => setPlaceText(event.target.value)}
          />
        </label>
        <label>
          <span>{t.cf_name}</span>
          <input
            type="text"
            value={name}
            placeholder={t.cf_name_ph}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>{t.cf_email}</span>
          <input
            type="email"
            value={email}
            placeholder={t.cf_email_ph}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>{t.cf_message}</span>
          <textarea
            ref={messageRef}
            value={message}
            placeholder={t.cf_message_ph}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
      </div>

      <p className="cf-note">{t.cf_shot}</p>
      <p className="cf-status" role="status" aria-live="polite">
        {status}
      </p>

      <div className="cf-actions">
        <a className="action primary" href={sendHref} onClick={onSendClick}>
          {t.cf_send}
        </a>
        <a
          className="action"
          href={gmail.href}
          {...(gmail.targetBlank
            ? { target: "_blank", rel: "noopener" }
            : {})}
          onClick={onSendClick}
        >
          {t.cf_gmail}
        </a>
      </div>

      <div className="cf-fallback">
        <p>
          {t.cf_fallback_a}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
          {t.cf_fallback_b}
        </p>
        <button type="button" className="cf-copy-btn" onClick={onCopy}>
          {t.cf_copy}
        </button>
      </div>
    </>
  );

  if (variant === "page") {
    return <div className="contact-page-form">{formBody}</div>;
  }

  return (
    <div className="dialog-backdrop overlay-top">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cfTitle"
      >
        {formBody}
      </div>
    </div>
  );
}
