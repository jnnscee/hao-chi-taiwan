import { homePath } from "@/lib/routes";
import type { Lang } from "@/lib/i18n";
import LangSwitch from "./LangSwitch";

/**
 * The slim header on the standalone pages (place, info, contact):
 * the site name linking back to the language-matched home page,
 * and the language toggle. The home pages keep their own hero.
 */
export default function PageHeader({ lang }: { lang: Lang }) {
  return (
    <header className="page-header">
      <a className="site-name" href={homePath(lang)}>
        Hao Chi Taiwan <span className="hero-title-zh">好吃台灣</span>
      </a>
      <LangSwitch lang={lang} />
    </header>
  );
}
