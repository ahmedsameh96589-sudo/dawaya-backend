// Health news for the app's News tab.
//
// The NewsAPI key stays on the server (NEWS_API_KEY) so it is never shipped
// inside the mobile app. Results are cached per language to stay well inside
// NewsAPI's free-tier rate limit. Without a key, curated DAWAYA updates are
// returned instead. Articles use NewsAPI's shape so the app parses one format.

const NEWS_API_URL = "https://newsapi.org/v2/everything";
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // language -> { at, articles }

const FALLBACK_ARTICLES = [
  {
    title: "DAWAYA launches new delivery zones",
    description: "We have expanded same-day delivery to more neighborhoods.",
    urlToImage: "https://images.unsplash.com/photo-1584308666999-f0a7c2806a44?w=800",
    publishedAt: "2026-03-20T09:00:00.000Z",
    url: "",
    source: { name: "DAWAYA" },
  },
  {
    title: "Spring health check offers",
    description: "Enjoy discounts on selected vitamins and wellness products.",
    urlToImage: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800",
    publishedAt: "2026-03-18T13:30:00.000Z",
    url: "",
    source: { name: "DAWAYA" },
  },
  {
    title: "Prescription uploads are faster",
    description: "We improved upload speed and added better status tracking.",
    urlToImage: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800",
    publishedAt: "2026-03-15T10:15:00.000Z",
    url: "",
    source: { name: "DAWAYA" },
  },
];

const send = (res, articles) =>
  res.status(200).json({ success: true, count: articles.length, data: { articles } });

const getNews = async (req, res) => {
  const language = req.query.language === "ar" ? "ar" : "en";
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return send(res, FALLBACK_ARTICLES);

  const cached = cache.get(language);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return send(res, cached.articles);

  try {
    const url = new URL(NEWS_API_URL);
    url.search = new URLSearchParams({
      q: "medicine OR health OR pharmacy",
      language,
      pageSize: "20",
    }).toString();

    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`NewsAPI responded ${response.status}`);

    const body = await response.json();
    const articles = (body.articles || []).filter((a) => a.title && a.title !== "[Removed]");
    cache.set(language, { at: Date.now(), articles });
    return send(res, articles);
  } catch (err) {
    console.error("News fetch failed:", err.message);
    // Serve stale results if we have them, otherwise the curated list.
    return send(res, cached ? cached.articles : FALLBACK_ARTICLES);
  }
};

module.exports = { getNews };
