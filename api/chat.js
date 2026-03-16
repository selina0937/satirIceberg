/**
 * 薩提爾全效工具 - 專用後端代理 (Vercel Serverless Function)
 * * 功能：
 * 1. 隱藏並保護 Gemini API Key。
 * 2. 處理跨來源資源共用 (CORS)，允許前端網頁呼叫。
 * 3. 轉發對話內容、系統指令及生成設定至 Google Gemini API。
 */

export default async function handler(req, res) {
  // --- 1. CORS 設定 ---
  // 允許所有來源進行存取 (可根據需求將 '*' 改為您的 GitHub Pages 網址)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 處理瀏覽器發送的預檢請求 (Preflight Request)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 僅限制使用 POST 方法
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "方法不允許 (Method Not Allowed)" });
  }

  // --- 2. 環境變數檢查 ---
  const { contents, systemInstruction, generationConfig } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("錯誤：伺服器尚未設定 GEMINI_API_KEY 環境變數");
    return res.status(500).json({ 
      error: "伺服器環境變數 GEMINI_API_KEY 缺失，請在 Vercel 後端設定後重新部署。" 
    });
  }

  // --- 3. 準備呼叫 Google Gemini API ---
  // 使用最新預覽模型以獲取最佳的心理分析與同理回饋
  const modelId = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    // 建立發送給 Google 的 Payload
    const payload = {
      contents: contents, // 完整的對話紀錄
      systemInstruction: {
        parts: [{ text: systemInstruction }] // 獨立的系統指令，維持教練人格與步驟
      },
      generationConfig: {
        // 優先採用前端傳入的 config (包含 maxOutputTokens: 4096)
        ...(generationConfig || {}),
        maxOutputTokens: 4096, // 強制高上限以防語句截斷
        temperature: 0.7,      // 保持適度的創造力與人性化同理
        topP: 0.95
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // 檢查 Google API 是否回傳錯誤
    if (!response.ok) {
      console.error("Google API 錯誤回應:", data);
      return res.status(response.status).json({ 
        error: data.error?.message || "Google API 呼叫失敗" 
      });
    }

    // 解析生成文字
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "教練目前無法產出回覆，請嘗試重新提問。";

    // 傳回成功回應
    res.status(200).json({ text });

  } catch (error) {
    console.error("伺服器端發生異常:", error);
    res.status(500).json({ 
      error: "伺服器發生意外錯誤：" + error.message 
    });
  }
}
