export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const { contents, systemInstruction, generationConfig } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "伺服器環境變數 GEMINI_API_KEY 未設定。" });

  const modelId = "gemini-2.5-pro";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        ...(generationConfig || {}),
        maxOutputTokens: 4096,
        temperature: 0.75
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      // 這裡會把 Google 傳回的具體錯誤 (例如 Daily Quota Exceeded) 傳給前端
      const errMsg = data.error?.message || "Google API 呼叫失敗";
      return res.status(response.status).json({ error: errMsg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });

  } catch (error) {
    res.status(500).json({ error: "伺服器異常：" + error.message });
  }
}
