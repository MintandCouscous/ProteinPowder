
import { GoogleGenAI, Tool } from "@google/genai";
import { DocumentFile, Message, MessageRole, SearchSource } from '../types';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

interface QueryResponse {
  text: string;
  sources?: SearchSource[];
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
  useWebSearch: boolean = false
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
  // We wrap the query with a specific instruction to ensure the model looks at history and ignores typos.
  const augmentedQuery = `
  [INSTRUCTION: Use the provided documents and conversation history to answer. Handle spelling mistakes intelligently (fuzzy match). If the user refers to previous topics, use the history context.]
  
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
        systemInstruction: INITIAL_SYSTEM_INSTRUCTION, 
        temperature: 0.4, // Slightly higher temperature for better fuzzy matching/inference
        tools: tools.length > 0 ? tools : undefined,
      }
    });

    const text = response.text || "I analyzed the data but could not generate a text response.";
    
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

    return { text, sources };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = "Unable to process request.";
    
    if (error.message) {
      errorMessage += ` Details: ${error.message}`;
    }
    
    // Specific handling to expose RAW error for user debugging
    if (error.status === 400) errorMessage = `API Error (400): Invalid Request. Raw: ${error.message}`;
    if (error.status === 403) errorMessage = `API Error (403): Permission Denied. Raw: ${error.message}`;
    
    if (error.status === 429) {
        // Check if it's a specific "Generative Language API" not enabled error
        if (error.message && error.message.includes("User Project is not enabled")) {
            errorMessage = "API Error (429): 'Generative Language API' is not enabled on your Google Cloud Project. Please search for it in the Console and click Enable.";
        } else {
            errorMessage = `API Error (429): Quota Exceeded. Raw details: ${error.message}`;
        }
    }

    return { text: `**System Error:** ${errorMessage}` };
  }
};

/**
 * Special function to generate structured JSON data for Excel extraction.
 * Uses Gemini's responseMimeType: 'application/json' feature.
 */
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
    - Each object should represent a row (e.g., a year, a quarter, or a company).
    - Normalize number formats (remove commas/currency symbols).
    - If data is missing, use null or "N/A".
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      role: 'user',
      parts: [...documentParts, { text: extractionPrompt }]
    },
    config: {
      responseMimeType: 'application/json', // The API "Killer Feature"
      temperature: 0.1 // Strict for data extraction
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
