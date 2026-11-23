// Add to Home Screen wording for the rebuild's footer entry,
// lifted from the CURRENT live app's install strings (its I18N
// install_* entries and the per-platform install guides, extracted
// 2026-11-22). Jenny approved that wording in the live app; do not
// re-translate or re-write it here. The one piece not lifted is
// genericSteps — the live app's how-to lists every platform in
// full; the rebuild's small dialog shows the steps for the
// visitor's own kind of device, and the generic set condenses the
// live app's Android wording for anything that is neither iOS nor
// Android.

import type { Lang } from "./i18n";

export type InstallStrings = {
  /** The footer button's label. */
  btn: string;
  /** The instructions dialog's title. */
  title: string;
  /** The dialog's intro line (the live install_text). */
  text: string;
  iosSteps: string[];
  iosNote: string;
  androidSteps: string[];
  androidNote: string;
  genericSteps: string[];
  genericNote: string;
};

export const INSTALL: Record<Lang, InstallStrings> = {
  en: {
    btn: "Add to Home Screen",
    title: "Add to Home Screen",
    text: "The list, details and driver card keep working with no connection.",
    iosSteps: [
      "Tap the Share button in Safari — the square with an arrow pointing up, at the bottom of the screen (on an iPad it's at the top).",
      "Scroll down the list and tap “Add to Home Screen”.",
      "Tap “Add” in the top-right corner.",
    ],
    iosNote:
      "Done — the Hao Chi Taiwan icon is now on your Home Screen, and the list, details and driver card keep working with no connection.",
    androidSteps: [
      "Tap the ⋮ menu in the top-right corner of Chrome.",
      "Tap “Install app” or “Add to Home screen” — whichever one you see.",
      "Tap “Install” / “Add” to confirm.",
    ],
    androidNote:
      "Done — the icon lands on your Home Screen. Android never uses Safari.",
    genericSteps: [
      "Open your browser's menu (⋮ or ☰, usually in the top-right corner).",
      "Tap or click “Install app” or “Add to Home Screen” — whichever one you see.",
      "Tap or click “Install” / “Add” to confirm.",
    ],
    genericNote:
      "Done — the Hao Chi Taiwan icon is added, and the list, details and driver card keep working with no connection.",
  },
  zh: {
    btn: "加到主畫面",
    title: "加到主畫面",
    text: "沒有網路連線時，清單、詳情和司機卡都還能用。",
    iosSteps: [
      "點 Safari 的「分享」按鈕 — 一個方框加上向上箭頭，在畫面下方（iPad 在上方）。",
      "往下捲，點「加入主畫面」。",
      "點右上角的「加入」。",
    ],
    iosNote:
      "完成了 — 好吃台灣的圖示會出現在主畫面上，沒有連線時清單、詳情和司機卡都還能用。",
    androidSteps: [
      "點 Chrome 右上角的 ⋮ 選單。",
      "點「安裝應用程式」或「加到主畫面」— 看到哪個就點哪個。",
      "點「安裝」/「加入」確認。",
    ],
    androidNote: "完成了 — 圖示會出現在主畫面上。Android 上完全用不到 Safari。",
    genericSteps: [
      "打開瀏覽器的選單（⋮ 或 ☰，通常在右上角）。",
      "點「安裝應用程式」或「加入主畫面」— 看到哪個就點哪個。",
      "再點「安裝」/「加入」確認。",
    ],
    genericNote:
      "完成了 — 好吃台灣的圖示會加好，沒有連線時清單、詳情和司機卡都還能用。",
  },
};
