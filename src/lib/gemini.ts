import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({ apiKey });

export async function chatWithAI(messages: { role: 'user' | 'model', content: string }[]) {
  const model = "gemini-3-flash-preview";
  
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: "You are CampusPilot AI, a strategic assistant for university students. You help with academic planning, financial management, and wellbeing. Be concise, technical, and supportive. You know about international and local student needs.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    return "I'm sorry, I'm experiencing some system latency. Please try again.";
  }
}
