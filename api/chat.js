export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const { contents, systemInstruction, generationConfig } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY 未設定" });

  const modelId = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      // 優先使用前端傳入的配置，並強制設定高 Token 上限
      generationConfig: {
        ...(generationConfig || {}),
        maxOutputTokens: 4096, 
        temperature: 0.7
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
