# 輿情監測雷達

GitHub Pages 前台，加上 GitHub Actions 每日自動爬抓公開新聞 RSS，並可串接 Firebase Firestore 做多裝置資料同步。

## 系統架構

- GitHub Pages：提供前台網頁。
- GitHub Actions：每天台灣時間 08:30、15:30 自動更新公開新聞 RSS 資料，也可手動執行。
- Firebase Firestore：同步 `opinionItems`、`trackedAccounts`、`dailyPostIdeas` 到雲端資料庫。
- localStorage：保留本機快取；未啟用 Firestore 時仍可單機使用。

## 自動爬抓方式

- `scripts/daily-opinion-crawler.mjs`：每天抓 Google News RSS 多組關鍵字，只保留台灣時間當日發布的新聞，整理為輿情資料與每日發文建議。
- `data/opinion-auto.json`：前端讀取的最新自動資料。
- `data/archive/YYYY-MM-DD.json`：每日歷史資料。前台切換日期時會讀取對應 archive，所以這不是舊版備份，需保留。
- `.github/workflows/daily-opinion-crawl.yml`：每天台灣時間 08:30、15:30 自動執行，也可在 GitHub Actions 手動執行。

GitHub Actions 排程執行後，會把 `data/opinion-auto.json` 與 `data/archive/YYYY-MM-DD.json` commit 回 repository，再部署到 GitHub Pages。這樣即使使用者幾天沒有打開網頁，之後切回過去日期也能讀到那天保存的自動資料。

## Firebase Firestore 同步設定

1. 到 Firebase Console 建立專案。
2. 新增 Web App，複製 Firebase config。
3. 啟用 Firestore Database。
4. 開啟輿情監測雷達，點 `雲端同步`。
5. 貼上 `apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId`。
6. 設定同一個 `資料庫代號`，例如 `service-office-main`。
7. 勾選 `啟用 Firestore 雲端同步`，按 `儲存並啟用`。

不同手機、平板、電腦只要輸入同一組 Firebase config 與同一個資料庫代號，就會同步同一份資料。

Firestore 資料位置：

- `opinionRadarStores/{資料庫代號}/opinionItems`
- `opinionRadarStores/{資料庫代號}/trackedAccounts`
- `opinionRadarStores/{資料庫代號}/dailyPostIdeas`
- `opinionRadarStores/{資料庫代號}/settings/app`
- `opinionRadarStores/{資料庫代號}/meta/status`

安全提醒：未加入 Firebase Authentication 前，不建議把 Firestore 規則設定成永久公開讀寫。正式使用若需要保護資料，建議下一版加入 Firebase Auth，或設定只允許指定帳號讀寫。

## 社群平台限制

Facebook、Instagram、Threads 通常需要登入、授權或官方 API。此版本不登入、不抓私人資料；會建立社群巡查任務，供人工確認後補入系統。

若未來要完全自動監測社群，需要串接官方 API、第三方社群監測服務，或另建有權限的後端工作流程。

## 部署

將整個資料夾內容推到 GitHub repository，並在 GitHub Pages 設定使用 `GitHub Actions` 作為 Source。

不要選 `Deploy from a branch`，因為本專案需要先執行 `scripts/daily-opinion-crawler.mjs` 產生每日資料，再把 `index.html` 與 `data/opinion-auto.json` 一起發布。

部署後：

- push 到 `main` 會自動部署一次。
- 每天台灣時間 08:30、15:30 會自動爬抓並部署一次。
- GitHub Actions 頁面也可以手動執行 `Daily Opinion Radar Crawl and Deploy`。
