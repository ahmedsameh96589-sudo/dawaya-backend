const getNews = (req, res) => {
  const news = [
    {
      id: "launch-01",
      title: "DAWAYA launches new delivery zones",
      summary: "We have expanded same-day delivery to more neighborhoods.",
      imageUrl: "https://images.unsplash.com/photo-1584308666999-f0a7c2806a44?w=800",
      publishedAt: "2026-03-20T09:00:00.000Z",
    },
    {
      id: "promo-02",
      title: "Spring health check offers",
      summary: "Enjoy discounts on selected vitamins and wellness products.",
      imageUrl: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800",
      publishedAt: "2026-03-18T13:30:00.000Z",
    },
    {
      id: "update-03",
      title: "Prescription uploads are faster",
      summary: "We improved upload speed and added better status tracking.",
      imageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800",
      publishedAt: "2026-03-15T10:15:00.000Z",
    },
  ];

  res.status(200).json({
    success: true,
    count: news.length,
    data: { news },
  });
};

module.exports = { getNews };
