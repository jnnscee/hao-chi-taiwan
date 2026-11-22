import type { Metadata } from "next";
import { infoMetadata } from "@/lib/routes";
import InfoPageView from "../../InfoPageView";

// About 頁面（中文）— /about 的 /zh/ 雙生頁。文字：lib/pages.ts。

export const metadata: Metadata = infoMetadata("zh", "about");

export default function ZhAboutPage() {
  return (
    <main className="page">
      <InfoPageView lang="zh" page="about" />
    </main>
  );
}
