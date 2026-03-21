import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY is not set. AI features will be disabled.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function askGemini(userQuery, businessContext) {
  if (!genAI) {
    return "AI is not configured. Please set VITE_GEMINI_API_KEY in your .env file.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const systemPrompt = `You are a smart business assistant for a timber trading company using Dockside ERP.
You have access to real-time business data. Be concise, use numbers, give actionable advice.

CURRENT BUSINESS SNAPSHOT:
- Inventory: ${businessContext.summary.totalProducts} products, total value ₹${businessContext.summary.totalValue.toLocaleString("en-IN")}
- Revenue (paid): ₹${businessContext.summary.revenue.toLocaleString("en-IN")}
- Pending payments: ₹${businessContext.summary.pending.toLocaleString("en-IN")}
- Active deals: ${businessContext.summary.activeDeals}
- Customers: ${businessContext.summary.totalCustomers}
- Yards: ${businessContext.summary.yards}

LOW STOCK ITEMS (< 10 units):
${businessContext.lowStock.map(i => `- ${i.name}: ${i.qty} ${i.unit}`).join("\n") || "None"}

TOP PRODUCTS BY VOLUME:
${businessContext.topProducts.map(i => `- ${i.name}: ${i.qty} ${i.unit}`).join("\n")}

RECENT DEALS (last 10):
${businessContext.recentDeals.map(d => `- ${d.customer} | ${d.product} | Qty: ${d.qty} | Rs ${d.value} | ${d.stage}`).join("\n")}

Answer business questions clearly. Use ₹ for amounts. Give specific insights, not generic advice.

USER QUESTION: ${userQuery}`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Sorry, I encountered an error: ${error.message}. Please try again.`;
  }
}
