import type { Metadata } from "next";
import { contactMetadata } from "@/lib/routes";
import ContactPageClient from "../../ContactPageClient";

// 聯絡與意見回饋頁面（中文）— /contact 的 /zh/ 雙生頁。同一個
// 表單也保留在 App 內的浮動視窗（聯絡區塊、回報問題）。

export const metadata: Metadata = contactMetadata("zh");

export default function ZhContactPage() {
  return (
    <main className="page">
      <ContactPageClient lang="zh" />
    </main>
  );
}
