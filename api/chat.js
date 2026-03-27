export default async function handler(req, res) {
    // 1. 設定 CORS，允許前端跨域呼叫
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { contents, systemInstruction } = req.body;

    const keys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4
    ].filter(Boolean); 

    if (keys.length === 0) {
        return res.status(500).json({ error: "尚未設定任何 Gemini API Key" });
    }

    const randomKey = keys[Math.floor(Math.random() * keys.length)];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${randomKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { 
                    // 🚀 強制把天花板拉到極高
                    maxOutputTokens: 1500,
                    temperature: 0.7 
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
            const text = data.candidates[0].content.parts[0].text;
            const tokenUsage = data.usageMetadata;
            // 🚨 終極抓鬼暗號：送出 backendVersion 給前端檢查
            res.status(200).json({ text, tokenUsage, backendVersion: "v10" });
        } else {
             res.status(500).json({ error: "API 回傳格式異常，無文字內容。" });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
