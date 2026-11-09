import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Wrench, Sparkles, Loader2, Bot, Check, Upload } from 'lucide-react';
import { api } from '../services/api';

interface ChatInputProps {
  onSendMessage: (message: string, model: string, isAgentMode: boolean) => void;
  isLoading: boolean;
  disabled?: boolean;
  activeModel?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  disabled = false,
  activeModel = 'gemini-2.5-flash'
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(activeModel);
  const [isAgentMode, setIsAgentMode] = useState(true); // Default to intelligent agent mode
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeModel) setSelectedModel(activeModel);
  }, [activeModel]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;

    let finalPrompt = input.trim();
    if (attachedFile) {
      finalPrompt = `[Attached Document Context: ${attachedFile}]\n\n${finalPrompt}`;
    }

    onSendMessage(finalPrompt, selectedModel, isAgentMode);
    setInput('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const doc = await api.uploadDocument(file);
      setAttachedFile(doc.filename);
      setInput((prev) => prev ? `${prev}\n[Referencing uploaded file: ${doc.filename}]` : `Please analyze the uploaded document: ${doc.filename}`);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 transition p-3">
      {/* Attached file tag */}
      {attachedFile && (
        <div className="mb-2 flex items-center justify-between px-2.5 py-1 rounded bg-violet-50 border border-violet-200 text-xs text-violet-800">
          <span className="flex items-center gap-1.5 font-medium truncate">
            <Paperclip className="w-3.5 h-3.5 text-violet-600" />
            {attachedFile}
          </span>
          <button
            onClick={() => setAttachedFile(null)}
            className="text-violet-500 hover:text-violet-800 text-[11px] font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled
            ? "Please configure your Gemini API key in Settings first..."
            : isAgentMode
            ? "Give MarketMate AI an autonomous task (e.g. Research cloud migration companies in India, audit website SEO, or draft an email sequence)..."
            : "Ask a direct marketing question... (Shift+Enter for newline)"
        }
        disabled={disabled || isLoading}
        rows={1}
        className="w-full resize-none border-0 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 leading-relaxed max-h-44 disabled:opacity-50"
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
        <div className="flex items-center gap-2">
          {/* File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || disabled || isUploading}
            title="Attach PDF, DOCX, CSV, XLSX, or TXT document"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
            ) : (
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline">Attach File</span>
          </button>

          {/* Autonomous Agent Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsAgentMode(!isAgentMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
              isAgentMode
                ? 'bg-violet-100 text-violet-800 border-violet-300'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Toggle between autonomous multi-tool agent and standard conversational chat"
          >
            <Bot className={`w-3.5 h-3.5 ${isAgentMode ? 'text-violet-600' : 'text-slate-400'}`} />
            <span>Agent Mode</span>
            {isAgentMode && <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />}
          </button>

          {/* Model Selector */}
          <div className="flex items-center gap-1 pl-1">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading || disabled}
              className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/80 rounded-md px-2 py-1 focus:outline-none focus:border-violet-400 disabled:opacity-50 cursor-pointer"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!input.trim() || isLoading || disabled}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
            !input.trim() || isLoading || disabled
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{isAgentMode ? 'Orchestrating...' : 'Thinking...'}</span>
            </>
          ) : (
            <>
              <span>Execute</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
