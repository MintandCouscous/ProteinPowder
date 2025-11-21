import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import { Message, MessageRole, DocumentFile } from './types';
import { DUMMY_DOCUMENTS } from './constants';
import { queryGemini } from './services/geminiService';
import { initGoogleDrive, handleAuthClick, openDrivePicker, processPickedFiles } from './services/driveService';
import { Send, Globe, Paperclip, Loader2, ShieldCheck, AlertTriangle, X, Bug, Rocket, Terminal, Copy, Check } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.MODEL,
      content: "# AlphaVault Terminal Ready\n\nI am connected to your secure context. I can analyze local files or connect to your **Google Drive** for live document retrieval.\n\nYou can ask me to:\n- Analyze the Q3 Tech Outlook\n- Summarize the Project Titan acquisition memo\n- Identify market risks for renewable energy\n\nHow can I assist with your deal flow today?",
      timestamp: Date.now(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isDriveReady, setIsDriveReady] = useState(false);
  const [driveInitError, setDriveInitError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentFile[]>(DUMMY_DOCUMENTS);
  const [activeDocIds, setActiveDocIds] = useState<string[]>(DUMMY_DOCUMENTS.map(d => d.id));
  const [useWebSearch, setUseWebSearch] = useState(false);
  
  // Modal States
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dedicated Picker Key provided by user
  const PICKER_API_KEY = 'AIzaSyCJV-78HN3nii-jfub-vVTNr5ULEK6hkbY';

  // Reusable Initialization Logic
  const initializeDriveIntegration = useCallback(() => {
    console.log('AlphaVault v1.0.1 - Drive Init Starting');
    // STRICT REAL MODE: We do NOT check for sandbox/blob. We try to load the API no matter what.
    const geminiKey = process.env.API_KEY || '';
    const clientId = process.env.GOOGLE_CLIENT_ID || '803370988138-jocn4veeamir0p635eeq14lsd4117hag.apps.googleusercontent.com';
    
    // We use the PICKER_API_KEY for the Google Client init to ensure the Picker loads correctly
    // regardless of what the Gemini key is configured for.
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
          // We log the error but allow retry
          setDriveInitError(errorMsg);
          setIsDriveReady(true); 
        }
      );
    } else {
      const missing = [];
      if (!geminiKey) missing.push("API_KEY (for AI)");
      if (!clientId) missing.push("GOOGLE_CLIENT_ID");
      
      const errorMsg = `Missing Config: ${missing.join(', ')}`;
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
    // 1. Config Help Logic
    if (configError) {
      setShowDebugModal(true);
      return;
    }

    // 2. Connect Logic
    setIsDriveLoading(true);
    
    try {
      // Attempt Real Auth
      const token = await handleAuthClick();

      // IMPORTANT: Pass the dedicated PICKER_API_KEY here
      openDrivePicker(PICKER_API_KEY, token, async (pickedFiles) => {
        setIsDriveLoading(true);
        try {
           setMessages(prev => [...prev, {
             id: Date.now().toString(),
             role: MessageRole.MODEL,
             content: `*Downloading and encrypting ${pickedFiles.length} documents (including folder contents) from Secure Drive...*`,
             timestamp: Date.now()
           }]);

           // Pass token explicitly to ensure it's available for folder listing
           const newDocs = await processPickedFiles(pickedFiles, token);
           setDocuments(prev => [...prev, ...newDocs]);
           setActiveDocIds(prev => [...prev, ...newDocs.map(d => d.id)]);
           
           setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: MessageRole.MODEL,
            content: `**Successfully indexed:**\n${newDocs.map(d => `- ${d.name}`).join('\n')}\n\nYou may now query these documents.`,
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
      setShowDebugModal(true); // Show debug modal so user can see the error
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
    const envText = `API_KEY=${process.env.API_KEY || ''}\nGOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || '803370988138-jocn4veeamir0p635eeq14lsd4117hag.apps.googleusercontent.com'}`;
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
              <div className={`w-2 h-2 rounded-full ${activeDocIds.length > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
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
                placeholder="Query your knowledge base (e.g., 'What are the risks in the Titan acquisition?')"
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
                AI-generated content may contain errors. Verify critical financial data against source documents.
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
              {driveInitError && (
                <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg">
                  <h4 className="text-red-400 text-sm font-bold mb-1">Connection Error</h4>
                  <p className="text-xs text-red-200/70 font-mono break-all">
                    {driveInitError}
                  </p>
                </div>
              )}

              <div className="space-y-2 opacity-75">
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
              
              <div className="bg-emerald-900/10 border border-emerald-800/30 p-4 rounded-lg">
                <h4 className="text-emerald-400 text-sm font-bold mb-1">API Config</h4>
                <p className="text-xs text-emerald-200/70">
                  Google Picker Key: <span className="font-mono bg-black/30 px-1 rounded">{PICKER_API_KEY ? 'Configured' : 'Missing'}</span>
                </p>
                {driveInitError?.includes('developer key') && (
                   <a 
                     href="https://console.cloud.google.com/apis/library/picker.googleapis.com" 
                     target="_blank"
                     rel="noopener noreferrer"
                     className="block mt-2 text-[10px] text-emerald-400 hover:underline"
                   >
                     → Click here to Enable Google Picker API
                   </a>
                )}
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
              <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-lg">
                <p className="text-sm text-indigo-200">
                  <strong>Why deploy?</strong> Google Drive security blocks "Preview" and "Blob" environments. 
                  Deploying to Vercel or Netlify gives you a real HTTPS URL (e.g. <code>myapp.vercel.app</code>) that works perfectly with Google Auth.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">1. Push Code to GitHub</h4>
                <p className="text-xs text-slate-400">Create a new repository and push this code. If using an online editor, look for the "Source Control" tab.</p>
                
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mt-6">2. Import to Vercel / Netlify</h4>
                <p className="text-xs text-slate-400">Connect your GitHub repo to Vercel. It will auto-detect the build settings (Vite/React).</p>
                
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mt-6">3. Add Environment Variables</h4>
                <p className="text-xs text-slate-400">In the Vercel Project Settings &gt; Environment Variables, add these keys:</p>
                
                <div className="bg-black rounded-lg border border-slate-800 p-4 relative group">
                  <button 
                    onClick={copyEnvVars}
                    className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="Copy All"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                  <pre className="font-mono text-xs text-emerald-400 overflow-x-auto">
{`API_KEY=${process.env.API_KEY || '...'}
GOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || '803370988138-jocn4veeamir0p635eeq14lsd4117hag.apps.googleusercontent.com'}`}
                  </pre>
                </div>

                 <h4 className="text-sm font-bold text-white uppercase tracking-wider mt-6">4. Final Step: Update Google Console</h4>
                 <p className="text-xs text-slate-400">
                   Once deployed, copy your new URL (e.g. <code>https://alphavault.vercel.app</code>) and add it to 
                   "Authorized JavaScript origins" in your Google Cloud Credentials.
                 </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3 sticky bottom-0">
              <button 
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;