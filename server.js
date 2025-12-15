const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const RSSParser = require('rss-parser');
const dotenv = require('dotenv');

dotenv.config(); // .envファイルから環境変数をロード
const app = express();
const port = 3000;

// Gemini APIクライアントを初期化
const parser = new RSSParser();

// server.js (CATEGORIES 部分のみ更新)
const CATEGORIES = {
  "tech": {
    name: "テクノロジー",
    url: "https://www.itmedia.co.jp/news/rss/index.xml"
  },
  "business": {
    name: "ビジネス",
    url: "https://www.nikkei.com/rss/01.xml"
  },
  "entertainment": {
    name: "エンタメ",
    url: "https://natalie.mu/all/rss/all"
  },
};

app.use(express.static('public')); // クライアントファイルをホストするディレクトリ

/**
 * ニュースの内容からGemini APIでタグを生成する関数
 * @param {string} title ニュースのタイトル
 * @param {string} description ニュースの概要
 * @returns {Promise<string>} 生成されたタグの文字列
 */
async function generateTags(title, description) {
  try {
    const prompt = `以下のニュースのタイトルと概要を読み、最も関連性の高いキーワードをカンマ区切りで5つ生成してください。
タイトル: ${title}
概要: ${description}`;

    // Gemini 2.5 Flash を使用してタグを生成
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            // タグだけが欲しいので、レスポンスの自由度を下げる
            temperature: 0.1
        }
    });

    // テキストレスポンスから改行や余分なスペースを削除して返す
    return response.text.trim();
  } catch (error) {
    console.error("Gemini APIエラー:", error);
    return "AIタグ生成エラー";
  }
}


// ニュースを取得し、タグを付与するAPIエンドポイント
app.get('/api/news/:categoryKey', async (req, res) => {
  const categoryKey = req.params.categoryKey;
  const category = CATEGORIES[categoryKey];

  if (!category) {
    return res.status(404).json({ error: "カテゴリが見つかりません" });
  }

  try {
    // 1. RSSの取得とパース
    const feed = await parser.parseURL(category.url);
    const newsItems = feed.items.slice(0, 10); // 上位10件に限定

    // 2. ニュース一つ一つに対してGemini APIでタグを並列生成
    const newsWithTags = await Promise.all(
      newsItems.map(async (item) => {
        const tags = await generateTags(item.title, item.contentSnippet || item.content);
        return {
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          // Gemini APIが生成したタグ
          aiTags: tags 
        };
      })
    );

    // 3. クライアントへのデータ送信
    res.json({
      category: category.name,
      news: newsWithTags
    });
  } catch (error) {
    console.error("RSS取得エラー:", error);
    res.status(500).json({ error: "ニュースの取得に失敗しました" });
  }
});

app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
});

// **重要: APIキーの扱い**
// プロジェクトのルートディレクトリに `.env` ファイルを作成し、
// GEMINI_API_KEY="YOUR_API_KEY_HERE"
// を記述してください。