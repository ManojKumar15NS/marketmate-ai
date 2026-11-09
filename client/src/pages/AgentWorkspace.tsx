import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  MessageSquare,
  Bot,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Conversation, ConversationSummary, Message, SystemSettings } from '../types';
import { ChatWindow } from '../components/ChatWindow';
import { ChatInput } from '../components/ChatInput';
import { EmptyState } from '../components/EmptyState';

interface AgentWorkspaceProps {
  settings: SystemSettings | null;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ settings }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, isStreaming]);

  const refreshConversations = async () => {
    try {
      const list = await api.getConversations();
      setConversations(list);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    const idParam = searchParams.get('id');
    const promptParam = searchParams.get('prompt');
    const newParam = searchParams.get('new');

    if (newParam) {
      startNewChat();
      searchParams.delete('new');
      setSearchParams(searchParams);
      return;
    }

    if (idParam && idParam !== activeConversation?.id) {
      loadConversation(idParam);
    }

    if (promptParam && !isStreaming) {
      handleSendMessage(promptParam, settings?.activeModel || 'gemini-2.5-flash', true);
      searchParams.delete('prompt');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  const loadConversation = async (id: string) => {
    try {
      const conv = await api.getConversation(id);
      setActiveConversation(conv);
      setErrorBanner(null);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to load conversation');
    }
  };

  const startNewChat = () => {
    setActiveConversation(null);
    setErrorBanner(null);
    searchParams.delete('id');
    setSearchParams(searchParams);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await api.deleteConversation(id);
      await refreshConversations();
      if (activeConversation?.id === id) {
        startNewChat();
      }
    } catch (err: any) {
      setErrorBanner('Failed to delete conversation: ' + err.message);
    }
  };

  const handleSendMessage = async (userText: string, model: string, isAgentMode: boolean) => {
    if (!userText.trim() || isStreaming) return;
    setErrorBanner(null);

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
      status: 'complete'
    };

    const assistantMsgPlaceholder: Message = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      status: 'streaming',
      metadata: {
        model,
        agentMode: isAgentMode ? 'agent' : 'chat',
        plan: [],
        toolCalls: []
      }
    };

    const currentMessages = activeConversation?.messages || [];
    const updatedMessages = [...currentMessages, userMsg, assistantMsgPlaceholder];

    if (activeConversation) {
      setActiveConversation({
        ...activeConversation,
        messages: updatedMessages
      });
    } else {
      setActiveConversation({
        id: '',
        title: userText.substring(0, 35) + '...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: updatedMessages
      });
    }

    setIsStreaming(true);

    if (isAgentMode) {
      // Execute multi-tool autonomous agent workflow
      try {
        await api.executeAgentWorkflow(
          {
            instruction: userText,
            conversationId: activeConversation?.id || undefined,
            model
          },
          {
            onStart: (meta) => {
              if (!activeConversation?.id && meta.conversationId) {
                setSearchParams({ id: meta.conversationId });
              }
            },
            onPlan: (planData) => {
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  last.metadata = {
                    ...last.metadata,
                    plan: planData.plan
                  };
                }
                return { ...prev, messages: msgs };
              });
            },
            onToolCall: (callData) => {
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  const existingTools = last.metadata?.toolCalls || [];
                  last.metadata = {
                    ...last.metadata,
                    toolCalls: [...existingTools, { tool: callData.tool, args: callData.args }]
                  };
                }
                return { ...prev, messages: msgs };
              });
            },
            onToolResult: (resultData) => {
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant' && last.metadata?.toolCalls) {
                  const tools = [...last.metadata.toolCalls];
                  const idx = tools.findIndex(t => t.tool === resultData.tool && t.success === undefined);
                  if (idx >= 0) {
                    tools[idx] = { ...tools[idx], success: resultData.success, result: resultData.result };
                  }
                  last.metadata.toolCalls = tools;
                }
                return { ...prev, messages: msgs };
              });
            },
            onComplete: (doneData) => {
              setIsStreaming(false);
              refreshConversations();
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  last.content = doneData.result;
                  last.status = 'complete';
                }
                return { ...prev, messages: msgs };
              });
            },
            onError: (errMsg) => {
              setIsStreaming(false);
              setErrorBanner(errMsg);
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  last.status = 'error';
                  last.metadata = { ...last.metadata, error: errMsg };
                }
                return { ...prev, messages: msgs };
              });
            }
          }
        );
      } catch (err: any) {
        setIsStreaming(false);
        setErrorBanner(err.message || 'Agent workflow failed');
      }
    } else {
      // Standard streaming conversational chat
      try {
        await api.streamChatMessage(
          {
            conversationId: activeConversation?.id || undefined,
            message: userText,
            model
          },
          {
            onStart: (meta) => {
              if (!activeConversation?.id) {
                setSearchParams({ id: meta.conversationId });
              }
            },
            onChunk: (chunk) => {
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  last.content += chunk;
                }
                return { ...prev, messages: msgs };
              });
            },
            onComplete: (doneData) => {
              setIsStreaming(false);
              refreshConversations();
              setActiveConversation((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  last.status = 'complete';
                }
                return { ...prev, id: doneData.conversationId, messages: msgs };
              });
            },
            onError: (errMsg) => {
              setIsStreaming(false);
              setErrorBanner(errMsg);
            }
          }
        );
      } catch (err: any) {
        setIsStreaming(false);
        setErrorBanner(err.message || 'Stream connection failed');
      }
    }
  };

  const handleRetry = async () => {
    if (!activeConversation?.id) return;
    setIsStreaming(true);
    setErrorBanner(null);

    try {
      const res = await api.retryLastMessage(
        activeConversation.id,
        settings?.activeModel || 'gemini-2.5-flash'
      );
      setActiveConversation((prev) => {
        if (!prev) return null;
        const filtered = prev.messages.filter(m => m.status !== 'error');
        return {
          ...prev,
          messages: [...filtered, res.message]
        };
      });
    } catch (err: any) {
      setErrorBanner('Retry failed: ' + err.message);
    } finally {
      setIsStreaming(false);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Collapsible History Drawer */}
      <div
        className={`${
          isDrawerOpen ? 'w-72' : 'w-0'
        } transition-all duration-300 ease-in-out border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden select-none`}
      >
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-600" />
            <h3 className="text-xs font-bold text-slate-800">History</h3>
            <span className="text-[10px] text-slate-400 font-mono">({conversations.length})</span>
          </div>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-2.5 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              {searchQuery ? 'No matching chats' : 'No chat history'}
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = activeConversation?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSearchParams({ id: c.id });
                    loadConversation(c.id);
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                    isActive
                      ? 'bg-violet-50 text-violet-900 font-medium'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="truncate font-semibold text-[11px]">{c.title}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {c.messageCount} msgs • {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Stage */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
        {/* Workspace Sub-header */}
        <div className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition"
              title={isDrawerOpen ? 'Collapse history' : 'Expand history'}
            >
              {isDrawerOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
            <div className="h-4 w-[1px] bg-slate-200" />
            <h3 className="text-xs font-semibold text-slate-800 truncate max-w-sm">
              {activeConversation?.title || 'New AI Marketing Task'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {settings?.activeModel || 'gemini-2.5-flash'}
            </span>
          </div>
        </div>

        {/* Global Error Notice */}
        {errorBanner && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-red-500 hover:text-red-800 font-bold ml-2 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <EmptyState
                onSelectPrompt={(prompt) =>
                  handleSendMessage(prompt, settings?.activeModel || 'gemini-2.5-flash', true)
                }
              />
            ) : (
              <ChatWindow
                messages={activeConversation.messages}
                isStreaming={isStreaming}
                onRetry={handleRetry}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Prompt Input Dock */}
        <div className="p-4 bg-white/90 backdrop-blur-sm border-t border-slate-200 shrink-0">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isStreaming}
              disabled={!settings?.configured}
              activeModel={settings?.activeModel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
