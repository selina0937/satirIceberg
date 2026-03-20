/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * 使用 Gemini 2.5 Flash 模型
 * 支援雙 API KEY 分流與防截斷機制
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

  // 支援雙 API Key 切換 (請在 Vercel Environment Variables 設定這兩個變數)
  const key1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  const key2 = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;

  // 判斷使用哪一把 KEY：若前端傳入 ALCHEMY (第二階段)，則使用 KEY 2
  let apiKey = key1;
  if (mode === 'ALCHEMY') {
    apiKey = key2;
  }

  if (!apiKey) return res.status(500).json({ error: "伺服器環境變數缺失 (請設定 GEMINI_API_KEY_1)。" });

  // 鎖定使用 Gemini 2.5 Flash
  const modelId = "gemini-2.5-flash"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        ...(generationConfig || {}),
        maxOutputTokens: 2048, // 足夠容納 200 字以內的回覆，並節省 Token
        temperature: 0.75,
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
        return res.status(429).json({ error: "API 額度已用盡，請更換 API Key 或稍後再試。" });
      }
      return res.status(response.status).json({ error: data.error?.message || "Google API 呼叫失敗" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });

  } catch (error) {
    res.status(500).json({ error: "代理系統執行錯誤：" + error.message });
  }
}


