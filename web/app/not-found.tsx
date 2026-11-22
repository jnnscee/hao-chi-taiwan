import { homePath } from "@/lib/routes";

// The 404 page: bilingual by necessity — a mistyped address does
// not say which language its visitor wanted. Both home pages are
// one tap away.
export default function NotFound() {
  return (
    <main className="page">
      <div className="browser">
        <header className="page-header">
          <span className="site-name">Hao Chi Taiwan 好吃台灣</span>
        </header>
        <h1 className="dialog-title">Page not found</h1>
        <p>
          That address doesn’t lead to a place in this guide. The full
          list is on the home page.
        </p>
        <p>
          這個地址在這份指南裡找不到。完整清單在首頁。
        </p>
        <div className="info-actions">
          <a className="action primary" href={homePath("en")}>
            All places
          </a>
          <a className="action" href={homePath("zh")}>
            所有店家
          </a>
        </div>
      </div>
    </main>
  );
}
