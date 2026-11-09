import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, RotateCcw, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { Message } from '../types';
import { CodeBlock } from './CodeBlock';
import { TaskProgress } from './TaskProgress';

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  onRetry?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isStreaming,
  onRetry
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isLast = index === messages.length - 1;
        const isCurrentlyStreaming = isLast && isStreaming && !isUser;

        return (
          <div
            key={msg.id || index}
            className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {/* Assistant Avatar */}
            {!isUser && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            {/* Message Body */}
            <div
              className={`relative max-w-3xl rounded-2xl px-5 py-4 text-xs shadow-sm transition ${
                isUser
                  ? 'bg-slate-900 text-white rounded-tr-sm ml-12'
                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-sm mr-12'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-100/30 text-[10px]">
                <span className={`font-semibold ${isUser ? 'text-slate-300' : 'text-slate-500'} flex items-center gap-1.5`}>
                  {isUser ? 'You' : 'MarketMate AI'}
                  {msg.metadata?.agentMode && (
                    <span className="px-1.5 py-0.2 rounded bg-violet-100 text-violet-700 font-bold uppercase tracking-wider text-[8px]">
                      Agent Mode
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {msg.metadata?.model && (
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                      {msg.metadata.model}
                    </span>
                  )}
                  <span className={`${isUser ? 'text-slate-400' : 'text-slate-400'}`}>
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>

              {/* Agent Orchestrator Progress Plan */}
              {!isUser && (msg.metadata?.plan || msg.metadata?.toolCalls) && (
                <TaskProgress
                  plan={msg.metadata.plan}
                  toolCalls={msg.metadata.toolCalls}
                  isStreaming={isCurrentlyStreaming}
                />
              )}

              {/* Message Content */}
              {isUser ? (
                <div className="whitespace-pre-wrap leading-relaxed text-slate-100 font-sans">
                  {msg.content}
                </div>
              ) : (
                <div className="prose prose-xs max-w-none text-slate-800 leading-relaxed font-sans">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        if (!inline && (match || codeString.includes('\n'))) {
                          return (
                            <CodeBlock
                              language={match ? match[1] : 'text'}
                              value={codeString}
                            />
                          );
                        }
                        return (
                          <code className="px-1.5 py-0.5 rounded bg-slate-100 text-violet-700 font-mono text-[11px]" {...props}>
                            {children}
                          </code>
                        );
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto my-3 rounded-lg border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                              {children}
                            </table>
                          </div>
                        );
                      },
                      th({ children }) {
                        return (
                          <th className="px-3 py-2 bg-slate-50 text-left font-semibold text-slate-700 text-[11px]">
                            {children}
                          </th>
                        );
                      },
                      td({ children }) {
                        return (
                          <td className="px-3 py-2 border-t border-slate-100 text-slate-600 text-[11px]">
                            {children}
                          </td>
                        );
                      },
                      p({ children }) {
                        return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
                      },
                      ul({ children }) {
                        return <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>;
                      },
                      li({ children }) {
                        return <li className="leading-relaxed">{children}</li>;
                      },
                      h1({ children }) {
                        return <h1 className="text-base font-bold text-slate-900 mt-4 mb-2">{children}</h1>;
                      },
                      h2({ children }) {
                        return <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1.5">{children}</h2>;
                      },
                      h3({ children }) {
                        return <h3 className="text-xs font-bold text-slate-800 mt-2.5 mb-1">{children}</h3>;
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Streaming indicator */}
                  {isCurrentlyStreaming && (
                    <span className="inline-block w-2 h-4 bg-violet-600 ml-1 animate-pulse align-middle" />
                  )}
                </div>
              )}

              {/* Error Alert & Retry Button */}
              {msg.status === 'error' && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{msg.metadata?.error || 'Generation encountered an error.'}</span>
                  </div>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 text-[11px] shrink-0 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              {/* Actions Footer for Assistant messages */}
              {!isUser && !isCurrentlyStreaming && msg.status !== 'error' && (
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Response</span>
                      </>
                    )}
                  </button>

                  <span className="text-[10px] text-slate-400">MarketMate AI Verified</span>
                </div>
              )}
            </div>

            {/* User Avatar */}
            {isUser && (
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
