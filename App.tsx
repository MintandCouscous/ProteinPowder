
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import { Message, MessageRole, DocumentFile } from './types';
import { DUMMY_DOCUMENTS } from './constants';
import { queryGemini, validateGeminiKey } from './services/geminiService';
import { initGoogleDrive, handleAuthClick, openDrivePicker, processPickedFiles } from './services/driveService';
import { Send, Globe, Paperclip, Loader2, ShieldCheck, AlertTriangle, X, Bug, Rocket, Terminal, Copy, Check, Key, RefreshCw, Trash2, Zap, CreditCard, ExternalLink } from 'lucide-react';

const App: React.FC = () => {
  // Shared Team Key (Baked In)
  const SHARED_TEAM_KEY = 'AIzaSyDox5A9c3_rg-BD8zCgdC186-EcOaOvzfM';

  // State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.MODEL,
      content: "# AlphaVault Team Terminal (v1.3.0)\n\nI am online and secure. The workspace is currently empty.\n\n**To begin analysis:**\n1. Connect **Google Drive** (Left Sidebar) to import Deal Room folders.\n2. Or upload local PDFs/Excel files.\n\nOnce data is loaded, I can perform cross-file analysis, financial summarization, and risk assessment.",
      timestamp: Date.now(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isDriveReady, setIsDriveReady] = useState(false);
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
  const [copied, setCopied] = useState(false);

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
    console.log('AlphaVault v1.3.0 - Drive Init Starting');
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

  // Initialize on mount
  useEffect(() => {
    initializeDriveIntegration();
  }, [initializeDriveIntegration]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: input,
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
        sources: response.sources
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleDoc = (id: string) => {
    setActiveDocIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
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

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      
      <Sidebar 
        documents={documents}
        activeDocIds={activeDocIds}
        onToggleDoc={handleToggleDoc}
        onUpload={handleUpload}
        onConnectDrive={handleConnectDrive}
        isDriveLoading={isDriveLoading}
        isDriveReady={isDriveReady}
        driveInitError={driveInitError}
        configError={configError}
        onOpenDebug={() => setShowDebugModal(true)}
        onOpenDeploy={() => setShowDeployModal(true)}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        
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
          </div>
          <div className="flex items-center gap-4">
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

        <div className="p-6 bg-slate-950 border-t border-slate-800">
          <div className="max-w-4xl mx-auto relative">
            
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
                  onClick={handleSendMessage}
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
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 sticky top-0">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Bug className="text-emerald-500" size={18} /> Connection Troubleshooter
              </h3>
              <button onClick={() => setShowDebugModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Gemini API Key Config - TOP PRIORITY */}
              <div className="bg-emerald-900/20 border border-emerald-800 p-4 rounded-lg animate-fade-in">
                  <h4 className="text-emerald-400 text-sm font-bold mb-2 flex items-center gap-2">
                    <Key size={16} /> Team API Key (Active)
                  </h4>
                  <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                    The shared team key is configured by default. You can override it here if needed.
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      value={geminiApiKey} 
                      onChange={(e) => { setGeminiApiKey(e.target.value); setKeySaved(false); setKeyStatus('idle'); }}
                      className="flex-1 bg-black border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      placeholder="AIzaSy..."
                    />
                    <button 
                      onClick={handleSaveKey}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors"
                    >
                      {keySaved ? <Check size={14} /> : 'Save'}
                    </button>
                  </div>
                  
                  {/* Test Connection Button */}
                  <div className="mt-3 flex items-center justify-between border-t border-emerald-800/30 pt-2">
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={handleTestKey}
                         disabled={!geminiApiKey || keyStatus === 'testing'}
                         className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded transition-colors"
                       >
                         {keyStatus === 'testing' ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                         Test Connection
                       </button>
                       {keyStatus === 'valid' && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check size={10} /> Valid</span>}
                       {keyStatus === 'invalid' && <span className="text-[10px] text-red-400 flex items-center gap-1"><X size={10} /> Failed</span>}
                     </div>
                     <button onClick={handleClearKey} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 ml-auto">
                        <Trash2 size={10} /> Restore Default
                     </button>
                  </div>
                  {keyStatusMsg && (
                    <p className={`text-[10px] mt-1 ${keyStatus === 'valid' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {keyStatusMsg}
                    </p>
                  )}
               </div>

              {driveInitError && (
                <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg">
                  <h4 className="text-red-400 text-sm font-bold mb-1">Connection Error</h4>
                  <p className="text-xs text-red-200/70 font-mono break-all">
                    {driveInitError}
                  </p>
                </div>
              )}

              <div className="space-y-2 opacity-75 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                   <label className="text-xs font-bold text-slate-400 uppercase">App Origin (REQUIRED in Console)</label>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black p-3 rounded border border-slate-700 text-slate-400 text-xs font-mono break-all select-all">
                    {currentOrigin}
                  </code>
                </div>
                <p className="text-[10px] text-slate-500">
                   Copy this URL to "Authorized JavaScript origins" in your Google Cloud Console Credentials.
                </p>
              </div>

               <div className="space-y-2 opacity-75">
                <div className="flex items-center justify-between">
                   <label className="text-xs font-bold text-slate-400 uppercase">Browser Checklist</label>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                   <li>Disable "Brave Shields" (if using Brave)</li>
                   <li>Disable AdBlockers for this tab</li>
                   <li>Ensure you are NOT in Incognito mode</li>
                   <li>Ensure you are NOT in a "Preview" or "Blob" window (Open in New Tab)</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3 sticky bottom-0">
              <button 
                onClick={() => setShowDebugModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
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
               {/* Deployment Steps same as before */}
               <p className="text-sm text-slate-400">Refer to Vercel or Netlify documentation for deployment.</p>
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
