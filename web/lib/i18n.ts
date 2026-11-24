// UI strings for the rebuild's EN / 中文 toggle.
//
// Provenance: every value below was lifted verbatim from the CURRENT live
// app's I18N table (the production deploy copy's inline script, extracted
// 2026-11-22), including its district_names (33), cuisine_names (86) and
// city_names label tables and the function-valued showing/showing_of/
// showing_all entries, transcribed from source. Jenny approved that
// wording in the live app; do not re-translate it here.
//
// The only exceptions are the entries under "Filled gaps" at the
// bottom of each language object: the live app has no standalone string
// for them (its filter selects carry no visible field labels, and its
// list numbers were bare digits with no "No." wording), so they were
// written plainly for the rebuild. They are listed in the slice report
// for Jenny's review.

export type Lang = "en" | "zh";

export const LANG_STORAGE_KEY = "hao-chi-lang-v1";

export type Strings = {
  stat_total: string;
  stat_recommended: string;
  stat_want: string;
  stat_khh: string;
  // The hero intro paragraph (v1's lede): its counts are the live
  // Recommended / Want to Try totals, interpolated so the sentence
  // stays true as the lists grow.
  lede: (recommended: number, want: number) => string;
  list_label: string;
  list_all: string;
  list_recommended: string;
  list_want: string;
  search_ph: string;
  all_cities: string;
  all_districts: string;
  all_cuisines: string;
  sort: string;
  sort_default: string;
  sort_az: string;
  sort_rating: string;
  sort_nearest: string;
  view_cards: string;
  view_compact: string;
  clear_all: string;
  search_filters: string;
  panel_showing: (n: number, total: number) => string;
  map_h: string;
  map_sub: string;
  empty: string;
  show_more: string;
  details: string;
  save: string;
  saved: string;
  // The Saved view (Phase B fix B-1): v1's saved_view toggle label,
  // its device-only note, the empty state and the count line, under
  // v1's own key names and wording.
  saved_view: string;
  saved_device_only: string;
  saved_empty: string;
  saved_showing: (n: number) => string;
  google_rating: string;
  reviews_word: string;
  temp_closed: string;
  close: string;
  f_area: string;
  f_address: string;
  f_address_zh: string;
  f_hours: string;
  f_website: string;
  f_instagram: string;
  f_facebook: string;
  check_todays_hours: string;
  // v1's hours_reminder: the Google Maps attribution for the listed
  // hours, shown in the hours section alongside the last-checked line
  // (Phase B fix B-5, Jenny's stamp request 2026-11-23).
  hours_reminder: string;
  good_to_know: string;
  cash_only_place: string;
  open_maps: string;
  maps_save_hint: string;
  dir_title: string;
  // The directions mode picker (Phase B fix B-2): v1's four mode
  // labels and its hint line, under v1's own key names.
  dir_transit: string;
  dir_walking: string;
  dir_biking: string;
  dir_driving: string;
  dir_hint: string;
  driver: string;
  share: string;
  link_copied: string;
  share_no_sheet: string;
  share_title_suffix: string;
  share_intro: string;
  cal_btn: string;
  cal_view_in: string;
  report_place: string;
  // Real-addresses slice: the place / info pages' way back to the
  // list. NEW string (the live app has no place pages) — plain
  // wording, flagged in the slice report for Jenny's review.
  back_to_list: string;
  // Contact section, footer and contact form (all values lifted
  // verbatim from the live app's table, under its own key names:
  // contact_h, contact_sub, contact_btn, contact_email_label, foot1,
  // foot2 and the cf_* set).
  contact_h: string;
  contact_sub: string;
  contact_btn: string;
  contact_email_label: string;
  foot1: string;
  foot2: string;
  cf_title: string;
  cf_intro: string;
  cf_category: string;
  cf_cat_feedback: string;
  cf_cat_problem: string;
  cf_cat_suggest: string;
  cf_cat_other: string;
  cf_place: string;
  cf_place_ph: string;
  cf_name: string;
  cf_name_ph: string;
  cf_email: string;
  cf_email_ph: string;
  cf_message: string;
  cf_message_ph: string;
  cf_shot: string;
  cf_send: string;
  cf_gmail: string;
  cf_need: string;
  cf_opened: string;
  cf_fallback_a: string;
  cf_fallback_b: string;
  cf_copy: string;
  cf_copied: string;
  cf_copy_fail: string;
  // Near me (all values lifted verbatim from the live app's table,
  // under its own key names: near_me, near_locating, near_within,
  // near_any, near_clear, near_hint, the near_error_* set, near_found,
  // near_none, offline_near, sort_need_loc, nearest, f_distance).
  near_me: string;
  near_locating: string;
  near_within: string;
  near_any: string;
  near_clear: string;
  near_hint: string;
  near_error_denied: string;
  near_error_unavail: string;
  near_error_timeout: string;
  near_error_unsupported: string;
  offline_near: string;
  sort_need_loc: string;
  f_distance: string;
  near_found: (n: number, r: number) => string;
  near_none: (r: number) => string;
  showing: (n: number) => string;
  showingOf: (shown: number, total: number) => string;
  showingAll: (total: number) => string;
  city_names: Record<string, string>;
  district_names: Record<string, string>;
  cuisine_names: Record<string, string>;
  // Filled gaps (no live-app counterpart; see header note).
  label_city: string;
  label_district: string;
  label_cuisine: string;
  label_view: string;
  label_contact: string;
  contact_none: string;
  place_no: (n: number) => string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    stat_total: "places in total",
    stat_recommended: "Recommended · tried & tested",
    stat_want: "Want to Try",
    stat_khh: "in Kaohsiung",
    lede: (recommended, want) =>
      "Jenny's food guide to Taiwan — " +
      recommended +
      " places she has tried, tested and recommends, plus " +
      want +
      " more she wants to try. Most are in Kaohsiung, from mom-and-pop stalls to old favourites.",
    list_label: "List",
    list_all: "All places",
    list_recommended: "Recommended",
    list_want: "Want to Try",
    search_ph: "Search a place, dish or area…",
    all_cities: "All places",
    all_districts: "All districts",
    all_cuisines: "All food types",
    sort: "Sort",
    sort_default: "Recommended order",
    sort_az: "Name A–Z",
    sort_rating: "Highest Google rating",
    sort_nearest: "Nearest",
    view_cards: "Cards",
    view_compact: "Compact list",
    clear_all: "Clear all",
    search_filters: "Search & filters",
    panel_showing: (n, total) => "Showing " + n + " of " + total,
    map_h: "Where they are",
    map_sub: "Tap a pin to open that place. Use the + and − buttons — or pinch — to zoom in: most of the list clusters in Zuoying, Kaohsiung.",
    empty: "No places match — try a different search or filter.",
    show_more: "Show more",
    details: "Details",
    save: "Save",
    saved: "Saved",
    saved_view: "Saved",
    saved_device_only: "Saved on this device only",
    saved_empty:
      "No saved places yet — tap Save on any place and it will show up here.",
    saved_showing: (n) =>
      n === 1
        ? "Showing your 1 saved place"
        : "Showing your " + n + " saved places",
    google_rating: "Google rating",
    reviews_word: "reviews",
    temp_closed: "Temporarily closed",
    close: "Close",
    f_area: "Area",
    f_address: "Address",
    f_address_zh: "地址 (driver)",
    f_hours: "Hours",
    f_website: "Website",
    f_instagram: "Instagram",
    f_facebook: "Facebook",
    check_todays_hours: "Check today's hours",
    hours_reminder:
      "These are the opening hours listed on Google Maps. Hours can change — especially on holidays — so please check them yourself on Google Maps before you go.",
    good_to_know: "Good to know",
    cash_only_place: "This place is cash only — cards are not accepted here, so bring cash.",
    open_maps: "Open in Google Maps",
    maps_save_hint: "Want to keep this place? Once it opens in Google Maps, tap Save there and it's in your own lists.",
    dir_title: "Get directions",
    dir_transit: "MRT / Bus",
    dir_walking: "Walking",
    dir_biking: "Biking",
    dir_driving: "Driving / Taxi",
    dir_hint:
      "Opens Google Maps with the route already filled in — from your location if you've shared it, otherwise Google Maps will ask there.",
    driver: "Show driver 給司機看",
    share: "Share",
    link_copied: "Link copied ✓ — paste it into any chat app.",
    share_no_sheet: "No share sheet here — link copied, paste it into any chat app.",
    share_title_suffix: " — Hao Chi Taiwan",
    share_intro: "Worth trying in Taiwan:",
    cal_btn: "Add to calendar",
    cal_view_in: "View in Hao Chi Taiwan",
    report_place: "Report a problem with this place",
    back_to_list: "Back to all places",
    contact_h: "Contact & feedback",
    contact_sub: "Spotted a place that's closed, a broken Google Maps or Instagram link, or wrong hours? Want to suggest a place Jenny should try, or just share feedback? Send a note — problem reports get checked and fixed.",
    contact_btn: "Write to us",
    contact_email_label: "Email us at",
    foot1: "Places come from Jenny's Google Maps lists “Taiwan - Tried & Tested” (Recommended) and “Taiwan - On My Radar” (Want to Try). Ratings are the Google ratings captured with the lists in Nov 2026.",
    foot2: "Hours and phone numbers for the first ten places (Zuoying) are provisional, from shop listings, last checked Nov 2026, and are being checked before the real launch — use “Check today's hours” in a place's details to see its current hours on Google Maps. Chinese addresses are drafts awaiting Jenny's check.",
    cf_title: "Contact & feedback",
    cf_intro: "Tell us what's on your mind. Tap “Open in email app” — or “Open in Gmail” — and your email app opens with everything filled in, addressed to haochitaiwan@muse.ai — nothing is sent until you press Send there, and you can attach a screenshot in your email app.",
    cf_category: "What is this about?",
    cf_cat_feedback: "Feedback",
    cf_cat_problem: "Report a problem",
    cf_cat_suggest: "Suggest a place",
    cf_cat_other: "Other",
    cf_place: "Place (if it's about one place)",
    cf_place_ph: "Place name (optional)",
    cf_name: "Your name (optional)",
    cf_name_ph: "What should we call you?",
    cf_email: "Your email (optional — add it if you'd like a reply)",
    cf_email_ph: "you@example.com",
    cf_message: "Your message",
    cf_message_ph: "Write what you'd like us to know…",
    cf_shot: "Reporting a broken link, wrong hours or a place that's closed? Say which link or detail is wrong — a screenshot helps, and you can attach it in your email app after it opens.",
    cf_send: "Open in email app",
    cf_gmail: "Open in Gmail",
    cf_need: "Write a short message first, so we know how to help.",
    cf_opened: "Your email app should open with your message ready — just press Send there. If nothing opens, email haochitaiwan@muse.ai directly.",
    cf_fallback_a: "If your email app doesn't open, email us at",
    cf_fallback_b: "— or copy your message:",
    cf_copy: "Copy message",
    cf_copied: "Message copied — paste it into an email to haochitaiwan@muse.ai and send it from there.",
    cf_copy_fail: "Copy didn't work here — select the text in the message box above and copy it yourself, then paste it into an email.",
    near_me: "Near me",
    near_locating: "Finding you…",
    near_within: "Within",
    near_any: "Any distance",
    near_clear: "Clear location",
    near_hint: "Use your location to find places near you — sorted nearest first. Your location stays on your phone and is only used for this search.",
    near_error_denied: "Location permission was turned down, so Near me can't run. You can allow location for this site in your browser settings, or keep browsing the full list.",
    near_error_unavail: "Your phone couldn't find your location. Check location is on and try again.",
    near_error_timeout: "Finding your location took too long. Please try again.",
    near_error_unsupported: "This browser doesn't support location, so Near me isn't available here.",
    offline_near: "Near me needs a connection and your location, so it can't run while you're offline. The full list still works below.",
    sort_need_loc: "Nearest sorting needs your location — allow it and places will sort by distance.",
    f_distance: "Distance from you",
    near_found: (n, r) =>
      r >= 9999
        ? "Showing all " + n + " places, nearest first."
        : "Found " +
          n +
          (n === 1 ? " place" : " places") +
          " within " +
          r +
          " km of you — nearest first.",
    near_none: (r) =>
      "No places within " + r + " km of you. Try a wider range above.",
    showing: (n) => (n === 1 ? "Showing 1 place" : "Showing " + n + " places"),
    showingOf: (shown, total) => "Showing " + shown + " of " + total,
    showingAll: (total) =>
      total === 1 ? "Showing all 1 place" : "Showing all " + total + " places",
    city_names: {
      "Kaohsiung": "Kaohsiung",
      "Chiayi County": "Chiayi",
      "Tainan City": "Tainan",
      "Pingtung County": "Pingtung",
      "Taipei": "Taipei",
      "New Taipei": "New Taipei",
      "Yilan": "Yilan",
      "Taichung": "Taichung",
      "Changhua": "Changhua",
      "Yunlin": "Yunlin",
      "Tainan": "Tainan",
    },
    district_names: {
      "Anping": "Anping",
      "Banqiao": "Banqiao",
      "Chaozhou Township": "Chaozhou Township",
      "Cianjhen": "Cianjhen",
      "Da'an": "Da'an",
      "Datong": "Datong",
      "Dongshi Township": "Dongshi Township",
      "Douliu": "Douliu",
      "Fangshan Township": "Fangshan Township",
      "Fengshan": "Fengshan",
      "Gushan": "Gushan",
      "Hengchun Township": "Hengchun Township",
      "Lingya": "Lingya",
      "Liuqiu Township": "Liuqiu Township",
      "Lukang": "Lukang",
      "Manzhou Township": "Manzhou Township",
      "Nantun": "Nantun",
      "Niaosong": "Niaosong",
      "North District": "North District",
      "Qianjin": "Qianjin",
      "Qijin": "Qijin",
      "Sanmin": "Sanmin",
      "Sinsing": "Sinsing",
      "Tamsui": "Tamsui",
      "Wanhua": "Wanhua",
      "West District": "West District",
      "Xinyi": "Xinyi",
      "Xitun": "Xitun",
      "Yancheng": "Yancheng",
      "Yilan City": "Yilan City",
      "Zhongshan": "Zhongshan",
      "Zhongzheng": "Zhongzheng",
      "Zuoying": "Zuoying",
    },
    cuisine_names: {
      "American": "American",
      "Asian fusion": "Asian fusion",
      "Bakery": "Bakery",
      "Bar": "Bar",
      "Bistro": "Bistro",
      "Breakfast": "Breakfast",
      "Brunch": "Brunch",
      "Bubble tea": "Bubble tea",
      "Buffet": "Buffet",
      "Cafe": "Cafe",
      "Cafeteria": "Cafeteria",
      "Cake shop": "Cake shop",
      "Cantonese": "Cantonese",
      "Cha chaan teng": "Cha chaan teng",
      "Chinese": "Chinese",
      "Chinese noodle": "Chinese noodle",
      "Chinese tea house": "Chinese tea house",
      "Coffee": "Coffee",
      "Coffee shop": "Coffee shop",
      "Coffee store": "Coffee store",
      "Conveyor belt sushi": "Conveyor belt sushi",
      "Creperie": "Creperie",
      "Croissant and Danish pastry bakery": "Croissant and Danish pastry bakery",
      "Deli": "Deli",
      "Dessert": "Dessert",
      "Dim sum": "Dim sum",
      "Donburi": "Donburi",
      "Donut": "Donut",
      "Douhua tofu pudding, rice balls and shaved ice": "Douhua tofu pudding, rice balls and shaved ice",
      "Dumpling": "Dumpling",
      "English restaurant": "English restaurant",
      "European": "European",
      "Fast food": "Fast food",
      "Fine dining": "Fine dining",
      "French": "French",
      "German": "German",
      "Grill": "Grill",
      "Hamburger": "Hamburger",
      "Hong Kong style fast food": "Hong Kong style fast food",
      "Hong Kong-style cafe": "Hong Kong-style cafe",
      "Hot pot": "Hot pot",
      "Ice cream": "Ice cream",
      "Indian": "Indian",
      "Italian": "Italian",
      "Italian restaurant": "Italian restaurant",
      "Izakaya": "Izakaya",
      "Jiufen-style taro ball desserts": "Jiufen-style taro ball desserts",
      "Korean": "Korean",
      "Korean BBQ": "Korean BBQ",
      "Malaysian": "Malaysian",
      "Mandarin": "Mandarin",
      "Mexican": "Mexican",
      "Noodle shop": "Noodle shop",
      "Pakistani": "Pakistani",
      "Pan-fried buns (shui jian bao)": "Pan-fried buns (shui jian bao)",
      "Pancake": "Pancake",
      "Pasta": "Pasta",
      "Pastry": "Pastry",
      "Patisserie": "Patisserie",
      "Pizza": "Pizza",
      "Pizza Takeout": "Pizza Takeout",
      "Ramen": "Ramen",
      "Restaurant": "Restaurant",
      "Sandwich": "Sandwich",
      "Seafood": "Seafood",
      "Singaporean": "Singaporean",
      "Small plates": "Small plates",
      "Soup": "Soup",
      "Southeast Asian": "Southeast Asian",
      "Spanish": "Spanish",
      "Steak house": "Steak house",
      "Steamed bun": "Steamed bun",
      "Street snacks": "Street snacks",
      "Sukiyaki": "Sukiyaki",
      "Taiwanese": "Taiwanese",
      "Tea drinks and soft serve": "Tea drinks and soft serve",
      "Teppanyaki": "Teppanyaki",
      "Tex-Mex": "Tex-Mex",
      "Thai": "Thai",
      "Udon": "Udon",
      "Ukrainian": "Ukrainian",
      "Vegan": "Vegan",
      "Vegetarian": "Vegetarian",
      "Vietnamese": "Vietnamese",
      "Western": "Western",
      "Yakiniku": "Yakiniku",
    },
    // Filled gaps: the live app has no standalone label for these.
    label_city: "City",
    label_district: "District",
    label_cuisine: "Cuisine",
    label_view: "View",
    label_contact: "Contact",
    // The Contact section is always present (Phase A parity fix,
    // 2026-11-23); this is its honest empty state — the app's
    // standing "not listed yet, never guessed" rule.
    contact_none: "No contact details listed yet.",
    // The quiet list number at the end of a card's meta line / a
    // row's food line (Jenny, 2026-11-22): a reference, not a badge.
    place_no: (n) => "No. " + n,
  },
  zh: {
    stat_total: "家店（全部）",
    stat_recommended: "家推薦 · 親自吃過",
    stat_want: "家想去試試",
    stat_khh: "家在高雄",
    lede: (recommended, want) =>
      "Jenny 的台灣美食指南 — " +
      recommended +
      " 家她親自吃過、真心推薦的店，加上 " +
      want +
      " 家她想去試試的店。大部分都在高雄，從小吃攤到老字號都有。",
    list_label: "清單",
    list_all: "全部",
    list_recommended: "推薦",
    list_want: "想去",
    search_ph: "搜尋店名、料理或地區…",
    all_cities: "全部",
    all_districts: "全部地區",
    all_cuisines: "全部類型",
    sort: "排序",
    sort_default: "推薦順序",
    sort_az: "依名稱 A–Z",
    sort_rating: "Google 評分最高",
    sort_nearest: "最近",
    view_cards: "卡片",
    view_compact: "緊湊清單",
    clear_all: "清除全部",
    search_filters: "搜尋與篩選",
    panel_showing: (n, total) => "顯示 " + n + " 家 · 共 " + total + " 家",
    map_h: "地圖",
    map_sub: "點地圖上的圖釘就能打開那家店。用 +、− 按鈕或雙指縮放來放大 — 大部分店都集中在高雄左營。",
    empty: "沒有符合的店 — 換個搜尋或篩選試試。",
    show_more: "顯示更多",
    details: "詳情",
    save: "收藏",
    saved: "已收藏",
    saved_view: "已收藏",
    saved_device_only: "只存在這台裝置上",
    saved_empty: "還沒有收藏的店 — 在任何一家店點「收藏」，就會出現在這裡。",
    saved_showing: (n) => "共 " + n + " 家已收藏的店",
    google_rating: "Google 評分",
    reviews_word: "則評論",
    temp_closed: "暫時停業",
    close: "關閉",
    f_area: "地區",
    f_address: "地址（英文）",
    f_address_zh: "中文地址",
    f_hours: "營業時間",
    f_website: "網站",
    f_instagram: "Instagram",
    f_facebook: "Facebook",
    check_todays_hours: "查看今日營業時間",
    hours_reminder:
      "以上是 Google Maps 刊登的營業時間。營業時間可能有變動（尤其假日），出發前請自行在 Google Maps 再確認一次。",
    good_to_know: "小提醒",
    cash_only_place: "這家店只收現金，不接受刷卡，請記得帶現金。",
    open_maps: "在 Google Maps 打開",
    maps_save_hint: "想收藏這家店嗎？在 Google 地圖開啟後，點按『儲存』即可存進你的清單。",
    dir_title: "怎麼去",
    dir_transit: "捷運 / 公車",
    dir_walking: "步行",
    dir_biking: "騎車",
    dir_driving: "開車 / 計程車",
    dir_hint:
      "在 Google Maps 開啟並填好路線 — 若你已分享位置會從你的位置出發，否則 Google Maps 會在那邊詢問。",
    driver: "給司機看",
    share: "分享",
    link_copied: "連結已複製 ✓ — 貼到任何聊天 App 就可以。",
    share_no_sheet: "此裝置沒有分享選單 — 連結已複製，貼到聊天 App 即可。",
    share_title_suffix: " — 好吃台灣",
    share_intro: "推薦你試試這家台灣美食：",
    cal_btn: "加到行事曆",
    cal_view_in: "在好吃台灣查看",
    report_place: "回報這家店的問題",
    back_to_list: "回到所有店家",
    contact_h: "聯絡與意見回饋",
    contact_sub: "發現某家店已經歇業、Google Maps 或 Instagram 連結壞了，或營業時間不對？想推薦 Jenny 去試的店，或單純分享意見？歡迎來信 — 問題回報都會逐一確認並修正。",
    contact_btn: "寫信給我們",
    contact_email_label: "Email：",
    foot1: "店家來自 Jenny 的 Google Maps 清單「Taiwan - Tried & Tested」（推薦）和「Taiwan - On My Radar」（想去）。評分是 2026 年 11 月擷取清單時的 Google 評分。",
    foot2: "前十家（左營）的營業時間和電話是暫定的，來自店家刊登資訊，最後確認於 2026 年 11 月，正式上線前還在確認中 — 在店家詳情點「查看今日營業時間」可在 Google Maps 看目前時間。中文地址是草稿，等 Jenny 檢查。",
    cf_title: "聯絡與意見回饋",
    cf_intro: "告訴我們你的想法。點下「開啟郵件 App」（或「用 Gmail 開啟」），你的郵件 App 會開啟並自動填好內容，收件人是 haochitaiwan@muse.ai — 在那邊按下傳送之前，這裡不會寄出任何東西；你也可以在郵件 App 裡附上截圖。",
    cf_category: "這封信是關於什麼？",
    cf_cat_feedback: "意見回饋",
    cf_cat_problem: "回報問題",
    cf_cat_suggest: "推薦一家店",
    cf_cat_other: "其他",
    cf_place: "店家（如果是關於某一家店）",
    cf_place_ph: "店名（可留空）",
    cf_name: "你的名字（可留空）",
    cf_name_ph: "我們可以怎麼稱呼你",
    cf_email: "你的 Email（可留空，填了我們才能回覆你）",
    cf_email_ph: "you@example.com",
    cf_message: "訊息",
    cf_message_ph: "寫下你想告訴我們的事…",
    cf_shot: "要回報連結壞掉、營業時間錯誤或店家歇業嗎？請說明是哪個連結或哪項資訊有問題 — 附上截圖會很有幫助，你可以在郵件 App 裡加上附件。",
    cf_send: "開啟郵件 App",
    cf_gmail: "用 Gmail 開啟",
    cf_need: "請先寫一點訊息，我們才知道怎麼幫忙。",
    cf_opened: "你的郵件 App 應該已經開啟並填好訊息 — 在那邊按傳送就可以。如果沒有開啟，請直接寄信到 haochitaiwan@muse.ai。",
    cf_fallback_a: "如果你的郵件 App 沒有開啟，請直接寄信到",
    cf_fallback_b: "，或複製你的訊息：",
    cf_copy: "複製訊息",
    cf_copied: "訊息已複製 — 把它貼到寄給 haochitaiwan@muse.ai 的郵件裡，再從那邊寄出就可以。",
    cf_copy_fail: "這裡無法自動複製 — 請選取上方訊息欄裡的文字自己複製，再貼到郵件裡。",
    near_me: "我附近",
    near_locating: "定位中…",
    near_within: "範圍",
    near_any: "不限距離",
    near_clear: "清除定位",
    near_hint: "用你的位置找附近的店 — 由近到遠排列。你的位置只留在手機上，只用於這次搜尋。",
    near_error_denied: "定位權限被拒絕，無法使用「我附近」。你可以在瀏覽器設定中允許此網站使用定位，或繼續瀏覽完整清單。",
    near_error_unavail: "手機無法取得你的位置，請確認定位已開啟後再試一次。",
    near_error_timeout: "定位花太久了，請再試一次。",
    near_error_unsupported: "這個瀏覽器不支援定位，無法使用「我附近」。",
    offline_near: "「我附近」需要網路連線和你的位置，離線時無法使用。下面的完整清單還能用。",
    sort_need_loc: "「最近」排序需要你的位置 — 允許定位後就會依距離排列。",
    f_distance: "距離你",
    near_found: (n, r) =>
      r >= 9999
        ? "共 " + n + " 家店，由近到遠排列。"
        : "在你 " + r + " 公里內找到 " + n + " 家店 — 由近到遠排列。",
    near_none: (r) => "你 " + r + " 公里內沒有店 — 試試上面的更大範圍。",
    showing: (n) => "共 " + n + " 家店",
    showingOf: (shown, total) => "顯示 " + shown + " 家 · 共 " + total + " 家",
    showingAll: (total) => "已顯示全部 " + total + " 家",
    city_names: {
      "Kaohsiung": "高雄",
      "Chiayi County": "嘉義",
      "Tainan City": "台南",
      "Pingtung County": "屏東",
      "Taipei": "台北",
      "New Taipei": "新北",
      "Yilan": "宜蘭",
      "Taichung": "台中",
      "Changhua": "彰化",
      "Yunlin": "雲林",
      "Tainan": "台南",
    },
    district_names: {
      "Anping": "安平區",
      "Banqiao": "板橋區",
      "Chaozhou Township": "潮州鎮",
      "Cianjhen": "前鎮區",
      "Da'an": "大安區",
      "Datong": "大同區",
      "Dongshi Township": "東石鄉",
      "Douliu": "斗六市",
      "Fangshan Township": "枋山鄉",
      "Fengshan": "鳳山區",
      "Gushan": "鼓山區",
      "Hengchun Township": "恆春鎮",
      "Lingya": "苓雅區",
      "Liuqiu Township": "琉球鄉",
      "Lukang": "鹿港鎮",
      "Manzhou Township": "滿州鄉",
      "Nantun": "南屯區",
      "Niaosong": "鳥松區",
      "North District": "北區",
      "Qianjin": "前金區",
      "Qijin": "旗津區",
      "Sanmin": "三民區",
      "Sinsing": "新興區",
      "Tamsui": "淡水區",
      "Wanhua": "萬華區",
      "West District": "西區",
      "Xinyi": "信義區",
      "Xitun": "西屯區",
      "Yancheng": "鹽埕區",
      "Yilan City": "宜蘭市",
      "Zhongshan": "中山區",
      "Zhongzheng": "中正區",
      "Zuoying": "左營區",
    },
    cuisine_names: {
      "American": "美式料理",
      "Asian fusion": "亞洲融合料理",
      "Bakery": "烘焙坊",
      "Bar": "酒吧",
      "Bistro": "餐酒館",
      "Breakfast": "早餐",
      "Brunch": "早午餐",
      "Bubble tea": "手搖飲",
      "Buffet": "自助餐",
      "Cafe": "咖啡館",
      "Cafeteria": "自助餐廳",
      "Cake shop": "蛋糕店",
      "Cantonese": "粵菜",
      "Cha chaan teng": "茶餐廳",
      "Chinese": "中式料理",
      "Chinese noodle": "中式麵食",
      "Chinese tea house": "中式茶館",
      "Coffee": "咖啡",
      "Coffee shop": "咖啡廳",
      "Coffee store": "咖啡店",
      "Conveyor belt sushi": "迴轉壽司",
      "Creperie": "可麗餅店",
      "Croissant and Danish pastry bakery": "可頌與丹麥酥皮麵包坊",
      "Deli": "熟食店",
      "Dessert": "甜點",
      "Dim sum": "港式點心",
      "Donburi": "丼飯",
      "Donut": "甜甜圈",
      "Douhua tofu pudding, rice balls and shaved ice": "豆花、湯圓與剉冰",
      "Dumpling": "餃子",
      "English restaurant": "英式餐廳",
      "European": "歐式料理",
      "Fast food": "速食",
      "Fine dining": "高級餐廳",
      "French": "法式料理",
      "German": "德式料理",
      "Grill": "燒烤",
      "Hamburger": "漢堡",
      "Hong Kong style fast food": "港式快餐",
      "Hong Kong-style cafe": "港式茶餐廳",
      "Hot pot": "火鍋",
      "Ice cream": "冰淇淋",
      "Indian": "印度料理",
      "Italian": "義式料理",
      "Italian restaurant": "義式餐廳",
      "Izakaya": "居酒屋",
      "Jiufen-style taro ball desserts": "九份芋圓甜點",
      "Korean": "韓式料理",
      "Korean BBQ": "韓式燒肉",
      "Malaysian": "馬來西亞料理",
      "Mandarin": "北方料理",
      "Mexican": "墨西哥料理",
      "Noodle shop": "麵店",
      "Pakistani": "巴基斯坦料理",
      "Pan-fried buns (shui jian bao)": "水煎包",
      "Pancake": "鬆餅",
      "Pasta": "義大利麵",
      "Pastry": "糕點",
      "Patisserie": "法式甜點店",
      "Pizza": "披薩",
      "Pizza Takeout": "外帶披薩",
      "Ramen": "拉麵",
      "Restaurant": "餐廳",
      "Sandwich": "三明治",
      "Seafood": "海鮮",
      "Singaporean": "新加坡料理",
      "Small plates": "小盤料理",
      "Soup": "湯品",
      "Southeast Asian": "東南亞料理",
      "Spanish": "西班牙料理",
      "Steak house": "牛排館",
      "Steamed bun": "包子",
      "Street snacks": "街頭小吃",
      "Sukiyaki": "壽喜燒",
      "Taiwanese": "台灣菜",
      "Tea drinks and soft serve": "茶飲與霜淇淋",
      "Teppanyaki": "鐵板燒",
      "Tex-Mex": "德墨料理",
      "Thai": "泰式料理",
      "Udon": "烏龍麵",
      "Ukrainian": "烏克蘭料理",
      "Vegan": "純素",
      "Vegetarian": "素食",
      "Vietnamese": "越南料理",
      "Western": "西式料理",
      "Yakiniku": "日式燒肉",
    },
    // Filled gaps: plain translations, flagged for Jenny's review.
    // label_district / label_cuisine reuse the live app's own words
    // (地區 in f_area / all_districts; 類型 in all_cuisines).
    label_city: "城市",
    label_district: "地區",
    label_cuisine: "類型",
    label_view: "顯示方式",
    label_contact: "聯絡方式",
    // The Contact section's empty state (see the EN note).
    // Filled-gap translation — flagged for Jenny's spot-check.
    contact_none: "尚未列出聯絡方式。",
    // The quiet list number (see the EN note): 第 N 家.
    place_no: (n) => "第 " + n + " 家",
  },
};

/** The ?lang= value from a query string: "en" | "zh" | null. */
export function langFromSearch(search: string): Lang | null {
  try {
    const value = new URLSearchParams(search).get("lang");
    return value === "zh" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

/** Persisted toggle choice; anything unusable becomes null. */
export function parseStoredLang(raw: string | null): Lang | null {
  return raw === "zh" || raw === "en" ? raw : null;
}

/** Dropdown / display labels: the live app's tables, value as fallback. */
export function cityLabel(lang: Lang, city: string): string {
  return STRINGS[lang].city_names[city] ?? city;
}
export function districtLabel(lang: Lang, district: string): string {
  return STRINGS[lang].district_names[district] ?? district;
}
export function cuisineLabel(lang: Lang, cuisine: string): string {
  return STRINGS[lang].cuisine_names[cuisine] ?? cuisine;
}
