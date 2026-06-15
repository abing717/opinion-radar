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
const LOCAL_TERMS = ["彰化", "鹿港", "福興"];
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
    name: "與彰化相關的台灣新聞",
    classification: "與彰化相關的台灣新聞",
    query: "彰化 台灣 新聞 OR 彰化 縣府",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興"],
    defaultImportance: "中"
  },
  {
    name: "彰化縣重要新聞",
    classification: "彰化縣重要新聞",
    query: "彰化縣 重要新聞 OR 彰化 最新新聞",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興"],
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
    query: "彰化 交通 OR 彰化 停車 OR 鹿港 停車 OR 福興 交通",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興"],
    defaultImportance: "中"
  },
  {
    name: "地方民生服務",
    classification: "彰化縣重要新聞",
    query: "彰化 長照 OR 彰化 醫療 OR 彰化 教育 OR 彰化 社福",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興"],
    defaultImportance: "中"
  },
  {
    name: "地方風險事件",
    classification: "彰化縣重要新聞",
    query: "彰化 環境 OR 彰化 治安 OR 彰化 災害 OR 鹿港 災害 OR 福興 災害",
    region: "彰化",
    mustIncludeAny: ["彰化", "鹿港", "福興"],
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
    queryName: "彰化 / 鹿港 / 福興高互動熱門貼文",
    url: "https://www.facebook.com/search/posts/?q=%E5%BD%B0%E5%8C%96%20%E9%B9%BF%E6%B8%AF%20%E7%A6%8F%E8%88%88"
  },
  {
    targetType: "熱門社群",
    platform: "Threads",
    queryName: "彰化 / 鹿港 / 福興高互動熱門討論",
    url: "https://www.threads.com/search?q=%E5%BD%B0%E5%8C%96%20%E9%B9%BF%E6%B8%AF%20%E7%A6%8F%E8%88%88"
  },
  {
    targetType: "熱門社群",
    platform: "Instagram",
    queryName: "彰化 / 鹿港 / 福興高點閱熱門標籤",
    url: "https://www.instagram.com/explore/tags/%E5%BD%B0%E5%8C%96/"
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

  const dailyPostIdeas = opinionItems
    .filter(isContentSuggestionAction)
    .slice(0, 12)
    .map((item) => buildPostIdea(item, generatedAt));

  const payload = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    generatedDate: date,
    timezone: TAIPEI_TIME_ZONE,
    source: "GitHub Actions daily crawler + Google News RSS",
    note: "新聞以公開 RSS 自動彙整，僅保留 Google News 發布時間為台灣時間當日且標題/摘要未出現舊日期線索的新聞；Facebook、Instagram、Threads 若未串接官方 API 或授權工具，僅建立每日巡查任務，不登入、不抓私人資料。",
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
      notes: "請人工確認今日公開內容中，與彰化、鹿港、福興相關且互動數、留言數、分享數或觀看數較高的熱門貼文，再新增為社群輿情。"
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
  if (containsAny(text, ["彰化"])) return "彰化";
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
  const candidates = ["彰化", "鹿港", "福興", "交通", "停車", "觀光", "宮廟", "教育", "長照", "醫療", "環境", "治安", "社福", "活動", "建設", "災害", "台灣", "國際"];
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

function buildPostIdea(item, generatedAt) {
  const articleType = chooseArticleType(item);
  const shortTitle = truncate(item.title || item.summary || "今日輿情", 34);
  const title = buildIdeaTitle(articleType, item.region, item.category, shortTitle);
  return {
    id: `AUTO-IDEA-${item.date}-${hashText(`${item.id}-${articleType}`)}`,
    sourceMode: "auto",
    date: item.date,
    articleType,
    suggestedTopic: `${item.region}${item.category}：${shortTitle}`,
    angle: buildIdeaAngle(item, articleType),
    platform: recommendPlatforms(articleType, item),
    title,
    draft: buildIdeaDraft(item, articleType, title),
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
  if (item.action === "可做懶人包") return "政策白話文";
  if (item.category === "活動") return "活動宣傳文";
  if (["交通", "停車", "長照", "醫療", "教育", "社福"].includes(item.category)) return "服務型貼文";
  return "地方關懷文";
}

function buildIdeaTitle(articleType, region, category, shortTitle) {
  if (articleType === "限時動態") return `${region}${category}快訊：${shortTitle}`;
  if (articleType === "政策白話文") return `${category}白話整理：民眾最需要知道的重點`;
  if (articleType === "即時回應文") return `關於「${shortTitle}」的說明與追蹤`;
  return `${region}${category}關心：${shortTitle}`;
}

function buildIdeaAngle(item, articleType) {
  if (articleType === "即時回應文") return "先承接民眾感受，再整理目前已知事實、可協助窗口與後續追蹤方向。";
  if (articleType === "政策白話文") return "把議題拆成影響誰、現在怎麼做、接下來怎麼追三個重點。";
  if (articleType === "服務型貼文") return "提供民眾可以立即使用的提醒、辦理方式或服務處協助管道。";
  return `以${item.region || "地方"}民眾視角整理重點，連結服務處日常關懷。`;
}

function buildIdeaDraft(item, articleType, title) {
  const source = item.sourceName ? `（來源：${item.sourceName}）` : "";
  const summary = item.summary || item.title || "今日相關輿情值得持續關注。";
  if (articleType === "即時回應文") {
    return `${title}\n\n今天注意到這則討論${source}。大家在意的重點，我們會先整理事實，也會持續關心主管機關後續說明。\n\n目前重點：${summary}\n\n若民眾有具體案例或現場狀況，也可以提供時間、地點與照片，服務處會協助彙整反映。`;
  }
  if (articleType === "政策白話文") {
    return `${title}\n\n這個議題和民眾生活有關，我們先用白話整理：\n1. 發生什麼事：${summary}\n2. 可能影響：請留意${item.region || "地方"}相關公告與現場狀況。\n3. 後續追蹤：服務處會持續掌握進度，必要時協助反映。`;
  }
  return `${title}\n\n今天整理一則與民眾生活相關的消息${source}：${summary}\n\n我們會持續關心，也歡迎大家補充在地看到的實際情況。`;
}

function buildMaterialNeeds(item) {
  const needs = ["原始連結", "重點截圖"];
  if (["交通", "停車", "地方建設", "環境", "災害"].includes(item.category)) needs.push("現場照片", "位置資訊", "主管機關說明");
  return needs.join("、");
}

function recommendPlatforms(articleType, item) {
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
