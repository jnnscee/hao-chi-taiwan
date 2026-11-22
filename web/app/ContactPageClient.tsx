"use client";

import { useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { homePath } from "@/lib/routes";
import ContactForm, { type ContactOpenRequest } from "./ContactForm";
import PageHeader from "./PageHeader";
import SiteFooter from "./SiteFooter";
import LangPrefSync from "./LangPrefSync";

/**
 * The /contact page: the same Contact & feedback form as the
 * in-app overlay (same fields, same composed email links, same
 * recipient), rendered as the page itself in the page variant.
 * The overlay remains the way in from the contact section and a
 * place's Report a problem; this page is its real address.
 */
export default function ContactPageClient({ lang }: { lang: Lang }) {
  const t = STRINGS[lang];
  // A standing open request: the page's form is always shown.
  const [request] = useState<ContactOpenRequest>({
    category: "feedback",
    place: null,
    nonce: 1,
  });

  return (
    <div className="browser">
      <LangPrefSync lang={lang} />
      <PageHeader lang={lang} />

      <p className="back-row">
        <a className="back-link" href={homePath(lang)}>
          ← {t.back_to_list}
        </a>
      </p>

      <ContactForm
        lang={lang}
        request={request}
        onClose={() => {}}
        variant="page"
      />

      <SiteFooter lang={lang} />
    </div>
  );
}
