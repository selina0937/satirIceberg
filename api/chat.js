// Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  // CORS 設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

  const { contents, systemInstruction } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("錯誤：環境變數 GEMINI_API_KEY 未設定");
    return res.status(500).json({ error: "伺服器環境變數 GEMINI_API_KEY 缺失，請在 Vercel 設定後重新部署。" });
  }

  const modelId = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemInstruction }] },
          ...contents
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Google API 錯誤:", data);
      return res.status(response.status).json({ error: data.error?.message || "Google API 呼叫失敗" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 暫時無法回應。";
    res.status(200).json({ text });
  } catch (error) {
    console.error("伺服器運行錯誤:", error);
    res.status(500).json({ error: "伺服器發生意外錯誤：" + error.message });
  }
}
