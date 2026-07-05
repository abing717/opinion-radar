import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "data");
const archiveDir = path.join(outputDir, "archive");
const latestPath = path.join(outputDir, "opinion-auto.json");

const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const TAIPEI_TIME_ZONE = "Asia/Taipei";
const MAX_ITEMS_PER_FEED = 12;
const MAX_TOTAL_ITEMS = 90;
const STRICT_TODAY_ONLY = true;
const POST_IDEA_VOICE_VERSION = "2026-07-human-local-v2";
const LOCAL_TERMS = ["彰化", "鹿港", "福興", "秀水"];
const OTHER_LOCALITY_TERMS = [
  "基隆", "台北", "臺北", "新北", "桃園", "新竹", "苗栗", "台中", "臺中", "南投",
  "雲林", "嘉義", "台南", "臺南", "高雄", "屏東", "宜蘭", "花蓮", "台東", "臺東",
  "澎湖", "金門", "馬祖", "連江"
];
const NATIONAL_SCOPE_TERMS = [
  "全台", "全臺", "全國", "中央", "行政院", "立法院", "總統", "國會", "內政部",
  "交通部", "衛福部", "農業部", "經濟部", "教育部", "環境部", "國發會", "央行",
  "法案", "政策", "預算", "補助", "物價", "油價", "電價", "關稅", "台海", "臺海"
];

const feeds = [
  {
    name: "國際重大新聞",
    classification: "國際重大新聞",
    query: "國際 重大新聞 OR 全球 重大新聞",
    region: "國際",
    defaultImportance: "高"
  },
  {
    name: "與台灣相關的國際新聞",
    classification: "與台灣相關的國際新聞",
    query: "台灣 國際 新聞 OR 臺灣 國際 新聞 OR 台海 國際",
    region: "國際",
    defaultImportance: "中"
  },
  {
    name: "台灣重大新聞",
    classification: "台灣重大新聞",
    query: "台灣 重大新聞 OR 全台 最新新聞",
    region: "台灣",
    defaultImportance: "高"
  },
  {
    name: "彰化縣重要新聞（台灣相關）",
    classification: "彰化縣重要新聞",
    query: "彰化 台灣 新聞 OR 彰化 縣府 OR 秀水 新聞",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興", "秀水"],
    defaultImportance: "中"
  },
  {
    name: "彰化縣重要新聞",
    classification: "彰化縣重要新聞",
    query: "彰化縣 重要新聞 OR 彰化 最新新聞",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興", "秀水"],
    defaultImportance: "中"
  },
  {
    name: "鹿港與福興地方新聞",
    classification: "鹿港與福興地方新聞",
    query: "鹿港 新聞 OR 福興 新聞 OR 鹿港 福興",
    region: "鹿港",
    mustIncludeAny: ["鹿港", "福興"],
    defaultImportance: "中"
  },
  {
    name: "地方交通停車",
    classification: "彰化縣重要新聞",
    query: "彰化 交通 OR 彰化 停車 OR 鹿港 停車 OR 福興 交通 OR 秀水 交通",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興", "秀水"],
    defaultImportance: "中"
  },
  {
    name: "地方民生服務",
    classification: "彰化縣重要新聞",
    query: "彰化 長照 OR 彰化 醫療 OR 彰化 教育 OR 彰化 社福 OR 秀水 民生",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興", "秀水"],
    defaultImportance: "中"
  },
  {
    name: "地方風險事件",
    classification: "彰化縣重要新聞",
    query: "彰化 環境 OR 彰化 治安 OR 彰化 災害 OR 鹿港 災害 OR 福興 災害 OR 秀水 災害",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興", "秀水"],
    defaultImportance: "高"
  },
  {
    name: "鹿港福興觀光活動",
    classification: "鹿港與福興地方新聞",
    query: "鹿港 觀光 OR 鹿港 宮廟 OR 福興 活動 OR 福興 觀光",
    region: "鹿港",
    mustIncludeAny: ["鹿港", "福興"],
    defaultImportance: "中"
  }
];

const socialWatchTargets = [
  {
    targetType: "熱門社群",
    platform: "Facebook",
    queryName: "今日高回覆熱門貼文＋彰化 / 鹿港 / 福興 / 秀水",
    url: "https://www.facebook.com/search/posts/?q=%E5%BD%B0%E5%8C%96%20%E9%B9%BF%E6%B8%AF%20%E7%A6%8F%E8%88%88%20%E7%A7%80%E6%B0%B4"
  },
  {
    targetType: "熱門社群",
    platform: "Instagram",
    queryName: "今日高互動熱門貼文＋彰化 / 鹿港 / 福興 / 秀水",
    url: "https://www.instagram.com/explore/tags/%E5%BD%B0%E5%8C%96/"
  },
  {
    targetType: "熱門社群",
    platform: "Threads",
    queryName: "今日高回覆熱門討論＋彰化 / 鹿港 / 福興 / 秀水",
    url: "https://www.threads.com/search?q=%E5%BD%B0%E5%8C%96%20%E9%B9%BF%E6%B8%AF%20%E7%A6%8F%E8%88%88%20%E7%A7%80%E6%B0%B4"
  },
  {
    targetType: "熱門社群",
    platform: "YouTube",
    queryName: "今日高觀看熱門影片＋彰化 / 鹿港 / 福興 / 秀水",
    url: "https://www.youtube.com/results?search_query=%E5%BD%B0%E5%8C%96+%E9%B9%BF%E6%B8%AF+%E7%A6%8F%E8%88%88+%E7%A7%80%E6%B0%B4"
  },
  {
    targetType: "熱門社群",
    platform: "Dcard",
    queryName: "今日高回覆熱門話題＋彰化 / 鹿港 / 福興 / 秀水",
    url: "https://www.dcard.tw/search?query=%E5%BD%B0%E5%8C%96%20%E9%B9%BF%E6%B8%AF%20%E7%A6%8F%E8%88%88%20%E7%A7%80%E6%B0%B4"
  },
  {
    targetType: "熱門社群",
    platform: "PTT",
    queryName: "今日高回覆熱門話題＋彰化 / 鹿港 / 福興 / 秀水",
    url: "https://www.google.com/search?q=site%3Aptt.cc+%E5%BD%B0%E5%8C%96+%E9%B9%BF%E6%B8%AF+%E7%A6%8F%E8%88%88+%E7%A7%80%E6%B0%B4"
  }
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(archiveDir, { recursive: true });

  const generatedAt = new Date();
  const date = taipeiDate(generatedAt);
  const fetched = [];
  const errors = [];
  const filteredOut = [];

  for (const feed of feeds) {
    const rawItems = [];
    for (const query of splitFeedQueries(feed.query)) {
      try {
        const xml = await fetchText(buildGoogleNewsUrl(query));
        rawItems.push(...parseRssItems(xml).map((item) => ({ ...item, query })));
      } catch (error) {
        errors.push({
          feed: feed.name,
          query,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const freshItems = [];
    for (const item of dedupeRawItems(rawItems)) {
      const rejectReason = getFreshnessRejectReason(item, date);
      if (rejectReason) {
        filteredOut.push({
          feed: feed.name,
          query: item.query || "",
          title: cleanTitle(item.title),
          sourceName: item.sourceName || "",
          pubDate: item.pubDate || "",
          reason: rejectReason
        });
        continue;
      }
      const relevanceRejectReason = getRelevanceRejectReason(item, feed);
      if (relevanceRejectReason) {
        filteredOut.push({
          feed: feed.name,
          query: item.query || "",
          title: cleanTitle(item.title),
          sourceName: item.sourceName || "",
          pubDate: item.pubDate || "",
          reason: relevanceRejectReason
        });
        continue;
      }
      freshItems.push(item);
    }

    fetched.push(...freshItems
      .slice(0, MAX_ITEMS_PER_FEED)
      .map((item) => normalizeNewsItem(item, feed, date, generatedAt)));
  }

  const opinionItems = dedupeItems(fetched)
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, MAX_TOTAL_ITEMS);

  const dailyPostIdeas = buildDailyPostIdeas(opinionItems, generatedAt);

  const payload = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    generatedDate: date,
    timezone: TAIPEI_TIME_ZONE,
    source: "GitHub Actions daily crawler + Google News RSS",
    note: "新聞以公開 RSS 自動彙整，僅保留 Google News 發布時間為台灣時間當日且標題/摘要未出現舊日期線索的新聞；社群巡查列出 Facebook、Instagram、Threads、YouTube、Dcard、PTT 的公開搜尋入口，不登入、不抓私人資料。",
    strictTodayOnly: STRICT_TODAY_ONLY,
    feeds: feeds.map(({ name, classification, query, region, mustIncludeAny }) => ({ name, classification, query, region, mustIncludeAny })),
    errors,
    filteredOut,
    opinionItems,
    dailyPostIdeas,
    socialWatchTasks: socialWatchTargets.map((target) => ({
      id: `SOCIAL-${date}-${hashText(`${target.platform}-${target.url}`)}`,
      date,
      ...target,
      status: "待人工確認",
      notes: "請確認今日公開內容中，回覆率、互動數、留言數、分享數或觀看數較高，且與彰化、鹿港鎮、福興鄉、秀水鄉相關的熱門話題，再新增為社群輿情。"
    })),
    summary: buildSummary(opinionItems, dailyPostIdeas, errors, filteredOut)
  };

  await fs.writeFile(latestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(archiveDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Generated ${opinionItems.length} opinion items and ${dailyPostIdeas.length} post ideas for ${date}.`);
  if (errors.length) {
    console.warn(`Completed with ${errors.length} feed error(s).`);
  }
}

function buildGoogleNewsUrl(query) {
  const params = new URLSearchParams({
    q: `${query} when:1d`,
    hl: "zh-TW",
    gl: "TW",
    ceid: "TW:zh-Hant"
  });
  return `${GOOGLE_NEWS_BASE}?${params.toString()}`;
}

function splitFeedQueries(query) {
  return String(query || "")
    .split(/\s+OR\s+/i)
    .map((part) => part.replace(/[()]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 OpinionRadarBot/1.0 (+https://github.com/)"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseRssItems(xml) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  return itemBlocks.map((block) => ({
    title: decodeXml(readTag(block, "title")),
    link: decodeXml(readTag(block, "link")),
    pubDate: decodeXml(readTag(block, "pubDate")),
    description: stripHtml(decodeXml(readTag(block, "description"))),
    sourceName: decodeXml(readTag(block, "source"))
  })).filter((item) => item.title || item.link);
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeRawItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = normalizeKey(`${cleanTitle(item.title)}-${item.sourceName || inferSourceName(item.description)}-${item.link}`);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function getFreshnessRejectReason(item, targetDate) {
  if (STRICT_TODAY_ONLY && !isPublishedOnTaipeiDate(item.pubDate, targetDate)) {
    return `RSS 發布時間不是 ${targetDate}`;
  }
  const text = `${cleanTitle(item.title)} ${stripHtml(item.description)} ${item.sourceName || ""}`;
  const staleHint = findStaleDateHint(text, targetDate);
  if (staleHint) {
    return `內容含舊日期線索：${staleHint}`;
  }
  return "";
}

function getRelevanceRejectReason(item, feed) {
  const text = `${cleanTitle(item.title)} ${stripHtml(item.description)} ${item.sourceName || ""}`;
  if (feed.mustIncludeAny?.length && !containsAny(text, feed.mustIncludeAny)) {
    return `未命中地方關鍵字：${feed.mustIncludeAny.join("、")}`;
  }

  if (feed.classification === "台灣重大新聞") {
    const hasLocalTerm = containsAny(text, LOCAL_TERMS);
    const hasOtherLocality = containsAny(text, OTHER_LOCALITY_TERMS);
    const hasNationalScope = containsAny(text, NATIONAL_SCOPE_TERMS);
    if (hasOtherLocality && !hasLocalTerm && !hasNationalScope) {
      return "台灣重大新聞排除外縣市地方新聞";
    }
  }

  return "";
}

function normalizeNewsItem(raw, feed, date, generatedAt) {
  const title = cleanTitle(raw.title);
  const text = `${title} ${raw.description}`;
  const region = inferRegion(text, feed.region);
  const category = inferCategory(text);
  const sentiment = inferSentiment(text);
  const importance = inferImportance(text, feed.defaultImportance, region, sentiment);
  const action = inferAction({ region, category, sentiment, importance });
  const sourceName = raw.sourceName || inferSourceName(raw.description) || "Google News";
  const publishedAt = parseDate(raw.pubDate) || generatedAt.toISOString();
  const publishedDate = taipeiDate(new Date(publishedAt));

  return {
    id: `AUTO-${publishedDate}-${hashText(`${title}-${raw.link}`)}`,
    sourceMode: "auto",
    autoClassification: feed.classification,
    autoFeedName: feed.name,
    date: publishedDate,
    sourceType: "新聞",
    platform: "Google News",
    sourceName,
    title,
    summary: buildSummaryText(raw.description, feed.classification),
    url: raw.link,
    region,
    keywords: buildKeywords(text, region, category).join(", "),
    category,
    interactions: 0,
    comments: 0,
    shares: 0,
    views: 0,
    sentiment,
    importance,
    status: importance === "高" || sentiment === "負面" || sentiment === "爭議" ? "觀察" : "未讀",
    action,
    notes: `自動爬抓：${feed.name}。發布時間：${publishedAt}`,
    publishedAt,
    createdAt: generatedAt.toISOString(),
    updatedAt: generatedAt.toISOString()
  };
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\s+-\s+[^-｜|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferSourceName(description) {
  const match = String(description || "").match(/ - ([^<｜|]{2,30})$/);
  return match ? match[1].trim() : "";
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isPublishedOnTaipeiDate(pubDate, targetDate) {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return taipeiDate(parsed) === targetDate;
}

function findStaleDateHint(text, targetDate) {
  const normalized = String(text || "").replace(/\s+/g, " ");
  const target = parseISODateParts(targetDate);
  if (!target) return "";

  if (/(去年|前年|上月|上週|上周)/.test(normalized)) {
    return "相對舊時間";
  }

  for (const match of normalized.matchAll(/\b(20\d{2})\s*[年\/.-]\s*(\d{1,2})\s*[月\/.-]\s*(\d{1,2})\s*日?/g)) {
    const hint = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    if (isPastDateHint(hint, target)) return match[0];
  }

  for (const match of normalized.matchAll(/\b(1\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g)) {
    const hint = { year: Number(match[1]) + 1911, month: Number(match[2]), day: Number(match[3]) };
    if (isPastDateHint(hint, target)) return match[0];
  }

  for (const match of normalized.matchAll(/\b(1\d{2})\s*年\s*(\d{1,2})(?:\s*[-~至到]\s*\d{1,2})?\s*月/g)) {
    const hint = { year: Number(match[1]) + 1911, month: Number(match[2]), day: 1 };
    if (hint.year < target.year || (hint.year === target.year && hint.month < target.month)) return match[0];
  }

  for (const match of normalized.matchAll(/\b(20\d{2})\s*年/g)) {
    if (Number(match[1]) < target.year) return match[0];
  }

  for (const match of normalized.matchAll(/(^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    const hint = { year: target.year, month: Number(match[2]), day: Number(match[3]) };
    if (isPastDateHint(hint, target)) return match[0].trim();
  }

  return "";
}

function parseISODateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function isPastDateHint(hint, target) {
  if (!hint.year || !hint.month || !hint.day) return false;
  const hintValue = hint.year * 10000 + hint.month * 100 + hint.day;
  const targetValue = target.year * 10000 + target.month * 100 + target.day;
  return hintValue < targetValue;
}

function inferRegion(text, fallback) {
  if (containsAny(text, ["鹿港"])) return "鹿港";
  if (containsAny(text, ["福興"])) return "福興";
  if (containsAny(text, ["彰化", "秀水"])) return "彰化";
  if (containsAny(text, ["台灣", "臺灣", "全台", "行政院", "立法院", "中央"])) return "台灣";
  return fallback || "其他";
}

function inferCategory(text) {
  const rules = [
    ["交通", ["交通", "道路", "公車", "車流", "塞車", "路口", "通勤", "台鐵", "高鐵"]],
    ["停車", ["停車", "車位", "停車場", "違停", "臨停"]],
    ["觀光", ["觀光", "旅遊", "遊客", "商圈", "老街"]],
    ["宮廟", ["宮廟", "遶境", "進香", "香客", "媽祖", "廟"]],
    ["教育", ["教育", "學校", "學生", "校園", "幼兒園", "補助學費"]],
    ["長照", ["長照", "照護", "老人", "高齡", "據點"]],
    ["醫療", ["醫療", "醫院", "診所", "健保", "疫情", "衛生"]],
    ["環境", ["環境", "空污", "污染", "垃圾", "廢棄物", "噪音", "水質"]],
    ["治安", ["治安", "警察", "詐騙", "竊盜", "酒駕", "暴力"]],
    ["青年", ["青年", "創業", "就業", "青年住宅"]],
    ["社福", ["社福", "補助", "弱勢", "福利", "身障"]],
    ["活動", ["活動", "演唱會", "市集", "展覽", "節慶", "開幕"]],
    ["地方建設", ["建設", "工程", "道路拓寬", "排水", "水溝", "路燈", "標線"]],
    ["政治", ["政治", "選舉", "議會", "縣長", "議員", "立委"]],
    ["災害", ["災害", "颱風", "豪雨", "地震", "火災", "淹水", "停電"]]
  ];
  const found = rules.find(([, words]) => containsAny(text, words));
  return found ? found[0] : "其他";
}

function inferSentiment(text) {
  if (containsAny(text, ["爭議", "質疑", "抗議", "批評", "怒", "不滿", "反彈", "挨轟"])) return "爭議";
  if (containsAny(text, ["死亡", "事故", "災害", "火災", "淹水", "詐騙", "污染", "停電", "缺失", "違規"])) return "負面";
  if (containsAny(text, ["啟用", "表揚", "獲獎", "補助", "改善", "開幕", "完工", "提升"])) return "正面";
  return "中性";
}

function inferImportance(text, fallback, region, sentiment) {
  if (sentiment === "負面" || sentiment === "爭議") return "高";
  if (containsAny(text, ["重大", "宣布", "全台", "中央", "行政院", "颱風", "豪雨", "停班停課"])) return "高";
  if (["彰化", "鹿港", "福興"].includes(region)) return fallback === "低" ? "中" : fallback;
  return fallback || "中";
}

function inferAction(item) {
  if (item.sentiment === "負面" || item.sentiment === "爭議") {
    return ["彰化", "鹿港", "福興"].includes(item.region) ? "需回應" : "需觀察";
  }
  if (["交通", "停車", "長照", "醫療", "教育", "社福", "災害"].includes(item.category)) return "可做懶人包";
  if (["活動", "觀光", "宮廟"].includes(item.category)) return "可做限動";
  if (["彰化", "鹿港", "福興"].includes(item.region)) return "可發文";
  return "需觀察";
}

function buildSummaryText(description, classification) {
  const text = stripHtml(description);
  if (!text) return `自動歸類為「${classification}」，請點開原始連結確認全文。`;
  return `${truncate(text, 130)}（自動歸類：${classification}）`;
}

function buildKeywords(text, region, category) {
  const keywords = new Set([region, category]);
  const candidates = ["彰化", "鹿港", "福興", "秀水", "交通", "停車", "觀光", "宮廟", "教育", "長照", "醫療", "環境", "治安", "社福", "活動", "建設", "災害", "台灣", "國際"];
  candidates.filter((word) => text.includes(word)).forEach((word) => keywords.add(word));
  return [...keywords].filter(Boolean);
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = normalizeKey(`${item.title}-${item.sourceName}`);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildDailyPostIdeas(items, generatedAt) {
  return selectDailyIdeaPairs(items).map(({ item, variant }) => buildPostIdea(item, generatedAt, variant));
}

function selectDailyIdeaPairs(items) {
  const candidates = items
    .filter(isContentSuggestionAction)
    .sort((a, b) => scoreItem(b) - scoreItem(a));
  if (!candidates.length) return [];
  const localCandidates = candidates.filter(isLocalPostItem);
  const pool = localCandidates.length ? localCandidates : candidates;
  const localFirst = pool[0];
  const serviceSecond = pool.find((item) => item.id !== localFirst.id && isServicePostItem(item)) ||
    pool.find((item) => item.id !== localFirst.id) ||
    localFirst;
  return [
    { item: localFirst, variant: "personal" },
    { item: serviceSecond, variant: "fanpage" }
  ];
}

function isLocalPostItem(item) {
  return ["彰化", "鹿港", "福興"].includes(item.region) || containsAny(`${item.title} ${item.summary} ${item.keywords}`, ["彰化", "鹿港", "福興", "秀水"]);
}

function isServicePostItem(item) {
  return ["交通", "停車", "長照", "醫療", "教育", "社福", "地方建設", "環境", "災害"].includes(item.category) ||
    item.action === "可做懶人包" ||
    item.action === "需觀察";
}

function buildPostIdea(item, generatedAt, variant = "fanpage") {
  const articleType = variant === "personal" ? "地方關懷文" : chooseArticleType(item);
  const shortTitle = buildShortTopic(item);
  const title = buildIdeaTitle(articleType, item.region, item.category, shortTitle, variant);
  return {
    id: `AUTO-IDEA-${item.date}-${hashText(`${item.id}-${articleType}-${variant}`)}`,
    sourceMode: "auto",
    date: item.date,
    articleType,
    ideaVariant: variant,
    voiceVersion: POST_IDEA_VOICE_VERSION,
    suggestedTopic: `${variant === "personal" ? "個人頁" : "粉絲專頁"}｜${item.region}${item.category}：${shortTitle}`,
    angle: buildIdeaAngle(item, articleType, variant),
    platform: recommendPlatforms(articleType, item, variant),
    title,
    draft: buildIdeaDraft(item, articleType, title, variant),
    materials: buildMaterialNeeds(item),
    isPublished: false,
    publishUrl: "",
    sourceItemId: item.id,
    createdAt: generatedAt.toISOString(),
    updatedAt: generatedAt.toISOString()
  };
}

function chooseArticleType(item) {
  if (item.action === "需回應" || item.sentiment === "負面" || item.sentiment === "爭議") return "即時回應文";
  if (item.action === "可做限動") return "限時動態";
  if (isPositiveLocalStory(item)) return "地方關懷文";
  if (item.action === "可做懶人包") return "政策白話文";
  if (item.category === "活動") return "活動宣傳文";
  if (["交通", "停車", "長照", "醫療", "教育", "社福"].includes(item.category)) return "服務型貼文";
  return "地方關懷文";
}

function buildIdeaTitle(articleType, region, category, shortTitle, variant = "fanpage") {
  if (variant === "personal") return `${region}日常關心：${shortTitle}`;
  if (variant === "fanpage") return `服務處整理：${shortTitle}`;
  if (articleType === "限時動態") return `${region}${category}快訊：${shortTitle}`;
  if (articleType === "政策白話文") return `${category}白話整理：民眾最需要知道的重點`;
  if (articleType === "即時回應文") return `關於「${shortTitle}」的說明與追蹤`;
  return `${region}${category}關心：${shortTitle}`;
}

function buildIdeaAngle(item, articleType, variant = "fanpage") {
  const texture = getIssueTexture(item);
  const mood = getIdeaMood(item);
  if (mood === "positive" && variant === "personal") {
    return "用個人頁口吻分享地方好消息，不寫成頒獎新聞稿，而是把孩子、老師、社區被看見的感覺說出來。";
  }
  if (mood === "positive" && variant === "fanpage") {
    return "用粉專口吻把地方好消息整理成一則可分享的暖文，給努力的人掌聲，也自然連回教育與社區資源。";
  }
  if (variant === "personal") {
    return `用個人頁的口吻，從「${texture.concern}」切入，不像新聞摘要，像是在地方跑行程後把一件需要留意的事說給鄉親聽。`;
  }
  if (variant === "fanpage") {
    return `用服務處粉專語氣，把「${texture.reminder}」講清楚，少用口號，多給民眾下一步可以做什麼。`;
  }
  if (articleType === "即時回應文") return "先承接民眾擔心，再說清楚已知事實、提醒不要轉傳未確認訊息，最後留下服務處蒐集資料的方式。";
  if (articleType === "政策白話文") return "用白話說明這件事跟民眾權益、日常生活或地方建設有什麼關係。";
  if (articleType === "服務型貼文") return "用簡短提醒提供民眾可準備的資料、可觀察的重點與服務處協助方式。";
  return `以${item.region || "地方"}民眾視角整理重點，語氣自然，避免像制式新聞稿。`;
}

function buildIdeaDraft(item, articleType, title, variant = "fanpage") {
  const source = item.sourceName ? `（來源：${item.sourceName}）` : "";
  const summary = buildReadableIssueSummary(item);
  const region = item.region || "地方";
  const category = item.category || "議題";
  const texture = getIssueTexture(item);
  const mood = getIdeaMood(item);
  const seed = `${item.id}-${item.title}-${variant}`;
  if (variant === "personal") {
    return buildPersonalDraft({ title, source, summary, region, texture, mood, seed });
  }
  if (variant === "fanpage") {
    return buildFanpageDraft({ source, summary, region, category, texture, mood, seed });
  }
  if (articleType === "即時回應文") {
    return `${title}\n\n這件事如果影響到生活，大家會緊張是正常的${source}。\n\n目前先把已知資訊抓出來：${summary}\n\n也提醒大家，還沒確認的截圖或說法先不要急著轉傳。若現場有狀況，可以留下時間、地點、照片，服務處會先彙整，再協助追主管機關的回應。`;
  }
  if (articleType === "政策白話文") {
    return `${title}\n\n這則用白話講，其實就是跟${region}鄉親的「${texture.concern}」有關${source}。\n\n目前看到的重點是：${summary}\n\n接下來比較重要的不是口號，而是實際怎麼做、誰會受影響、需要準備什麼。服務處會先把資料整理起來，有新進度再補充給大家。`;
  }
  return `${title}\n\n這則和${region}生活有關，先幫大家留意一下${source}。\n\n${summary}\n\n若你剛好在附近，或有遇到相關狀況，可以把地點、時間、照片傳給服務處。我們先整理清楚，再看後續要追哪個單位。`;
}

function buildPersonalDraft({ title, source, summary, region, texture, mood, seed }) {
  if (mood === "positive") {
    return `${title}\n\n這類地方消息，我會想多停一下。\n\n${summary}${source}\n\n不一定每一件事都要講得很大，但孩子、老師、社區被看見，就是地方慢慢往前的力量。也謝謝平常在第一線陪孩子、陪社區的人，很多成果都是日常累積出來的。`;
  }
  const opening = pickByHash(seed, [
    "這則我會先放在心上。",
    "地方的事，有時候看起來只是新聞一則，但現場感受常常很不一樣。",
    "今天這個訊息，我想用比較白話的方式跟大家說一下。"
  ]);
  const middle = pickByHash(`${seed}-middle`, [
    `${region}的鄉親在意的，通常不是標題寫得多大，而是會不會影響${texture.concern}。`,
    `很多事情真的要回到生活裡看，才知道大家為什麼會擔心：${texture.concern}。`,
    `我比較在意的是，這件事後面會不會牽動到大家每天都會遇到的${texture.concern}。`
  ]);
  const actionRequest = texture.actionRequest || "如果你就在附近，或有遇到相關狀況，麻煩把「時間、地點、照片」留給服務處。我們先把狀況整理清楚，該問的就問，該追的就追。";
  return `${title}\n\n${opening}\n\n${middle}\n\n目前看到的重點是：${summary}${source}\n\n${actionRequest}`;
}

function buildFanpageDraft({ source, summary, region, category, texture, mood, seed }) {
  if (mood === "positive") {
    return `【${region}${category}｜一起給一點掌聲】\n\n這則消息值得分享給大家${source}。\n\n${summary}\n\n地方的進步，有時候就是從這些小小的累積開始。謝謝孩子、老師、家長和每一位在背後陪伴的人，也期待更多資源繼續進到校園和社區。`;
  }
  const lead = pickByHash(seed, [
    "這則先幫大家抓重點。",
    "服務處先整理給鄉親參考。",
    "這件事和生活有關，先把重點說清楚。"
  ]);
  const actionLine = pickByHash(`${seed}-action`, [
    "有現場狀況可以先記下時間、地點，能拍照更好。",
    "若有遇到影響生活的情形，請保留照片、地點與發生時間。",
    "需要協助反映時，請盡量提供具體位置與現場照片。"
  ]);
  return `【${region}${category}｜服務處提醒】\n\n${lead}${source}\n\n${summary}\n\n鄉親可以先留意：\n- ${texture.reminder}\n- ${actionLine}\n- 服務處會協助彙整，後續有新資訊再更新給大家。`;
}

function getIssueTexture(item) {
  const category = item.category || "";
  const text = `${item.title || ""} ${item.summary || ""} ${item.keywords || ""}`;
  if (ideaTextHasAny(text, ["食安", "食品", "營養午餐", "沙拉油", "致癌", "食材"])) {
    return {
      concern: "孩子吃得安不安心、食材來源有沒有把關",
      reminder: "學校供餐、食材來源與縣府查核資訊是否清楚",
      actionRequest: "這類事情重點不是製造恐慌，而是把來源和查核講清楚。家長若有學校公告、供餐疑問或需要協助確認的資訊，也可以提供給服務處，我們協助釐清。"
    };
  }
  if (category === "交通") return { concern: "通勤、接送和行車安全", reminder: "是否影響行車動線、路口安全或尖峰通勤" };
  if (category === "停車") return { concern: "停車、接送和周邊動線", reminder: "停車格、臨停區與出入口動線是否受影響" };
  if (category === "環境") return { concern: "空氣、噪音、排水和居住品質", reminder: "是否有異味、噪音、積水或環境髒亂" };
  if (category === "災害") return { concern: "安全、通報和後續清理", reminder: "自身安全優先，並確認通報、封鎖或清理進度" };
  if (category === "醫療") return { concern: "就醫、照護和家人安心", reminder: "服務時間、就醫動線與可諮詢窗口" };
  if (category === "長照") return { concern: "長輩照顧和家屬壓力", reminder: "申請條件、服務窗口與家屬可準備資料" };
  if (category === "教育") return { concern: "孩子上學、接送和校園安全", reminder: "學校公告、接送動線與孩子安全" };
  if (category === "社福") return { concern: "補助、權益和弱勢照顧", reminder: "申請期限、資格與需要準備的文件" };
  if (category === "活動") return { concern: "假日安排、交通和在地參與", reminder: "時間、地點、交通方式與是否需要報名" };
  if (category === "觀光") return { concern: "人潮、交通和地方商圈", reminder: "交通管制、人潮動線與周邊店家資訊" };
  if (category === "地方建設") return { concern: "施工品質、進度和生活影響", reminder: "施工期程、替代動線與現場安全" };
  if (category === "治安") return { concern: "居住安全和孩子長輩的安心", reminder: "可疑狀況通報、夜間照明與巡守資訊" };
  return {
    concern: "生活便利和地方感受",
    reminder: "是否影響日常生活、周邊動線或民眾權益",
    actionRequest: "如果你就在附近，或有遇到相關狀況，麻煩把「時間、地點、照片」留給服務處。我們先把狀況整理清楚，該問的就問，該追的就追。"
  };
}

function getIdeaMood(item) {
  const text = `${item.title || ""} ${item.summary || ""} ${item.keywords || ""}`;
  if (item.sentiment === "正面" || ideaTextHasAny(text, ["表揚", "獲獎", "績優", "啟用", "完工", "分享", "成果", "閱讀收穫"])) return "positive";
  if (item.sentiment === "負面" || item.sentiment === "爭議") return "urgent";
  return "service";
}

function isPositiveLocalStory(item) {
  return isLocalPostItem(item) && getIdeaMood(item) === "positive";
}

function ideaTextHasAny(text, words) {
  return words.some((word) => String(text || "").includes(word));
}

function pickByHash(seed, options) {
  if (!options.length) return "";
  return options[hashToIndex(seed, options.length)];
}

function hashToIndex(value, length) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function cleanIdeaText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/（自動歸類：[^）]*）/g, "")
    .replace(/\(自動歸類：[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHeadline(value) {
  return cleanIdeaText(value)
    .replace(/\s*[|｜]\s*(生活|政治|社會|地方|國際|財經|即時|新聞).*$/g, "")
    .replace(/\s*-\s*(Yahoo奇摩新聞|自由時報|聯合新聞網|三立新聞網|中時新聞網|ETtoday新聞雲|中央社).*$/g, "")
    .trim();
}

function buildReadableIssueSummary(item) {
  const sourceName = item.sourceName || "";
  const title = cleanHeadline(item.title || "");
  let summary = cleanIdeaText(item.summary || "");
  if (sourceName) summary = summary.replaceAll(sourceName, "");
  summary = cleanHeadline(summary);
  if (!summary || summary.length < 12 || normalizeKey(summary).includes(normalizeKey(title))) {
    summary = title || "今日相關輿情值得持續關注。";
  }
  return truncate(summary, 160);
}

function buildShortTopic(item) {
  const text = cleanHeadline(item.title || item.summary || "今日輿情");
  if (ideaTextHasAny(text, ["食安", "食品", "營養午餐", "沙拉油", "致癌", "食材"])) {
    return "營養午餐與食材把關";
  }
  return truncate(text, 34);
}

function buildMaterialNeeds(item) {
  const needs = ["原始連結", "重點截圖"];
  if (["交通", "停車", "地方建設", "環境", "災害"].includes(item.category)) needs.push("現場照片", "位置資訊", "主管機關說明");
  return needs.join("、");
}

function recommendPlatforms(articleType, item, variant = "fanpage") {
  if (variant === "personal") return "個人 Facebook / Threads";
  if (variant === "fanpage") return "粉絲專頁 Facebook / LINE / Threads";
  if (articleType === "限時動態") return "Instagram / Facebook 限時動態";
  if (item.region === "鹿港" || item.region === "福興") return "Facebook / Threads / LINE";
  return "Facebook / Threads";
}

function isContentSuggestionAction(item) {
  return ["可發文", "可做限動", "可做懶人包"].includes(item.action);
}

function scoreItem(item) {
  const importance = { 高: 70, 中: 42, 低: 18 }[item.importance] || 30;
  const sentiment = { 負面: 28, 爭議: 25, 正面: 10, 中性: 6 }[item.sentiment] || 6;
  const action = { 需回應: 28, 需觀察: 16, 可發文: 14, 可做懶人包: 12, 可做限動: 10, 不建議處理: -10 }[item.action] || 0;
  const local = ["彰化", "鹿港", "福興"].includes(item.region) ? 14 : 0;
  return importance + sentiment + action + local;
}

function buildSummary(items, ideas, errors, filteredOut = []) {
  return {
    totalItems: items.length,
    highImportance: items.filter((item) => item.importance === "高").length,
    negativeOrControversial: items.filter((item) => item.sentiment === "負面" || item.sentiment === "爭議").length,
    changhuaRelated: items.filter((item) => ["彰化", "鹿港", "福興"].includes(item.region)).length,
    lukangOrFuxing: items.filter((item) => item.region === "鹿港" || item.region === "福興").length,
    postIdeas: ideas.length,
    feedErrors: errors.length,
    filteredOut: filteredOut.length
  };
}

function containsAny(text, words) {
  return words.some((word) => String(text || "").includes(word));
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function normalizeKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function taipeiDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
