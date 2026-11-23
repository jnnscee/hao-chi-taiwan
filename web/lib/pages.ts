// About / Privacy / Terms page content for the rebuild's info
// overlays, lifted from the CURRENT live app's INFO_PAGES table
// (the production deploy copy's inline script, extracted 2026-11-22).
// Jenny approved that wording in the live app; do not re-translate
// or re-write it here.
//
// The ONE exception is the Privacy text, which must be true of the
// REBUILD as built. Adaptations from the live text (each minimal,
// each listed for Jenny's review in the slice report):
//  1. The live text says the typefaces load from Google Fonts. The
//     rebuild loads no webfonts at all — it uses the device's own
//     system typefaces — so the services bullet names what the
//     rebuild actually loads: OpenStreetMap's map service, and the
//     Supabase database service the place list is kept in.
//  2. The live text's "offline copy" bullet describes the live app's
//     service-worker copy. The rebuild initially had no offline
//     copy, so that bullet was removed rather than claimed; the
//     offline/PWA slice then gave the rebuild a real service
//     worker, and the bullet is RESTORED, mirroring the live app's
//     original bullet (see the privacy_html lists below).
//  3. The rebuild also remembers the visitor's language choice
//     (hao-chi-lang-v1) on the device, so a language-choice bullet
//     joins Saved places and the view choice.
//  4. The live text says location is read when "asking for
//     directions". In the rebuild the directions button is a plain
//     Google Maps link that never reads the visitor's location —
//     only Near me and Nearest sorting do — so that phrase is gone.
//  5. The live text calls the Save control "(the heart)". The
//     rebuild's Save is a labelled button, so the parenthetical is
//     removed.
//  6. A Vercel hosting bullet is added: Vercel keeps basic server
//     logs, as the audit of the rebuild records.
// About and Terms are verbatim, unadapted.

import type { Lang } from "./i18n";

export type InfoPageKey = "about" | "privacy" | "terms";

export type InfoPageSet = {
  about_btn: string;
  privacy_btn: string;
  terms_btn: string;
  updated: string;
  about_title: string;
  privacy_title: string;
  terms_title: string;
  about_html: string;
  privacy_html: string;
  terms_html: string;
};

export const INFO_PAGES: Record<Lang, InfoPageSet> = {
  en: {
    about_btn: "About",
    privacy_btn: "Privacy",
    terms_btn: "Terms",
    updated: "Last updated November 2026",
    about_title: "About — how this guide works",
    privacy_title: "Privacy",
    terms_title: "Terms of use",
    about_html:
      "<h3>Who makes this guide</h3>" +
      "<p>Hao Chi Taiwan is Jenny's personal food guide to Taiwan. Every place here comes from her own Google Maps lists — the places she has eaten at and loved, and the places she still wants to try. Most are in Kaohsiung, especially Zuoying, and many are small mom-and-pop shops and stalls with no website of their own.</p>" +
      "<h3>What “Recommended” means</h3>" +
      "<p>Recommended means Jenny has personally been there, eaten there, and would happily go back and send a friend. Those places keep the order of her own “Taiwan - Tried &amp; Tested” list — that order is her recommendation, not a rating score.</p>" +
      "<h3>What “Want to Try” means</h3>" +
      "<p>Want to Try is Jenny's own to-visit list. She has not eaten at those places yet, so they are not recommendations — they are simply the places she has saved and hopes to get to. They are shown in name order, because their list order means nothing.</p>" +
      "<h3>No paid placements</h3>" +
      "<p>No shop can pay, advertise, or offer anything to be listed here, to become Recommended, or to move up the list. A place is Recommended only because Jenny ate there and liked it. If that ever changes, it will be labelled clearly on this page and on the place itself.</p>" +
      "<h3>What it costs</h3>" +
      "<p>Nothing — Hao Chi Taiwan is free to use. There are no fees, no subscription, and no paid or premium version, and there are no plans to charge. It is a personal project, kept free on purpose. It costs shops nothing too: there are no ads, and no shop can pay to be listed or to become Recommended.</p>" +
      "<h3>Where the details come from</h3>" +
      "<ul><li>Ratings shown are Google ratings, captured when the lists were collected in November 2026. They are shown small, for reference — Jenny's recommendation is the order to trust.</li>" +
      "<li>Hours, phone numbers and addresses come from the shops' own listings. Hours carry a “last checked” date because small shops change their hours often — always use “Check today's hours” in a place's details before you go.</li>" +
      "<li>Chinese names are shown alongside the English names, and every place has a driver card with its Chinese name and address to show a taxi driver.</li></ul>" +
      "<h3>Help keep it accurate</h3>" +
      "<p>Shops close, move and change their hours. If you spot a place that has closed, moved, or has wrong hours or a broken link, please tell us with the Contact &amp; feedback button below — problem reports get checked and fixed.</p>",
    privacy_html:
      "<p><b>The short version:</b> there are no accounts and no sign-up, and this guide does not track you. Nothing about your visit is sent to us.</p>" +
      "<h3>No tracking</h3>" +
      "<p>This page contains no analytics, no advertising trackers and no tracking cookies. We do not build a profile of you, and we cannot see which places you looked at.</p>" +
      "<h3>What stays on your own device</h3>" +
      "<ul><li><b>Saved places</b> — when you tap Save on a place, that choice is stored in this browser on this device only, so your saved list is there when you come back. It is never sent to us and does not sync to other phones or browsers.</li>" +
      "<li><b>Your view choice</b> — whether you last used Cards or Compact list is also remembered on this device only, so the list opens the way you left it.</li>" +
      "<li><b>Your language choice</b> — whether you last used English or 中文 is also remembered on this device only, so the guide opens in your language.</li>" +
      "<li><b>An offline copy</b> — so the guide keeps working with no connection, your browser stores a copy of the app and its place list on your device. That is storage on your device, not tracking.</li></ul>" +
      "<p>You can remove all of it at any time by clearing this site's data in your browser settings.</p>" +
      "<h3>Your location — Near me</h3>" +
      "<p>Your location is used only when you ask for it: tapping “Near me” or choosing “Nearest” sorting. Your browser asks your permission first. Your location is then used inside your own browser to work out distances and order the list — it is not stored, and it is never sent to us.</p>" +
      "<p>One exception you control: if you tap to open directions or a place in Google Maps, Google Maps receives the destination — and, if you shared your location for directions, your starting point — so it can draw the route. That happens in Google Maps, under Google's own privacy policy.</p>" +
      "<h3>Contact &amp; feedback emails</h3>" +
      "<p>The contact form does not send anything itself. When you tap a send button, it opens your own email app with your message filled in, addressed to <a href=\"mailto:haochitaiwan@muse.ai\">haochitaiwan@muse.ai</a> — nothing is sent until you press Send in your email app, and you can edit or delete the message before you do. Emails that reach that inbox are read only to reply to you and to fix problems you report. Please do not send sensitive personal information in a feedback email.</p>" +
      "<h3>Other services this page uses or links to</h3>" +
      "<ul><li>The map pictures are drawn by OpenStreetMap's map service. As with any website, that service receives the technical information a browser sends to load a page, such as your IP address. The guide's place list is kept in its database service (Supabase) and served to your browser with the page, and the guide uses the typefaces already on your device, so no font service is loaded.</li>" +
      "<li>The guide is hosted by Vercel, which keeps basic server logs (such as which pages were requested and IP addresses) to run and protect the site, as any web host does.</li>" +
      "<li>Links to Google Maps, shop websites, Instagram and Facebook are followed only when you tap them. Once you leave this guide, that site's own privacy policy applies.</li></ul>" +
      "<h3>Changes and questions</h3>" +
      "<p>If the guide ever starts doing something different with your information, this page will be updated to say so. Questions about privacy are welcome through Contact &amp; feedback below.</p>",
    terms_html:
      "<p>These are the plain terms for using Hao Chi Taiwan. By using this guide, you agree to them.</p>" +
      "<h3>A personal guide, not a guarantee</h3>" +
      "<p>Recommended places reflect Jenny's own taste and her visits at the time. Another visit — yours or hers — may be different, and a listing here is not a promise about any meal.</p>" +
      "<h3>Details can change</h3>" +
      "<p>Hours, prices, menus, phone numbers and addresses come from the shops' listings and were last checked on the dates shown. Small shops change hours, move, take breaks and close — sometimes without notice. We work to keep the guide accurate and fix problems that are reported, but we cannot guarantee every detail is current. Please check a place's current hours on Google Maps, using “Check today's hours” in its details, before you make a trip for it.</p>" +
      "<h3>Ratings and links belong to their owners</h3>" +
      "<ul><li>Ratings shown are Google ratings from Google Maps users; they belong to Google and those reviewers, and are shown for reference only.</li>" +
      "<li>Links take you to other services — Google Maps, shop websites, Instagram and Facebook. We are not responsible for those sites' content, and their own terms and privacy policies apply once you are there.</li>" +
      "<li>Shop names belong to the shops. Listing a shop here does not mean the shop endorses this guide.</li></ul>" +
      "<h3>Using the guide</h3>" +
      "<ul><li>The guide is free for your personal use — finding somewhere good to eat is exactly what it is for.</li>" +
      "<li>Please use the contact form for its purpose — feedback, problem reports and place suggestions — and not for spam or anything unlawful.</li>" +
      "<li>Saved places live on your own device. If you clear your browser's site data, your saved list goes with it — we have no copy to restore.</li></ul>" +
      "<h3>Changes</h3>" +
      "<p>These terms may be updated as the guide grows; the date at the top shows the latest version. If something here looks wrong, tell us through Contact &amp; feedback below.</p>",
  },
  zh: {
    about_btn: "關於",
    privacy_btn: "隱私",
    terms_btn: "使用條款",
    updated: "最後更新：2026 年 11 月",
    about_title: "關於 — 這份指南怎麼運作",
    privacy_title: "隱私",
    terms_title: "使用條款",
    about_html:
      "<h3>這份指南是誰做的</h3>" +
      "<p>「好吃台灣」是 Jenny 個人的台灣美食指南。這裡的每一家店都來自她自己的 Google Maps 清單 — 她親自吃過、真心喜歡的店，以及她還想去試試的店。大部分都在高雄，尤其是左營；很多是沒有自己網站的小店和攤位。</p>" +
      "<h3>「推薦」是什麼意思</h3>" +
      "<p>「推薦」表示 Jenny 親自去過、在那裡吃過，而且很樂意再去、也會推薦給朋友。這些店的排列順序就是她自己「Taiwan - Tried &amp; Tested」清單的順序 — 那個順序就是她的推薦，不是評分排名。</p>" +
      "<h3>「想去試試」是什麼意思</h3>" +
      "<p>「想去試試」是 Jenny 自己想造訪的清單。她還沒有在那些店吃過，所以那不是推薦 — 只是她存下來、希望有機會去的店。這些店依名稱排序，因為原本清單的順序不代表任何排名。</p>" +
      "<h3>沒有付費置入</h3>" +
      "<p>任何店家都不能付費、打廣告或提供任何好處，來換取被收錄、被列為「推薦」，或在清單中往前排。一家店會成為「推薦」，只因為 Jenny 去吃過而且喜歡。如果這一點日後有任何改變，會在本頁和該店的頁面上清楚標示。</p>" +
      "<h3>費用</h3>" +
      "<p>完全免費 — 「好吃台灣」免費使用。沒有任何費用、沒有訂閱，也沒有付費版或進階版，未來也沒有收費的計畫。這是 Jenny 個人的專案，特意保持免費。對店家也同樣免費：這裡沒有廣告，任何店家都不能付費來換取被收錄或被列為「推薦」。</p>" +
      "<h3>店家資訊從哪裡來</h3>" +
      "<ul><li>顯示的評分是 Google 評分，於 2026 年 11 月擷取清單時取得。評分只以小字供參考 — 請以 Jenny 的推薦順序為準。</li>" +
      "<li>營業時間、電話和地址來自店家自己的刊登資訊。營業時間會標示「最後確認」日期，因為小店經常更改時間 — 出發前請務必在店家詳情點「查看今日營業時間」再確認一次。</li>" +
      "<li>店名同時顯示中文和英文，每家店都有司機卡，上面有中文店名和地址，可以直接秀給計程車司機看。</li></ul>" +
      "<h3>幫我們保持資訊正確</h3>" +
      "<p>店家會歇業、搬家、更改營業時間。如果你發現某家店已經歇業、搬家，或營業時間錯誤、連結壞掉，請用下方的「聯絡與意見回饋」告訴我們 — 問題回報都會逐一確認並修正。</p>",
    privacy_html:
      "<p><b>簡單版：</b>這裡沒有帳號、不用註冊，這份指南不會追蹤你。你造訪的任何資訊都不會傳送給我們。</p>" +
      "<h3>沒有追蹤</h3>" +
      "<p>這個頁面沒有分析工具、沒有廣告追蹤器，也沒有追蹤用的 Cookie。我們不會建立你的個人檔案，也看不到你看過哪些店。</p>" +
      "<h3>只留在你自己裝置上的東西</h3>" +
      "<ul><li><b>收藏的店</b> — 當你在某家店點「收藏」時，那個選擇只會存在這台裝置的這個瀏覽器裡，讓你下次回來時收藏清單還在。它不會傳送給我們，也不會同步到其他手機或瀏覽器。</li>" +
      "<li><b>你的檢視選擇</b> — 你上次用的是「卡片」還是「緊湊清單」，也只會記在這台裝置上，讓清單以你離開時的樣子開啟。</li>" +
      "<li><b>你的語言選擇</b> — 你上次用的是 English 還是中文，也只會記在這台裝置上，讓指南以你的語言開啟。</li>" +
      "<li><b>離線副本</b> — 為了讓指南在沒有網路時也能用，你的瀏覽器會在裝置上存一份 App 和店家清單的副本。那是存在你裝置上的資料，不是追蹤。</li></ul>" +
      "<p>你可以隨時在瀏覽器設定中清除此網站的資料，把以上內容全部移除。</p>" +
      "<h3>你的位置 — 「我附近」</h3>" +
      "<p>你的位置只在你主動要求時才會使用：點「我附近」或選擇「最近」排序時。瀏覽器會先徵求你的許可。之後，你的位置只在你自己的瀏覽器裡用來計算距離和排列清單 — 不會被儲存，也不會傳送給我們。</p>" +
      "<p>有一個由你控制的例外：如果你點開在 Google Maps 的路線或店家頁面，Google Maps 會收到目的地 — 如果你為了路線分享了位置，也會收到你的出發點 — 以便繪製路線。那是在 Google Maps 裡發生的，適用 Google 自己的隱私政策。</p>" +
      "<h3>聯絡與意見回饋的 Email</h3>" +
      "<p>聯絡表單本身不會傳送任何東西。當你點下傳送按鈕時，它會開啟你自己的郵件 App，並自動填好訊息，收件人是 <a href=\"mailto:haochitaiwan@muse.ai\">haochitaiwan@muse.ai</a> — 在你在郵件 App 裡按下傳送之前，什麼都不會寄出，你也可以先修改或刪除訊息。寄到該信箱的信件，只會用來回覆你，以及修正你回報的問題。請不要在意見信裡寄送敏感的個人資訊。</p>" +
      "<h3>這個頁面使用或連結的其他服務</h3>" +
      "<ul><li>地圖圖片由 OpenStreetMap 的地圖服務繪製。和任何網站一樣，該服務會收到瀏覽器為了載入頁面而傳送的技術資訊，例如你的 IP 位址。這份指南的店家清單存放在它的資料庫服務（Supabase），並隨頁面一起傳送到你的瀏覽器。這份指南使用你裝置上已有的字型，不會載入任何字型服務。</li>" +
      "<li>這份指南由 Vercel 代管，它會保留基本的伺服器紀錄（例如被請求的頁面和 IP 位址），來運作和保護網站，和任何網站主機一樣。</li>" +
      "<li>前往 Google Maps、店家網站、Instagram 和 Facebook 的連結，只在你點下時才會前往。離開這份指南後，適用該網站自己的隱私政策。</li></ul>" +
      "<h3>變更與問題</h3>" +
      "<p>如果這份指南日後對你的資訊有不同的處理方式，本頁會更新說明。關於隱私的問題，歡迎用下方的「聯絡與意見回饋」告訴我們。</p>",
    terms_html:
      "<p>以下是使用「好吃台灣」的簡單條款。使用這份指南，即表示你同意這些條款。</p>" +
      "<h3>這是個人指南，不是保證</h3>" +
      "<p>「推薦」的店反映的是 Jenny 個人的口味，以及她當時造訪的經驗。下一次造訪 — 不論是你的還是她的 — 可能會不一樣；被列在這裡，不代表對任何一餐的承諾。</p>" +
      "<h3>資訊可能有變動</h3>" +
      "<p>營業時間、價格、菜單、電話和地址來自店家的刊登資訊，最後確認日期如頁面所示。小店會更改時間、搬家、休息和歇業 — 有時不會事先通知。我們會努力保持指南正確，並修正被回報的問題，但無法保證每一項資訊都是最新的。專程前往之前，請先用店家詳情裡的「查看今日營業時間」在 Google Maps 確認目前的營業時間。</p>" +
      "<h3>評分與連結屬於其擁有者</h3>" +
      "<ul><li>顯示的評分是 Google Maps 使用者的 Google 評分，屬於 Google 和那些評論者，只供參考。</li>" +
      "<li>連結會帶你到其他服務 — Google Maps、店家網站、Instagram 和 Facebook。我們不對那些網站的內容負責；你前往之後，適用它們自己的條款和隱私政策。</li>" +
      "<li>店名屬於各店家。把一家店列在這裡，不表示該店為這份指南背書。</li></ul>" +
      "<h3>使用這份指南</h3>" +
      "<ul><li>這份指南免費供你個人使用 — 找到好吃的店，正是它的用途。</li>" +
      "<li>請依聯絡表單的用途使用它 — 意見回饋、問題回報和推薦店家 — 不要用來寄送垃圾訊息或任何違法內容。</li>" +
      "<li>收藏的店只存在你自己的裝置上。如果你清除了瀏覽器的網站資料，收藏清單也會一併消失 — 我們沒有備份可以幫你還原。</li></ul>" +
      "<h3>變更</h3>" +
      "<p>這些條款可能隨著指南的成長而更新；頁首的日期是最新版本。如果你覺得這裡有任何錯誤，請用下方的「聯絡與意見回饋」告訴我們。</p>",
  },
};
