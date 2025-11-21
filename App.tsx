
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import { Message, MessageRole, DocumentFile } from './types';
import { DUMMY_DOCUMENTS } from './constants';
import { queryGemini, validateGeminiKey, generateStructuredData } from './services/geminiService';
import { initGoogleDrive, handleAuthClick, openDrivePicker, processPickedFiles } from './services/driveService';
import { Send, Globe, Paperclip, Loader2, ShieldCheck, AlertTriangle, X, Bug, Rocket, Terminal, Copy, Check, Key, RefreshCw, Trash2, Zap, CreditCard, ExternalLink, Wrench, FileSpreadsheet, Download, FileJson, Sparkles, AlertCircle, FileText, Cpu } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

const App: React.FC = () => {
  // Shared Team Key (Baked In)
  const SHARED_TEAM_KEY = 'AIzaSyDox5A9c3_rg-BD8zCgdC186-EcOaOvzfM';

  // State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.MODEL,
      content: "# AlphaVault Team Terminal (v1.7.0)\n\nI am online and secure. The workspace is currently empty.\n\n**To begin analysis:**\n1. Connect **Google Drive** (Left Sidebar) to import Deal Room folders.\n2. Or upload local PDFs/Excel files.\n\nOnce data is loaded, I can perform cross-file analysis, financial summarization, and risk assessment.",
      timestamp: Date.now(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isDriveReady, setIsDriveReady] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [driveInitError, setDriveInitError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Start with Empty Docs in Production
  const [documents, setDocuments] = useState<DocumentFile[]>(DUMMY_DOCUMENTS);
  const [activeDocIds, setActiveDocIds] = useState<string[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  
  // API Key State (Runtime Config with Persistence)
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ALPHA_VAULT_API_KEY');
      if (stored) return stored;
    }
    return SHARED_TEAM_KEY; // Use the baked-in key by default
  });
  const [keySaved, setKeySaved] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [keyStatusMsg, setKeyStatusMsg] = useState('');
  
  // Modal States
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dedicated Picker Key provided by user
  const PICKER_API_KEY = 'AIzaSyCJV-78HN3nii-jfub-vVTNr5ULEK6hkbY';

  // Persist Key Handler
  const handleSaveKey = () => {
    localStorage.setItem('ALPHA_VAULT_API_KEY', geminiApiKey);
    setKeySaved(true);
    setKeyStatus('idle'); // Reset status on save
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleTestKey = async () => {
    setKeyStatus('testing');
    const result = await validateGeminiKey(geminiApiKey);
    setKeyStatus(result.valid ? 'valid' : 'invalid');
    setKeyStatusMsg(result.message);
  };

  const handleClearKey = () => {
    localStorage.removeItem('ALPHA_VAULT_API_KEY');
    // Restore the shared key if user clears their custom one
    setGeminiApiKey(SHARED_TEAM_KEY);
    setKeySaved(false);
    setKeyStatus('idle');
  };

  // Reusable Initialization Logic
  const initializeDriveIntegration = useCallback(() => {
    console.log('AlphaVault v1.7.0 - Drive Init Starting');
    const clientId = process.env.GOOGLE_CLIENT_ID || '803370988138-jocn4veeamir0p635eeq14lsd4117hag.apps.googleusercontent.com';
    
    if (PICKER_API_KEY && clientId) {
      setDriveInitError(null);
      setConfigError(null);
      
      initGoogleDrive(
        PICKER_API_KEY, 
        clientId, 
        () => {
          console.log('Google Drive API Ready');
          setIsDriveReady(true);
          setDriveInitError(null);
        },
        (errorMsg) => {
          console.error('Google Drive Init Failed:', errorMsg);
          setDriveInitError(errorMsg);
          setIsDriveReady(true); 
        }
      );
    } else {
      const errorMsg = `Missing Google Client ID`;
      setConfigError(errorMsg);
    }
  }, []);

  // Initialize on mount & PWA Listener
  useEffect(() => {
    initializeDriveIntegration();

    // PWA Install Event Listener
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [initializeDriveIntegration]);
  
  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Calculate Token Usage
  const calculateTokenUsage = () => {
    // Heuristic: ~3.5 chars per token average for mixed content (Base64 is dense, text is light)
    const chars = activeDocIds.reduce((sum, id) => {
      const doc = documents.find(d => d.id === id);
      return sum + (doc?.content.length || 0);
    }, 0);
    const estimatedTokens = Math.round(chars / 3.5);
    const percentage = Math.min((estimatedTokens / 1000000) * 100, 100); // 1M Token Limit
    return { count: estimatedTokens, percentage };
  };

  const { count: tokenCount, percentage: tokenPercentage } = calculateTokenUsage();

  // Handlers
  const handleConnectDrive = async () => {
    if (configError) {
      setShowDebugModal(true);
      return;
    }

    setIsDriveLoading(true);
    
    try {
      const token = await handleAuthClick();
      openDrivePicker(PICKER_API_KEY, token, async (pickedFiles) => {
        setIsDriveLoading(true);
        try {
           setMessages(prev => [...prev, {
             id: Date.now().toString(),
             role: MessageRole.MODEL,
             content: `*Securely ingesting ${pickedFiles.length} items from Drive...*`,
             timestamp: Date.now()
           }]);

           const newDocs = await processPickedFiles(pickedFiles, token);
           setDocuments(prev => [...prev, ...newDocs]);
           setActiveDocIds(prev => [...prev, ...newDocs.map(d => d.id)]);
           
           setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: MessageRole.MODEL,
            content: `**Ingestion Complete.**\nAdded ${newDocs.length} documents to the active context.\n\nI am ready for your questions.`,
            timestamp: Date.now()
           }]);

        } catch (e) {
          console.error(e);
          setMessages(prev => [...prev, {
             id: Date.now().toString(),
             role: MessageRole.MODEL,
             content: `**Error Processing Files:**\nCould not download files. Ensure they are accessible.`,
             timestamp: Date.now()
           }]);
        } finally {
          setIsDriveLoading(false);
        }
      });
    } catch (error: any) {
      console.error("Drive Auth Error:", error);
      setIsDriveLoading(false);
      setDriveInitError(typeof error === 'string' ? error : "Connection Failed");
      setShowDebugModal(true);
    }
  };

  const handleSendMessage = async (msgContent: string = input) => {
    if (!msgContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: msgContent,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const activeDocs = documents.filter(doc => activeDocIds.includes(doc.id));

    try {
      const response = await queryGemini(
        geminiApiKey, // Pass dynamic key
        userMessage.content,
        messages,
        activeDocs,
        useWebSearch
      );

      const modelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        content: response.text,
        timestamp: Date.now(),
        sources: response.sources,
        chartData: response.chartData
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        content: "I encountered an issue connecting to the AlphaVault secure core. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmartExtract = async () => {
    const fields = prompt("What data would you like to extract to Excel? (e.g. 'Revenue, EBITDA, Net Income for 2022-2023')");
    if (!fields) return;
    setShowToolsMenu(false);

    setMessages(prev => [...prev, {
       id: Date.now().toString(),
       role: MessageRole.MODEL,
       content: `🔄 **Starting Smart Extraction...**\nAnalyzing documents to extract: *${fields}*\nGenerating Excel file...`,
       timestamp: Date.now()
    }]);
    setIsLoading(true);

    try {
      const activeDocs = documents.filter(doc => activeDocIds.includes(doc.id));
      const data = await generateStructuredData(geminiApiKey, fields, activeDocs);
      
      if (data.length === 0) {
         throw new Error("No data found matching those criteria.");
      }

      // Create Excel
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Extraction");
      writeFile(wb, "AlphaVault_Extract.xlsx");

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        content: `✅ **Extraction Complete**\nSuccessfully extracted ${data.length} rows.\nFile downloaded: \`AlphaVault_Extract.xlsx\``,
        timestamp: Date.now()
      }]);

    } catch (e: any) {
       setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        content: `❌ **Extraction Failed**: ${e.message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportChat = () => {
    const chatText = messages.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.role.toUpperCase()}:\n${m.content}\n`).join('\n-------------------\n');
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AlphaVault_Audit_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    setShowToolsMenu(false);
  };

  // Context Synthesis Feature
  const handleSynthesize = async () => {
    if (activeDocIds.length < 2) return;
    setIsSynthesizing(true);
    
    setMessages(prev => [...prev, {
       id: Date.now().toString(),
       role: MessageRole.MODEL,
       content: `🧠 **Synthesizing Deal Room...**\nReading ${activeDocIds.length} documents to create a "Master Deal Bible". This will compress the context and prevent Quota errors.`,
       timestamp: Date.now()
    }]);

    try {
       const activeDocs = documents.filter(doc => activeDocIds.includes(doc.id));
       // We use queryGemini but asking for a summary
       const response = await queryGemini(
         geminiApiKey,
         "Create a comprehensive, high-density 'Deal Bible' summary of all these documents. Include every key financial metric, risk, legal detail, and entity name. Format it as a structured report.",
         [], // No history, just docs
         activeDocs,
         false
       );

       // Create new Document from the Summary
       const summaryDoc: DocumentFile = {
         id: 'summary-' + Date.now(),
         name: `MASTER_DEAL_BIBLE_${new Date().toLocaleDateString().replace(/\//g,'-')}.md`,
         type: 'MEMO',
         content: btoa(response.text), // Encode to base64 to match other docs (though processPickedFiles handles text too, we'll be safe)
         isInlineData: false,
         mimeType: 'text/plain',
         category: 'memo',
         uploadDate: new Date().toISOString()
       };

       // Update State: Add Summary, Select ONLY Summary, Deselect others
       setDocuments(prev => [...prev, summaryDoc]);
       setActiveDocIds([summaryDoc.id]); // Switch context to ONLY the summary

       setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        content: `✅ **Deal Room Synthesized.**\nI have created a Master Memo and switched your active context to it.\n\n**Benefit:** Token usage dropped by ~95%. You can now chat without quota limits while retaining key knowledge.`,
        timestamp: Date.now()
       }]);

    } catch (e: any) {
       setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        content: `❌ **Synthesis Failed:** ${e.message}`,
        timestamp: Date.now()
       }]);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const handleToggleDoc = (id: string) => {
    setActiveDocIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleDeselectAll = () => {
    setActiveDocIds([]);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isBinary = file.type.includes('pdf') || file.type.includes('image');
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const content = isBinary ? result.split(',')[1] : result;

      const newDoc: DocumentFile = {
        id: Date.now().toString(),
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        content: content,
        isInlineData: isBinary,
        mimeType: file.type || 'application/pdf', 
        category: 'financial',
        uploadDate: new Date().toISOString()
      };
      
      setDocuments(prev => [...prev, newDoc]);
      setActiveDocIds(prev => [...prev, newDoc.id]);
    };

    if (isBinary) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const copyEnvVars = () => {
    const envText = `API_KEY=${geminiApiKey}\nGOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || '803370988138-jocn4veeamir0p635eeq14lsd4117hag.apps.googleusercontent.com'}`;
    navigator.clipboard.writeText(envText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'loading...';

  // Shortcuts Logic
  const executeShortcut = (action: 'risk' | 'memo' | 'chart') => {
    if (activeDocIds.length === 0) {
      alert("Please load documents first!");
      return;
    }
    if (action === 'risk') handleSendMessage("Conduct a comprehensive risk scan across all documents. Identify legal, financial, and operational red flags.");
    if (action === 'memo') handleSendMessage("Draft a structured Investment Committee Memo based on these documents. Include: Executive Summary, Key Metrics, Risks, and Recommendation.");
    if (action === 'chart') handleSendMessage("Visualize the key financial trends (Revenue, EBITDA, Net Income) from the documents in a chart.");
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      
      <Sidebar 
        documents={documents}
        activeDocIds={activeDocIds}
        onToggleDoc={handleToggleDoc}
        onDeselectAll={handleDeselectAll}
        onUpload={handleUpload}
        onConnectDrive={handleConnectDrive}
        onSynthesize={handleSynthesize}
        isDriveLoading={isDriveLoading}
        isDriveReady={isDriveReady}
        isSynthesizing={isSynthesizing}
        driveInitError={driveInitError}
        configError={configError}
        onOpenDebug={() => setShowDebugModal(true)}
        onOpenDeploy={() => setShowDeployModal(true)}
        canInstallApp={!!deferredPrompt}
        onInstallApp={handleInstallApp}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        
        {/* HEADER */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sm:px-8 bg-slate-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
             <ShieldCheck size={16} className="text-emerald-500" />
             <span className="hidden sm:inline">Secure Session: <span className="text-white font-mono">ENCRYPTED-256</span></span>
             {geminiApiKey && (
               <div className="ml-4 flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-900/30 border border-emerald-800 text-[10px] text-emerald-400">
                 <Key size={10} />
                 <span>Team Key Active</span>
               </div>
             )}
             
             {/* CONTEXT USAGE METER */}
             <div className="ml-4 flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800" title="Token Usage / Throughput Limit (1 Million Tokens)">
               <Cpu size={12} className={tokenPercentage > 80 ? 'text-red-500' : tokenPercentage > 50 ? 'text-amber-500' : 'text-emerald-500'} />
               <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                 <div 
                    className={`h-full transition-all duration-500 ${tokenPercentage > 90 ? 'bg-red-500' : tokenPercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${tokenPercentage}%` }}
                 />
               </div>
               <span className={`text-[10px] font-mono ${tokenPercentage > 90 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                 {Math.round(tokenCount / 1000)}k Tokens
               </span>
             </div>

          </div>
          <div className="flex items-center gap-4">
             
             {/* TOOLS MENU */}
             <div className="relative">
                <button 
                  onClick={() => setShowToolsMenu(!showToolsMenu)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${showToolsMenu ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}
                >
                  <Wrench size={14} />
                  <span className="text-xs font-medium">Tools</span>
                </button>
                {showToolsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2">
                       <button 
                         onClick={handleSmartExtract}
                         className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left group"
                       >
                         <div className="w-8 h-8 rounded-lg bg-emerald-900/30 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                           <FileSpreadsheet size={16} />
                         </div>
                         <div>
                           <p className="font-semibold text-white">Smart Extract</p>
                           <p className="text-[10px] text-slate-500">Export data to Excel</p>
                         </div>
                       </button>
                       
                       <button 
                         onClick={handleExportChat}
                         className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-left group mt-1"
                       >
                         <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center group-hover:bg-slate-700 group-hover:text-white transition-colors">
                           <Download size={16} />
                         </div>
                         <div>
                           <p className="font-semibold text-white">Audit Export</p>
                           <p className="text-[10px] text-slate-500">Download chat log</p>
                         </div>
                       </button>
                    </div>
                  </div>
                )}
             </div>

             <button 
               onClick={() => setShowDebugModal(true)}
               className="text-xs flex items-center gap-1 text-slate-500 hover:text-emerald-400 transition-colors"
               title="Troubleshoot Connection"
             >
               <Bug size={14} />
               <span className="hidden sm:inline">Debugger</span>
             </button>
            {configError && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-900/50 border border-amber-700 text-amber-200 animate-pulse cursor-help" title={configError}>
                <AlertTriangle size={14} />
                <span className="text-xs font-bold">Setup Required</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${activeDocIds.length > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
              <span className="text-xs font-medium text-slate-300">{activeDocIds.length} Files Active</span>
            </div>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 scroll-smooth">
          <div className="max-w-4xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
               <div className="flex items-center gap-3 text-slate-500 text-sm animate-pulse ml-12 mb-8">
                 <Loader2 size={18} className="animate-spin text-emerald-500" />
                 <span className="font-mono">Analyzing Context...</span>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="p-6 bg-slate-950 border-t border-slate-800">
          <div className="max-w-4xl mx-auto relative">
            
            {/* ANALYST SHORTCUTS BAR (Quick Actions) */}
            <div className="absolute -top-12 left-0 right-0 flex gap-2 justify-center opacity-90 hover:opacity-100 transition-opacity">
               <button onClick={() => executeShortcut('risk')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/30 hover:text-rose-300 text-slate-400 text-xs font-medium rounded-full border border-slate-700 hover:border-rose-500/50 transition-colors">
                 <AlertCircle size={12} /> Risk Scan
               </button>
               <button onClick={() => executeShortcut('chart')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-indigo-900/30 hover:text-indigo-300 text-slate-400 text-xs font-medium rounded-full border border-slate-700 hover:border-indigo-500/50 transition-colors">
                 <Sparkles size={12} /> Visualize Trends
               </button>
               <button onClick={() => executeShortcut('memo')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-900/30 hover:text-emerald-300 text-slate-400 text-xs font-medium rounded-full border border-slate-700 hover:border-emerald-500/50 transition-colors">
                 <FileText size={12} /> Draft Memo
               </button>
            </div>

            <div className="absolute -top-10 left-0 flex gap-2">
              <button 
                onClick={() => setUseWebSearch(!useWebSearch)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors border-t border-l border-r ${
                  useWebSearch 
                    ? 'bg-slate-800 border-slate-700 text-emerald-400' 
                    : 'bg-slate-900/50 border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Globe size={12} />
                Web Grounding {useWebSearch ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Query your knowledge base (e.g., 'What was the EBITDA margin in Q3?')"
                className="w-full bg-transparent text-white placeholder-slate-500 px-4 py-4 pr-14 rounded-xl focus:outline-none resize-none min-h-[60px] max-h-[200px] text-sm leading-relaxed scrollbar-hide"
                rows={1}
                style={{ height: input ? `${Math.min(input.split('\n').length * 24 + 24, 200)}px` : '60px' }}
              />
              
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <label className="p-2 text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer">
                  <Paperclip size={18} />
                  <input type="file" className="hidden" onChange={handleUpload} accept=".txt,.md,.json,.pdf,.png,.jpg" />
                </label>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className={`p-2 rounded-lg transition-all ${
                    input.trim() && !isLoading
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
            
            <div className="mt-2 text-center">
              <p className="text-[10px] text-slate-600">
                Confidential. For internal use only.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* DEBUG MODAL */}
      {showDebugModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Bug className="text-emerald-500" size={18} />
                    <h3 className="text-white font-bold">Connection Troubleshooter</h3>
                 </div>
                 <button onClick={() => setShowDebugModal(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
              </div>
              
              <div className="p-6 space-y-6">
                 {/* API Key Section */}
                 <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-slate-400 uppercase">Gemini API Key (Paid Tier Required)</label>
                       <div className="flex gap-2">
                          {keyStatus === 'valid' && <span className="text-xs text-emerald-400 font-mono flex items-center gap-1"><Check size={12}/> Valid</span>}
                          {keyStatus === 'invalid' && <span className="text-xs text-red-400 font-mono flex items-center gap-1"><AlertCircle size={12}/> Invalid</span>}
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <input 
                         type="password" 
                         value={geminiApiKey} 
                         onChange={(e) => setGeminiApiKey(e.target.value)}
                         placeholder="AIzaSy..."
                         className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 outline-none"
                       />
                       <button 
                         onClick={handleSaveKey}
                         className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                       >
                         {keySaved ? <Check size={14}/> : "Save"}
                       </button>
                    </div>
                    <div className="flex gap-2 mt-2 justify-end">
                        <button onClick={handleTestKey} disabled={keyStatus === 'testing'} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                           {keyStatus === 'testing' ? <Loader2 size={10} className="animate-spin"/> : <Zap size={10}/>} Test Connection
                        </button>
                        <button onClick={handleClearKey} className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1">
                           <Trash2 size={10}/> Reset to Shared
                        </button>
                    </div>
                    {keyStatusMsg && <p className={`text-[10px] mt-2 ${keyStatus === 'valid' ? 'text-emerald-500' : 'text-red-400'}`}>{keyStatusMsg}</p>}
                    
                    <div className="mt-3 pt-3 border-t border-slate-800 flex gap-4">
                        <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 transition-colors">
                           <CreditCard size={12} /> Enable Billing
                        </a>
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 transition-colors">
                           <ExternalLink size={12} /> Check Key Project
                        </a>
                    </div>
                 </div>

                 <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">App Origin (Required in Google Console)</p>
                    <div className="flex items-center gap-2 bg-slate-950 p-3 rounded border border-slate-800">
                       <code className="text-xs font-mono text-emerald-400 flex-1 break-all">{currentOrigin}</code>
                       <button onClick={() => {navigator.clipboard.writeText(currentOrigin); setCopied(true); setTimeout(() => setCopied(false), 2000)}} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                          {copied ? <Check size={14}/> : <Copy size={14}/>}
                       </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Add this URL to 'Authorized JavaScript origins' in Cloud Console.</p>
                 </div>

                 <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Browser Checklist</p>
                    <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                       <li>Disable "Brave Shields" (if using Brave)</li>
                       <li>Disable AdBlockers for this tab</li>
                       <li>Ensure you are NOT in Incognito mode</li>
                    </ul>
                 </div>
              </div>
              
              <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                 <button onClick={() => setShowDebugModal(false)} className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">Close</button>
              </div>
           </div>
        </div>
      )}
      
       {/* DEPLOY GUIDE MODAL */}
       {showDeployModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 flex items-center justify-between sticky top-0">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Rocket className="text-indigo-400" size={18} /> Deploy to Production
              </h3>
              <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 text-slate-300">
               <p className="text-sm text-slate-400">Deploy using Vercel.</p>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3 sticky bottom-0">
              <button 
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
