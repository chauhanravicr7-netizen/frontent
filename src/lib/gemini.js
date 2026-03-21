import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("⚠️ VITE_GEMINI_API_KEY not found in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function askGemini(userQuery, businessContext) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are a smart business assistant for a timber trading company using Dockside ERP.
You have access to real-time business data. Be concise, use numbers, give actionable advice.

CURRENT BUSINESS SNAPSHOT:
${JSON.stringify(businessContext, null, 2)}

Answer business questions clearly. Use ₹ for amounts. Give specific insights, not generic advice.`;

    const fullPrompt = `${systemPrompt}\n\nUser Question: ${userQuery}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return {
      success: true,
      message: text,
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      success: false,
      message: `Error: ${error.message}. Please check your API key in .env.local`,
    };
  }
}

export default { askGemini };
