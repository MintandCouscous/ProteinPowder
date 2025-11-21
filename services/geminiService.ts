import { GoogleGenAI, Tool } from "@google/genai";
import { DocumentFile, Message, MessageRole, SearchSource, ChartData } from '../types';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

interface QueryResponse {
  text: string;
  sources?: SearchSource[];
  chartData?: ChartData;
}

// Lightweight validation call
export const validateGeminiKey = async (apiKey: string): Promise<{valid: boolean, message: string}> => {
  if (!apiKey) return { valid: false, message: "No API Key provided" };
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { role: 'user', parts: [{ text: 'Test' }] },
    });
    return { valid: true, message: "Connection Successful" };
  } catch (error: any) {
    let msg = error.message || "Unknown Error";
    
    // Expose RAW error for debugging paid/billing issues
    if (error.status === 429) {
      msg = `Quota Exceeded (429). Raw Error: ${error.message}`;
    }
    if (error.status === 403) {
      msg = `Permission Denied (403). Raw Error: ${error.message}`;
    }
    return { valid: false, message: msg };
  }
};

export const queryGemini = async (
  apiKey: string,
  currentQuery: string,
  history: Message[],
  activeDocuments: DocumentFile[],
  useWebSearch: boolean = false,
  // New overrides for Synthesis/Strict Mode
  temperature: number = 0.4,
  systemInstructionOverride?: string
): Promise<QueryResponse> => {
  if (!apiKey) {
    return { text: "⚠️ **Configuration Error:** No Gemini API Key found.\n\nPlease open the **Debugger** (bug icon top right) and paste your API Key to enable AI features." };
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Prepare Context from Documents (as Parts)
  const documentParts = activeDocuments.map(doc => {
    if (doc.isInlineData) {
      return {
        inlineData: {
          data: doc.content,
          mimeType: doc.mimeType
        }
      };
    } else {
      return {
        text: `DOCUMENT START [Name: ${doc.name}]:\n${doc.content}\nDOCUMENT END\n`
      };
    }
  });

  // 2. Prepare Conversation History (as Content objects)
  const historyContents = history
    .filter(m => m.role !== MessageRole.SYSTEM)
    .map(m => ({
      role: m.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  // 3. Configure Tools
  const tools: Tool[] = [];
  if (useWebSearch) {
    tools.push({ googleSearch: {} });
  }

  // 4. Construct Final Request
  const augmentedQuery = `
  [INSTRUCTION: Use the provided documents and conversation history to answer. Handle spelling mistakes intelligently (fuzzy match).
  
  VISUALIZATION RULE:
  If the user asks for trends, comparisons, or data that is best shown in a chart, you MUST include a JSON block at the END of your response in this exact format:
  \`\`\`json
  {
    "chart": {
      "type": "bar", // or "line"
      "title": "Revenue vs EBITDA (2021-2023)",
      "data": [
        {"name": "2021", "Revenue": 100, "EBITDA": 20},
        {"name": "2022", "Revenue": 120, "EBITDA": 25}
      ],
      "dataKeys": ["Revenue", "EBITDA"]
    }
  }
  \`\`\`
  Do NOT mention that you are generating JSON. Just show the text analysis first, then the hidden block.]
  
  User Query: ${currentQuery}
  `;

  const currentTurnContent = {
    role: 'user',
    parts: [
      ...documentParts,
      { text: augmentedQuery }
    ]
  };

  const finalContents = [
     ...historyContents,
     currentTurnContent
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: finalContents,
      config: {
        systemInstruction: systemInstructionOverride || INITIAL_SYSTEM_INSTRUCTION, 
        temperature: temperature, // Use the passed temperature (0.0 for synthesis)
        tools: tools.length > 0 ? tools : undefined,
      }
    });

    let text = response.text || "I analyzed the data but could not generate a text response.";
    let chartData: ChartData | undefined;

    // Check for embedded Chart JSON
    const jsonMatch = text.match(/```json\s*({[\s\S]*"chart"[\s\S]*})\s*```/);
    if (jsonMatch) {
      try {
        const rawJson = JSON.parse(jsonMatch[1]);
        if (rawJson.chart) {
          chartData = rawJson.chart;
          // Remove the JSON block from the visible text so it looks clean
          text = text.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        console.warn("Failed to parse chart JSON", e);
      }
    }
    
    // Extract Grounding Metadata
    let sources: SearchSource[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || 'Web Source',
            uri: chunk.web.uri
          });
        }
      });
    }

    return { text, sources, chartData };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = "Unable to process request.";
    
    if (error.message) {
      errorMessage += ` Details: ${error.message}`;
    }
    
    if (error.status === 400) errorMessage = `API Error (400): Invalid Request. Raw: ${error.message}`;
    if (error.status === 403) errorMessage = `API Error (403): Permission Denied. Raw: ${error.message}`;
    
    if (error.status === 429) {
        if (error.message && error.message.includes("User Project is not enabled")) {
            errorMessage = "API Error (429): 'Generative Language API' is not enabled. Please Enable in Google Cloud Console.";
        } else if (error.message && error.message.includes("quota")) {
            // Parse retry time from message
            const retryMatch = error.message.match(/retry in ([0-9.]+)s/);
            const waitTime = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : "a few";
            errorMessage = `⚠️ **High Traffic (Quota)**: You sent too much data (1M+ Tokens). Please wait **${waitTime} seconds** before sending the next message.`;
        } else {
            errorMessage = `API Error (429): Quota Exceeded. Raw details: ${error.message}`;
        }
    }

    return { text: `${errorMessage}` };
  }
};

export const generateStructuredData = async (
  apiKey: string,
  fieldsToExtract: string,
  activeDocuments: DocumentFile[]
): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey });

  const documentParts = activeDocuments.map(doc => {
    if (doc.isInlineData) {
      return {
        inlineData: {
          data: doc.content,
          mimeType: doc.mimeType
        }
      };
    } else {
      return {
        text: `DOCUMENT START [Name: ${doc.name}]:\n${doc.content}\nDOCUMENT END\n`
      };
    }
  });

  const extractionPrompt = `
    Analyze the provided documents.
    Task: Extract the following fields into a strictly formatted JSON array.
    Fields to Extract: ${fieldsToExtract}

    Output Requirement:
    - Return ONLY a JSON array of objects.
    - Each object should represent a row.
    - Normalize number formats.
    - If data is missing, use null or "N/A".
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      role: 'user',
      parts: [...documentParts, { text: extractionPrompt }]
    },
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1 
    }
  });

  if (response.text) {
    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse JSON response", e);
      throw new Error("AI generated invalid JSON.");
    }
  }
  return [];
};