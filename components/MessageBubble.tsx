import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, MessageRole } from '../types';
import { Bot, User, Link2, FileText, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from 'recharts';

interface MessageBubbleProps {
  message: Message;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
        <p className="text-slate-200 font-bold text-xs mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-[10px]" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-8 animate-fade-in`}>
      <div className={`flex max-w-3xl gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} w-full`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
          isUser ? 'bg-slate-700 text-white' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Content */}
        <div className={`flex flex-col min-w-0 w-full ${isUser ? 'items-end' : 'items-start'}`}>
          
          <div className={`rounded-2xl px-6 py-4 shadow-sm w-full ${
            isUser 
              ? 'bg-slate-800 text-white border border-slate-700 rounded-tr-none max-w-fit' 
              : 'bg-slate-900/50 text-slate-200 border border-slate-800 rounded-tl-none'
          }`}>
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed text-slate-300">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-4 mb-2 pb-2 border-b border-slate-700" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-emerald-400 mt-4 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-md font-medium text-emerald-300 mt-3 mb-1" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 space-y-1 my-2" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 space-y-1 my-2" {...props} />,
                      strong: ({node, ...props}) => <strong className="text-white font-semibold" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-emerald-500/50 pl-4 italic text-slate-400 my-2" {...props} />,
                      code: ({node, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                          <code className="block bg-slate-950 p-3 rounded-md font-mono text-xs my-2 overflow-x-auto" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs text-emerald-300" {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>

                {/* VISUALIZATION CHART RENDERER */}
                {message.chartData && (
                  <div className="mt-6 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <BarChart2 size={14} className="text-emerald-500" />
                      {message.chartData.title}
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {message.chartData.type === 'line' ? (
                           <LineChart data={message.chartData.data}>
                             <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                             <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                             <YAxis stroke="#94a3b8" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                             <Tooltip content={<CustomTooltip />} cursor={{fill: '#1e293b', opacity: 0.5}} />
                             <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                             {message.chartData.dataKeys.map((key, idx) => (
                               <Line 
                                 key={key} 
                                 type="monotone" 
                                 dataKey={key} 
                                 stroke={idx === 0 ? '#10b981' : '#6366f1'} 
                                 strokeWidth={2}
                                 dot={{r: 4, fill: '#0f172a', strokeWidth: 2}} 
                               />
                             ))}
                           </LineChart>
                        ) : (
                          <BarChart data={message.chartData.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <YAxis stroke="#94a3b8" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#1e293b', opacity: 0.5}} />
                            <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            {message.chartData.dataKeys.map((key, idx) => (
                              <Bar 
                                key={key} 
                                dataKey={key} 
                                fill={idx === 0 ? '#10b981' : '#6366f1'} 
                                radius={[4, 4, 0, 0]} 
                                maxBarSize={60}
                              />
                            ))}
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sources / Footer Info */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.sources.map((source, idx) => (
                <a 
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-emerald-400 transition-colors group"
                >
                  <Link2 size={12} className="group-hover:text-emerald-300" />
                  <span className="truncate max-w-[150px]">{source.title}</span>
                </a>
              ))}
            </div>
          )}
          
          <div className="mt-2 text-[10px] text-slate-600 font-medium uppercase tracking-wider px-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default MessageBubble;