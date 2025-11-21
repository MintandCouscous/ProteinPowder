import { GoogleGenAI, Tool } from "@google/genai";
import { DocumentFile, Message, MessageRole, SearchSource } from '../types';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

interface QueryResponse {
  text: string;
  sources?: SearchSource[];
}

export const queryGemini = async (
  apiKey: string,
  currentQuery: string,
  history: Message[],
  activeDocuments: DocumentFile[],
  useWebSearch: boolean = false
): Promise<QueryResponse> => {
  if (!apiKey) {
    return { text: "Error: No API Key provided. Please configure your Gemini API Key in the Debugger." };
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
  // To avoid "Mixing Content and Parts" error, we ensure all elements in 'contents' are valid Content objects.
  // We attach the document context to the current user query part.
  
  const currentTurnContent = {
    role: 'user',
    parts: [
      ...documentParts,
      { text: currentQuery }
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
        temperature: 0.3,
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
    
    // Check for common error codes
    if (error.status === 400) errorMessage = "API Error (400): Invalid Request. Check your API Key or inputs.";
    if (error.status === 403) errorMessage = "API Error (403): Permission Denied. Your API Key might be restricted.";
    if (error.status === 429) errorMessage = "API Error (429): Quota Exceeded.";

    return { text: `**System Error:** ${errorMessage}` };
  }
};