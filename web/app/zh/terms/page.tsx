import type { Metadata } from "next";
import { infoMetadata } from "@/lib/routes";
import InfoPageView from "../../InfoPageView";

// 使用條款頁面（中文）— /terms 的 /zh/ 雙生頁。文字：lib/pages.ts。

export const metadata: Metadata = infoMetadata("zh", "terms");

export default function ZhTermsPage() {
  return (
    <main className="page">
      <InfoPageView lang="zh" page="terms" />
    </main>
  );
}
