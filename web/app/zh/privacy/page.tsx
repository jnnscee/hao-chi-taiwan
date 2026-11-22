import type { Metadata } from "next";
import { infoMetadata } from "@/lib/routes";
import InfoPageView from "../../InfoPageView";

// 隱私頁面（中文）— /privacy 的 /zh/ 雙生頁。文字：lib/pages.ts。

export const metadata: Metadata = infoMetadata("zh", "privacy");

export default function ZhPrivacyPage() {
  return (
    <main className="page">
      <InfoPageView lang="zh" page="privacy" />
    </main>
  );
}
