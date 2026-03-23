/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * 使用 Gemini 2.5 Flash 模型
 * 支援四重 API KEY 分流與 Token 計算
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const { contents, systemInstruction, generationConfig, mode } = req.body;

  // 支援 4 把 API Key 切換 (請在 Vercel 環境變數設定)
  const key1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  const key2 = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
  const key3 = process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY;
  const key4 = process.env.GEMINI_API_KEY_4 || process.env.GEMINI_API_KEY;

  let apiKey = key1; // 預設 Phase 1
  if (mode === 'ALCHEMY') apiKey = key2;
  if (mode === 'NVC') apiKey = key3;
  if (mode === 'DREAM') apiKey = key4;

  if (!apiKey) return res.status(500).json({ error: "伺服器環境變數缺失。" });

  const modelId = "gemini-2.5-flash"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        ...(generationConfig || {}),
        maxOutputTokens: 1024, 
        temperature: 0.75,
        topP: 0.95
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: "API 額度已用盡，請更換 API Key 或稍後再試。" });
      }
      return res.status(response.status).json({ error: data.error?.message || "Google API 呼叫失敗" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const tokenUsage = data.usageMetadata || {}; // 抓取 Token 使用量

    // 將文字與 Token 數據一併回傳給前端
    res.status(200).json({ text, tokenUsage });

  } catch (error) {
    res.status(500).json({ error: "代理系統執行錯誤：" + error.message });
  }
}


