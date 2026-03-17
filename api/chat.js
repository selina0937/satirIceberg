/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * 使用 Gemini 2.5 Flash 模型
 * V3.0 支援雙 API KEY 負載平衡 (Phase 1 & Phase 2 分流)
 */

export default async function handler(req, res) {
  // CORS 與安全性設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const { contents, systemInstruction, generationConfig, mode } = req.body;

  // 從 Vercel 抓取兩組 API KEY（若無獨立 KEY，則降級使用預設 KEY）
  const key1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  const key2 = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;

  // 判斷使用哪一把 KEY：若明確傳入 ALCHEMY 或指令中包含「煉金」，則使用 KEY 2
  let apiKey = key1;
  if (mode === 'ALCHEMY' || (systemInstruction && systemInstruction.includes('煉金'))) {
    apiKey = key2;
  }

  if (!apiKey) return res.status(500).json({ error: "伺服器環境變數缺失 (請設定 GEMINI_API_KEY_1 與 GEMINI_API_KEY_2)。" });

  // 鎖定使用 Gemini 2.5 Flash
  const modelId = "gemini-2.5-flash"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        ...(generationConfig || {}),
        maxOutputTokens: 4096, 
        temperature: 0.7,
        topP: 0.95
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || contentType.indexOf("application/json") === -1) {
      const rawText = await response.text();
      return res.status(response.status).json({ error: "API 響應異常：" + rawText.substring(0, 100) });
    }

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: "API 額度已用盡，請稍後再試或更換 API Key。" });
      }
      return res.status(response.status).json({ error: data.error?.message || "Google API 呼叫失敗" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });

  } catch (error) {
    res.status(500).json({ error: "代理系統執行錯誤：" + error.message });
  }
}
