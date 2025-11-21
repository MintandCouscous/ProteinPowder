import { GoogleGenAI, Tool } from "@google/genai";
import { DocumentFile, Message, MessageRole, SearchSource } from '../types';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

// Initialize API Client
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

interface QueryResponse {
  text: string;
  sources?: SearchSource[];
}

export const queryGemini = async (
  currentQuery: string,
  history: Message[],
  activeDocuments: DocumentFile[],
  useWebSearch: boolean = false
): Promise<QueryResponse> => {
  const ai = getClient();

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
  // This stateless context injection ensures the model always has access to the selected docs for the immediate question.
  
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

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Error: Unable to process request. Please verify your API key and try again." };
  }
};