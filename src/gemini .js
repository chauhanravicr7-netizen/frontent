import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY not found - AI features will be disabled");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function askGemini(prompt, context = {}) {
  if (!genAI) {
    return "AI features are disabled. Please add VITE_GEMINI_API_KEY to your environment variables.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = Object.keys(context).length > 0
      ? `Context: ${JSON.stringify(context, null, 2)}\n\nQuestion: ${prompt}`
      : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini AI error:", error);
    return `AI Error: ${error.message}`;
  }
}
