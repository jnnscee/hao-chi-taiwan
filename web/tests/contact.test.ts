// Composition invariants for lib/contact.ts: the contact form sends
// nothing itself — it composes an email the visitor sends from their
// own app. These are the compositions the contact slice's harness
// proved byte-for-byte, including the Gmail platform branch.

import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  composeContactMessage,
  copyMessageText,
  gmailLinkFor,
  isMobileUserAgent,
  mailtoHref,
  reportPlaceFieldValue,
  reportPlaceRef,
  type ContactFields,
} from "../lib/contact";
import { makePlace } from "./helpers";

const fields = (overrides: Partial<ContactFields> = {}): ContactFields => ({
  category: "feedback",
  placeText: "",
  name: "",
  email: "",
  message: "Great guide!",
  ...overrides,
});

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

describe("composeContactMessage", () => {
  it("a plain message: subject carries the category, body ends with the sent-from line", () => {
    const { subject, body } = composeContactMessage(fields(), null);
    expect(subject).toBe("[Hao Chi Taiwan] Feedback");
    expect(body.split("\n")[0]).toBe("Category: Feedback");
    expect(body).toContain("\n\nGreat guide!\n\n");
    expect(body.endsWith(
      "(Sent from the Hao Chi Taiwan contact form — a screenshot can be attached to this email.)"
    )).toBe(true);
    expect(body).not.toContain("Place:");
    expect(body).not.toContain("Name:");
    expect(body).not.toContain("Reply to:");
  });

  it("optional fields join only when filled, and values are trimmed", () => {
    const { subject, body } = composeContactMessage(
      fields({ placeText: "  Some stall  ", name: " Jo ", email: " jo@example.com ", message: "  hi  " }),
      null
    );
    expect(subject).toBe("[Hao Chi Taiwan] Feedback — Some stall");
    expect(body).toContain("Place: Some stall");
    expect(body).toContain("Name: Jo");
    expect(body).toContain("Reply to: jo@example.com");
    expect(body).toContain("\n\nhi\n\n");
  });

  it("a reported place puts its name in the subject and its page + Maps links in the body", () => {
    const place = makePlace();
    const ref = reportPlaceRef(place, "https://example.com/place/r999");
    const { subject, body } = composeContactMessage(
      fields({ category: "problem", placeText: reportPlaceFieldValue(place) }),
      ref
    );
    expect(subject).toBe("[Hao Chi Taiwan] Report a problem — Test Place");
    expect(body).toContain("Place page: https://example.com/place/r999");
    expect(body).toContain("Google Maps: https://maps.example/short");
    expect(reportPlaceFieldValue(place)).toBe("Test Place (測試店)");
  });

  it("reportPlaceRef prefers the short Maps link and falls back to the full one", () => {
    expect(reportPlaceRef(makePlace(), "u").mapsUrl).toBe("https://maps.example/short");
    expect(
      reportPlaceRef(makePlace({ maps_short_url: null }), "u").mapsUrl
    ).toBe("https://maps.example/full");
    expect(
      reportPlaceRef(makePlace({ maps_short_url: null, maps_url: null }), "u").mapsUrl
    ).toBeNull();
  });

  it("an unknown category falls back to Feedback", () => {
    const { subject } = composeContactMessage(
      fields({ category: "nope" as ContactFields["category"] }),
      null
    );
    expect(subject).toBe("[Hao Chi Taiwan] Feedback");
  });
});

describe("the send hrefs", () => {
  it("mailto addresses CONTACT_EMAIL with the composed subject and body", () => {
    const href = mailtoHref(fields(), null);
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(href).toContain(encodeURIComponent("[Hao Chi Taiwan] Feedback"));
  });

  it("Gmail on a phone UA uses the app scheme and stays in the same tab", () => {
    const link = gmailLinkFor(fields(), null, IPHONE_UA);
    expect(link.href.startsWith(`googlegmail://co?to=${CONTACT_EMAIL}&`)).toBe(true);
    expect(link.targetBlank).toBe(false);
  });

  it("Gmail on a desktop UA uses web compose in a new tab", () => {
    const link = gmailLinkFor(fields(), null, DESKTOP_UA);
    expect(
      link.href.startsWith(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${CONTACT_EMAIL}&su=`
      )
    ).toBe(true);
    expect(link.targetBlank).toBe(true);
  });

  it("isMobileUserAgent follows the live app's test", () => {
    expect(isMobileUserAgent(IPHONE_UA)).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Linux; Android 15)")).toBe(true);
    expect(isMobileUserAgent(DESKTOP_UA)).toBe(false);
  });

  it("copyMessageText is the To/Subject header block over the body", () => {
    const text = copyMessageText(fields(), null);
    expect(text.startsWith(`To: ${CONTACT_EMAIL}\nSubject: [Hao Chi Taiwan] Feedback\n\n`)).toBe(true);
    expect(text).toContain("Great guide!");
  });
});
