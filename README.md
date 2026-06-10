# 輿情監測雷達

靜態 GitHub Pages app，加上 GitHub Actions 每日自動爬抓公開新聞 RSS。

## 自動爬抓方式

- `scripts/daily-opinion-crawler.mjs`：每天抓 Google News RSS 多組關鍵字，整理為輿情資料與每日發文建議。
- `data/opinion-auto.json`：前端讀取的最新自動資料。
- `data/archive/YYYY-MM-DD.json`：每日備份。
- `.github/workflows/daily-opinion-crawl.yml`：每天台灣時間 06:20 自動執行，也可在 GitHub Actions 手動執行。

## 社群平台限制

Facebook、Instagram、Threads 通常需要登入、授權或官方 API。此版本不登入、不抓私人資料；會建立社群巡查任務，供人工確認後補入系統。

若未來要完全自動監測社群，需要串接官方 API、第三方社群監測服務，或另建有權限的後端工作流程。

## 部署

將整個資料夾內容推到 GitHub repository，並在 GitHub Pages 設定使用 `GitHub Actions` 作為 Source。

不要選 `Deploy from a branch`，因為本專案需要先執行 `scripts/daily-opinion-crawler.mjs` 產生每日資料，再把 `index.html` 與 `data/opinion-auto.json` 一起發布。

部署後：

- push 到 `main` 會自動部署一次。
- 每天台灣時間 06:20 會自動爬抓並部署一次。
- GitHub Actions 頁面也可以手動執行 `Daily Opinion Radar Crawl and Deploy`。
