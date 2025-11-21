export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  content: string; // Base64 or Text
  isInlineData: boolean; // True for PDF/Images, False for pure text
  mimeType: string;
  category: 'financial' | 'legal' | 'market' | 'memo';
  uploadDate: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'area';
  title: string;
  data: Array<{ name: string; [key: string]: string | number }>;
  dataKeys: string[]; // Keys to plot (e.g., "Revenue", "EBITDA")
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sources?: SearchSource[];
  relatedDocs?: string[]; // IDs of documents referenced
  chartData?: ChartData; // Optional visualization data
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  selectedDocIds: string[];
}