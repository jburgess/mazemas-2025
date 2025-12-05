import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// We will use 2.5-flash for speed and reasonably good SVG generation
const MODEL = "gemini-2.5-flash";

export interface CenterPieceResponse {
  svgPath: string;
  viewBox: string;
  description: string;
}

export const generateCenterPiece = async (prompt: string): Promise<CenterPieceResponse> => {
  try {
    const fullPrompt = `
      You are an expert SVG artist. Create a simple, single-color SVG icon representing: "${prompt}".
      
      Constraints:
      1. The output must be valid SVG path data (the 'd' attribute).
      2. It must fit within a square viewBox (e.g., 0 0 100 100).
      3. The style should be clean, stencil-like, suitable for laser cutting (no tiny floating islands if possible, though not strictly required).
      4. Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            svgPath: { type: Type.STRING, description: "The 'd' attribute for the SVG path" },
            viewBox: { type: Type.STRING, description: "The viewBox string, e.g., '0 0 100 100'" },
            description: { type: Type.STRING, description: "Short description of what was generated" }
          },
          required: ["svgPath", "viewBox", "description"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned");
    
    return JSON.parse(jsonText) as CenterPieceResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const analyzeMaze = async (mazeParams: string): Promise<string> => {
    // A fun feature to generate a "Lore" or description for the maze
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a short, mystical name and a one-sentence backstory for a circular labyrinth with the following traits: ${mazeParams}.`
        });
        return response.text || "The Labyrinth of Unknown Origins";
    } catch (e) {
        return "The Silent Maze";
    }
}
