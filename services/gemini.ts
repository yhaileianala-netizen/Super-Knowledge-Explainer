
// Use the recommended import for GoogleGenAI
import { GoogleGenAI } from "@google/genai";
import { Message, SessionContext } from "../types";

/**
 * Sends a message to the Gemini API and retrieves a response.
 * Adheres to the guideline of using process.env.API_KEY directly for initialization.
 */
export const sendMessageToGemini = async (
  modelName: string,
  promptTemplate: string,
  userInput: string,
  history: Message[],
  context: SessionContext,
  thinkingBudget: number = 0,
  imageDatas?: string[]
) => {
  // CRITICAL: Always use the process.env.API_KEY directly in the constructor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Replace template variables in the system instruction
  const systemInstruction = promptTemplate
    .replace(/{instructor_name}/g, context.instructorName || '未指定')
    .replace(/{research_field}/g, context.researchField || '未指定')
    .replace(/{institution}/g, context.institution || '未指定')
    .replace(/{course_name}/g, context.courseName || '未指定')
    .replace(/{theoretical_framework}/g, context.theoreticalFramework || '未指定');

  // Construct message history for context, mapping roles correctly
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Add the current user input parts
  const currentParts: any[] = [{ text: userInput }];
  
  // Attach images if provided (base64 data)
  if (imageDatas && imageDatas.length > 0) {
    imageDatas.forEach(data => {
      currentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: data.split(',')[1] || data
        }
      });
    });
  }

  // Final contents array for generateContent
  contents.push({
    role: 'user',
    parts: currentParts
  });

  try {
    const config: any = {
      systemInstruction,
    };

    // Apply thinkingBudget for Gemini 3 series models if specified
    if (thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget };
    }

    // Call generateContent with the unified parameter object
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config
    });

    // Directly access .text property as it is a getter (not a method)
    return {
      text: response.text || "No response received.",
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
