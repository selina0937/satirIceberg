/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * 解決回覆截斷與 API 限額錯誤處理
 */

export default async function handler(req, res) {
  // 1. CORS 與安全性設定：允許您的 GitHub Pages 跨域呼叫
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
    return res.status(405).json({ error: "只支援 POST 方法。" });
  }

  const { contents, systemInstruction, generationConfig } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // 2. 檢查 Vercel 環境變數
  if (!apiKey) {
    return res.status(500).json({ 
      error: "伺服器環境變數 GEMINI_API_KEY 未設定，請在 Vercel 設定後重新部署專案。" 
    });
  }

  // 3. 呼叫 Gemini 2.5 Flash 模型
  const modelId = "gemini-2.5-pro";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: contents, // 包含過往對話紀錄
      systemInstruction: {
        parts: [{ text: systemInstruction }] // 獨立系統指令，強化 AI 依從性
      },
      generationConfig: {
        ...(generationConfig || {}), // 接收前端傳入的 config
        maxOutputTokens: 4096,      // 強制設定高上限，防止文字被切斷
        temperature: 0.75,          // 保持適度心理分析深度
        topP: 0.95
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // 4. 錯誤處理邏輯
    if (!response.ok) {
      // 針對配額限制 (Rate Limit / Quota) 給予明確提示
      if (response.status === 429) {
        return res.status(429).json({ 
          error: "Google API 限額已滿（通常是每分鐘 15 次或每日 1500 次上限）。請等一分鐘後再試，或嘗試更換 API Key。" 
        });
      }
      return res.status(response.status).json({ 
        error: data.error?.message || "呼叫 Google API 時發生未知錯誤。" 
      });
    }

    // 5. 成功回傳 AI 生成的文字
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "教練暫時無法產出文字
