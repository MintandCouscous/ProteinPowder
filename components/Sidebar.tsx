
import React from 'react';
import { 
  HardDrive, 
  FileText, 
  Plus, 
  CheckCircle2, 
  PieChart, 
  Settings,
  Loader2,
  AlertTriangle,
  HelpCircle,
  Rocket,
  RefreshCw,
  ArrowUp,
  Download,
  XCircle,
  BrainCircuit
} from 'lucide-react';
import { DocumentFile } from '../types';

interface SidebarProps {
  documents: DocumentFile[];
  activeDocIds: string[];
  onToggleDoc: (id: string) => void;
  onDeselectAll: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConnectDrive: () => void;
  onSynthesize: () => void;
  isDriveLoading: boolean;
  isDriveReady: boolean;
  isSynthesizing: boolean;
  driveInitError?: string | null;
  configError?: string | null;
  onOpenDebug: () => void;
  onOpenDeploy: () => void;
  canInstallApp?: boolean;
  onInstallApp?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  documents, 
  activeDocIds, 
  onToggleDoc, 
  onDeselectAll,
  onUpload, 
  onConnectDrive,
  onSynthesize,
  isDriveLoading,
  isDriveReady,
  isSynthesizing,
  driveInitError,
  configError,
  onOpenDebug,
  onOpenDeploy,
  canInstallApp,
  onInstallApp
}) => {
  const categories = {
    financial: documents.filter(d => d.category === 'financial'),
    memo: documents.filter(d => d.category === 'memo'),
    market: documents.filter(d => d.category === 'market'),
  };

  // Determine button styles based on state
  let buttonClass = "bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-900/20 text-white cursor-pointer";
  let buttonIcon = <HardDrive size={18} />;
  let buttonText = "Connect Google Drive";
  let isDisabled = false;

  if (isDriveLoading) {
    buttonClass = "bg-slate-800 opacity-70 cursor-wait text-slate-400";
    buttonIcon = <Loader2 size={18} className="animate-spin" />;
    buttonText = "Connecting...";
    isDisabled = true;
  } else if (driveInitError) {
    buttonClass = "bg-red-900/80 border border-red-700 text-red-200 hover:bg-red-800 cursor-pointer";
    buttonIcon = <RefreshCw size={18} />;
    buttonText = "Retry Connection";
    isDisabled = false; 
  } else if (configError) {
    buttonClass = "bg-amber-900/80 border border-amber-700 text-amber-200 hover:bg-amber-800 cursor-pointer";
    buttonIcon = <AlertTriangle size={18} />;
    buttonText = "Setup Required";
    isDisabled = false; 
  } else if (!isDriveReady) {
    buttonClass = "bg-slate-800 opacity-70 cursor-wait text-slate-400";
    buttonIcon = <Loader2 size={18} className="animate-spin" />;
    buttonText = "Initializing...";
    isDisabled = true;
  }

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 text-slate-300 font-sans">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-900/20">
          AV
        </div>
        <span className="text-lg font-semibold text-white tracking-tight">AlphaVault <span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/30 px-1 rounded ml-1">TEAM</span></span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        
        {/* ACTIONS SECTION */}
        <div className="space-y-3 mb-8">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">Integrations</h3>
          
          {/* Primary Action: Connect Drive + Help */}
          <div className="flex gap-2">
            <button 
              onClick={onConnectDrive}
              disabled={isDisabled}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all active:scale-95 ${buttonClass}`}
              title={driveInitError || configError || "Connect to Google Drive"}
            >
              {buttonIcon}
              <span className="truncate">{buttonText}</span>
            </button>
            
            {/* Help/Debug Button */}
            <button
              onClick={onOpenDebug}
              className="flex items-center justify-center px-3 bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 rounded-lg transition-colors"
              title="Connection Troubleshooting & Config"
            >
              <HelpCircle size={18} />
            </button>
          </div>

          {/* Synthesize / Compress Context */}
          {activeDocIds.length > 3 && (
            <button 
              onClick={onSynthesize}
              disabled={isSynthesizing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 rounded-lg transition-all text-xs font-medium"
              title="Compress selected documents into one summary to save tokens"
            >
              {isSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
              <span>{isSynthesizing ? "Synthesizing..." : "Synthesize Deal Room"}</span>
            </button>
          )}

          {/* Secondary Action: Local Upload */}
          <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/50 cursor-pointer transition-all group text-slate-400 hover:text-emerald-400">
            <Plus size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Local File Upload</span>
            <input type="file" className="hidden" onChange={onUpload} accept=".txt,.md,.json,.pdf,.png,.jpg" />
          </label>
        </div>

        {/* DATA INVENTORY SECTION */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data Inventory</h3>
            {activeDocIds.length > 0 && (
              <button 
                onClick={onDeselectAll}
                className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                title="Deselect All Files"
              >
                <XCircle size={12} /> Clear
              </button>
            )}
          </div>
          
          {documents.length === 0 ? (
            <div className="p-4 border border-slate-800 bg-slate-800/30 rounded-lg text-center">
               <p className="text-xs text-slate-400 mb-2">No files loaded.</p>
               <div className="flex flex-col items-center gap-1 text-emerald-500/70">
                  <ArrowUp size={14} className="animate-bounce" />
                  <span className="text-[10px]">Connect Drive to begin</span>
               </div>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Category: Memos */}
              {categories.memo.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-500/80 mb-2 px-1 flex items-center gap-1">
                    MEMOS <span className="bg-slate-800 text-slate-400 px-1.5 rounded text-[10px]">{categories.memo.length}</span>
                  </p>
                  <div className="space-y-0.5">
                    {categories.memo.map(doc => (
                      <div 
                        key={doc.id}
                        onClick={() => onToggleDoc(doc.id)}
                        className={`flex items-center gap-2.5 cursor-pointer px-2 py-2 rounded-md text-xs transition-all border ${
                          activeDocIds.includes(doc.id) 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                            : 'hover:bg-slate-800 text-slate-400 border-transparent hover:border-slate-800'
                        }`}
                      >
                        {activeDocIds.includes(doc.id) ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        ) : (
                          <FileText size={14} className="shrink-0 opacity-50" />
                        )}
                        <span className="truncate">{doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Market Research */}
              {categories.market.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-500/80 mb-2 px-1 flex items-center gap-1">
                    RESEARCH <span className="bg-slate-800 text-slate-400 px-1.5 rounded text-[10px]">{categories.market.length}</span>
                  </p>
                  <div className="space-y-0.5">
                    {categories.market.map(doc => (
                      <div 
                        key={doc.id}
                        onClick={() => onToggleDoc(doc.id)}
                        className={`flex items-center gap-2.5 cursor-pointer px-2 py-2 rounded-md text-xs transition-all border ${
                          activeDocIds.includes(doc.id) 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                            : 'hover:bg-slate-800 text-slate-400 border-transparent hover:border-slate-800'
                        }`}
                      >
                        {activeDocIds.includes(doc.id) ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        ) : (
                          <PieChart size={14} className="shrink-0 opacity-50" />
                        )}
                        <span className="truncate">{doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Financial (Default for uploads) */}
              {categories.financial.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-500/80 mb-2 px-1 flex items-center gap-1">
                    FILES <span className="bg-slate-800 text-slate-400 px-1.5 rounded text-[10px]">{categories.financial.length}</span>
                  </p>
                  <div className="space-y-0.5">
                    {categories.financial.map(doc => (
                      <div 
                        key={doc.id}
                        onClick={() => onToggleDoc(doc.id)}
                        className={`flex items-center gap-2.5 cursor-pointer px-2 py-2 rounded-md text-xs transition-all border ${
                          activeDocIds.includes(doc.id) 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                            : 'hover:bg-slate-800 text-slate-400 border-transparent hover:border-slate-800'
                        }`}
                      >
                        {activeDocIds.includes(doc.id) ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        ) : (
                          <PieChart size={14} className="shrink-0 opacity-50" />
                        )}
                        <span className="truncate">{doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        {/* Install App Button (Conditional) */}
        {canInstallApp && (
          <button 
            onClick={onInstallApp}
            className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-emerald-900/30 border border-slate-700 hover:border-emerald-500/50 text-emerald-400 text-xs font-bold rounded-lg transition-all"
          >
            <Download size={14} />
            <span>INSTALL APP</span>
          </button>
        )}

        <button 
          onClick={onOpenDeploy}
          className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-md shadow-purple-900/20 transition-all active:scale-95"
        >
          <Rocket size={14} />
          <span>DEPLOY APP</span>
        </button>

        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors group">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
            <span className="text-xs font-bold text-white">TM</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Team User</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Authorized Access</p>
          </div>
          <Settings size={16} className="text-slate-500 group-hover:text-white transition-colors" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
