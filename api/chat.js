/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * 升級版：支援獨立 System Instruction 欄位，強化行為約束力
 */

export default async function handler(req, res) {
  // 1. CORS 安全設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理預檢請求 (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { contents, systemInstruction } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // 2. 檢查環境變數
  if (!apiKey) {
    return res.status(500).json({ 
      error: "伺服器配置錯誤：環境變數 GEMINI_API_KEY 尚未設定，請在 Vercel 設定中加入後重新部署。" 
    });
  }

  // 3. 呼叫 Gemini API
  // 使用最新 preview 模型以支援進階心理分析
  const modelId = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents, // 使用者與教練的歷史紀錄
      systemInstruction: {
        parts: [{ text: systemInstruction }] // 獨立的系統指令欄位
      },
      generationConfig: {
        temperature: 0.7, // 保持適度創意與同理心
        topP: 0.95,
        maxOutputTokens: 1024
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error Response:", data);
      return res.status(response.status).json({ 
        error: data.error?.message || "Google API 呼叫發生錯誤" 
      });
    }

    // 4. 解析並回傳內容
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "教練目前無法產出回覆，請嘗試重新敘述。";
    
    res.status(200).json({ text });

  } catch (error) {
    console.error("Vercel Runtime Error:", error);
    res.status(500).json({ error: "伺服器處理連線時發生錯誤：" + error.message });
  }
}
