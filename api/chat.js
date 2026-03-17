/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * V2.3 強化錯誤捕捉與 Token 效率優化
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const { contents, systemInstruction, generationConfig } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "伺服器 GEMINI_API_KEY 缺失。" });

  const modelId = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        ...(generationConfig || {}),
        maxOutputTokens: 2048, // 適度降低以節省 TPM，但仍足夠心理分析
        temperature: 0.7
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // 檢查 Google 是否回傳了非 JSON 內容
    const contentType = response.headers.get("content-type");
    if (!contentType || contentType.indexOf("application/json") === -1) {
      const rawText = await response.text();
      return res.status(response.status).json({ error: "Google API 回傳非 JSON 內容：" + rawText.substring(0, 100) });
    }

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || "Google API 呼叫失敗";
      return res.status(response.status).json({ error: errMsg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });

  } catch (error) {
    res.status(500).json({ error: "伺服器代理異常：" + error.message });
  }
}
