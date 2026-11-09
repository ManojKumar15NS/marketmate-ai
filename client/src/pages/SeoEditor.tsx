import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FileCode2,
  Sparkles,
  Save,
  Clock,
  Download,
  Upload,
  Globe,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Check,
  Copy,
  Code2,
  ListOrdered,
  List,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
  History
} from 'lucide-react';
import api from '../services/api';
import {
  EditorDocument,
  EditorDocumentVersion,
  SeoAnalysisReport,
  EditorSuggestion,
  GeoSchemasResult
} from '../types';

export const SeoEditor: React.FC = () => {
  const location = useLocation();

  // Document state
  const [documents, setDocuments] = useState<EditorDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // Status & autosave state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Analysis & suggestions state
  const [analysis, setAnalysis] = useState<SeoAnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<EditorSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [undoStack, setUndoStack] = useState<Array<{ field: 'title' | 'meta' | 'content'; prevValue: string }>>([]);

  // GEO & live crawl state
  const [geoResult, setGeoResult] = useState<GeoSchemasResult | null>(null);
  const [isGeneratingGeo, setIsGeneratingGeo] = useState(false);
  const [copiedGeo, setCopiedGeo] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  // Versions modal
  const [versions, setVersions] = useState<EditorDocumentVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Tabs: 'analysis' | 'suggestions' | 'geo' | 'live'
  const [activeTab, setActiveTab] = useState<'analysis' | 'suggestions' | 'geo' | 'live'>('analysis');

  // Textarea ref for format insertion
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = useRef<any>(null);

  // 1. Load documents list on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const res = await api.getEditorDocuments();
      const docs = res.data || [];
      setDocuments(docs);

      // Check if location state passed imported content from Content Creator
      const state = location.state as { title?: string; content?: string; keyword?: string } | null;
      if (state && (state.title || state.content)) {
        await handleCreateDoc(state.title || 'Imported Content', state.content || '', state.keyword || '');
      } else if (docs.length > 0 && !activeDocId) {
        selectDoc(docs[0]);
      } else if (docs.length === 0 && !activeDocId) {
        await handleCreateDoc('My First Article', '# Welcome to SEO Content Editor\n\nWrite your content here to optimize for search engines and readers.');
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  };

  const selectDoc = (doc: EditorDocument) => {
    setActiveDocId(doc.id);
    setTitle(doc.title || '');
    setContent(doc.content || '');
    setTargetKeyword(doc.targetKeyword || '');
    setMetaDescription(doc.metaDescription || '');
    setSaveStatus('saved');
    setLastSavedAt(doc.updatedAt || doc.createdAt);
    runAnalysis(doc.content || '', doc.title || '', doc.targetKeyword || '', doc.metaDescription || '');
  };

  const handleCreateDoc = async (initialTitle = 'Untitled Document', initialContent = '', initialKeyword = '') => {
    try {
      const res = await api.saveEditorDocument({
        title: initialTitle,
        content: initialContent,
        targetKeyword: initialKeyword,
        metaDescription: ''
      });
      const newDoc = res.data;
      if (newDoc) {
        setDocuments(prev => [newDoc, ...prev]);
        selectDoc(newDoc);
      }
    } catch (err) {
      console.error('Failed to create doc', err);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.deleteEditorDocument(id);
      const remaining = documents.filter(d => d.id !== id);
      setDocuments(remaining);
      if (activeDocId === id) {
        if (remaining.length > 0) {
          selectDoc(remaining[0]);
        } else {
          setActiveDocId(null);
          setTitle('');
          setContent('');
          setTargetKeyword('');
          setMetaDescription('');
          setAnalysis(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete doc', err);
    }
  };

  // 2. Debounced analysis and autosave
  const runAnalysis = useCallback(async (c: string, t: string, kw: string, meta: string) => {
    if (!c.trim() && !t.trim()) {
      setAnalysis(null);
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await api.analyzeEditorContent({
        content: c,
        title: t,
        targetKeyword: kw,
        metaDescription: meta
      });
      if (res.data) {
        setAnalysis(res.data);
      }
    } catch (err) {
      console.error('Analysis failed', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const triggerAutosave = (newContent: string, newTitle: string, newKw: string, newMeta: string) => {
    setSaveStatus('unsaved');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      if (!activeDocId) return;
      setIsSaving(true);
      setSaveStatus('saving');
      try {
        const res = await api.updateEditorDocument(activeDocId, {
          title: newTitle,
          content: newContent,
          targetKeyword: newKw,
          metaDescription: newMeta
        });
        const updated = res.data;
        setLastSavedAt(new Date().toLocaleTimeString());
        setSaveStatus('saved');
        if (updated) {
          setDocuments(prev => prev.map(d => d.id === activeDocId ? updated : d));
        }
      } catch (err) {
        console.error('Autosave failed', err);
        setSaveStatus('unsaved');
      } finally {
        setIsSaving(false);
      }
    }, 2000);
  };

  const onEdit = (newContent: string, newTitle: string, newKw: string, newMeta: string) => {
    runAnalysis(newContent, newTitle, newKw, newMeta);
    triggerAutosave(newContent, newTitle, newKw, newMeta);
  };

  // 3. Formatting helpers
  const insertFormat = (before: string, after: string = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = `${before}${selectedText}${after}`;
    const nextContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(nextContent);
    onEdit(nextContent, title, targetKeyword, metaDescription);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  // 4. Save Version & Version History
  const saveVersion = async () => {
    if (!activeDocId) return;
    const summary = window.prompt('Version note (optional):', 'Manual checkpoint');
    if (summary === null) return;
    try {
      setIsSaving(true);
      // Trigger an update which creates a version or updates the record
      await api.updateEditorDocument(activeDocId, {
        title,
        content,
        targetKeyword,
        metaDescription,
        summaryNote: summary || 'Manual checkpoint'
      });
      alert('Version checkpoint saved!');
    } catch (err) {
      console.error('Failed to create version', err);
      alert('Failed to save version.');
    } finally {
      setIsSaving(false);
    }
  };

  const loadVersions = async () => {
    if (!activeDocId) return;
    setIsLoadingVersions(true);
    setShowVersions(true);
    try {
      const res = await api.getEditorDocument(activeDocId);
      if (res.data?.versions) {
        setVersions(res.data.versions);
      }
    } catch (err) {
      console.error('Failed to load versions', err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const restoreVersion = async (versionId: string) => {
    if (!activeDocId) return;
    if (!window.confirm('Restore this version? Unsaved changes in your current view will be replaced.')) return;
    try {
      const res = await api.restoreEditorDocumentVersion(activeDocId, versionId);
      if (res.data) {
        selectDoc(res.data);
      }
      setShowVersions(false);
      alert('Version restored successfully!');
    } catch (err) {
      console.error('Failed to restore version', err);
      alert('Failed to restore version.');
    }
  };

  // 5. Suggestions logic (Gemini grounded)
  const fetchSuggestions = async () => {
    if (!content.trim()) return;
    setIsLoadingSuggestions(true);
    try {
      const res = await api.getEditorSuggestions({
        content,
        title,
        targetKeyword,
        metaDescription
      });
      setSuggestions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch suggestions', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const applySuggestion = (sug: EditorSuggestion) => {
    if (sug.type === 'title') {
      setUndoStack(prev => [{ field: 'title', prevValue: title }, ...prev]);
      setTitle(sug.suggestedValue);
      onEdit(content, sug.suggestedValue, targetKeyword, metaDescription);
    } else if (sug.type === 'meta') {
      setUndoStack(prev => [{ field: 'meta', prevValue: metaDescription }, ...prev]);
      setMetaDescription(sug.suggestedValue);
      onEdit(content, title, targetKeyword, sug.suggestedValue);
    } else {
      setUndoStack(prev => [{ field: 'content', prevValue: content }, ...prev]);
      let nextContent = content;
      if (sug.currentValue && content.includes(sug.currentValue)) {
        nextContent = content.replace(sug.currentValue, sug.suggestedValue);
      } else {
        nextContent = content + '\n\n' + sug.suggestedValue;
      }
      setContent(nextContent);
      onEdit(nextContent, title, targetKeyword, metaDescription);
    }
    setSuggestions(prev => prev.map(s => s.id === sug.id ? { ...s, applied: true } : s));
  };

  const undoSuggestion = () => {
    if (undoStack.length === 0) return;
    const [lastAction, ...rest] = undoStack;
    setUndoStack(rest);
    if (lastAction.field === 'title') {
      setTitle(lastAction.prevValue);
      onEdit(content, lastAction.prevValue, targetKeyword, metaDescription);
    } else if (lastAction.field === 'meta') {
      setMetaDescription(lastAction.prevValue);
      onEdit(content, title, targetKeyword, lastAction.prevValue);
    } else if (lastAction.field === 'content') {
      setContent(lastAction.prevValue);
      onEdit(lastAction.prevValue, title, targetKeyword, metaDescription);
    }
  };

  // 6. GEO Schemas Generation
  const generateGeo = async () => {
    if (!content.trim()) return;
    setIsGeneratingGeo(true);
    try {
      const res = await api.generateGeoSchemas({
        content,
        title,
        targetKeyword
      });
      if (res.data) {
        setGeoResult(res.data);
      }
    } catch (err) {
      console.error('Failed to generate GEO schemas', err);
    } finally {
      setIsGeneratingGeo(false);
    }
  };

  // 7. Live Page Crawler
  const extractLivePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl.trim()) return;
    setIsCrawling(true);
    setCrawlError(null);
    try {
      const res = await api.extractLivePage(crawlUrl);
      const data = res.data;
      if (data) {
        setTitle(data.title || title);
        setMetaDescription(data.metaDescription || metaDescription);
        const importedBody = data.markdownContent || data.bodyText || '';
        setContent(importedBody);
        onEdit(importedBody, data.title || title, targetKeyword, data.metaDescription || metaDescription);
        setActiveTab('analysis');
      }
    } catch (err: any) {
      console.error('Failed to crawl live page', err);
      setCrawlError(err.response?.data?.error || err.message || 'Crawl failed');
    } finally {
      setIsCrawling(false);
    }
  };

  // 8. File import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const docName = file.name.replace(/\.[^/.]+$/, '');
      handleCreateDoc(docName, text, targetKeyword);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-300';
    if (score >= 60) return 'text-blue-700 bg-blue-50 border-blue-300';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-300';
    return 'text-rose-700 bg-rose-50 border-rose-300';
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* Document Sidebar */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">SEO Editor</h2>
              <p className="text-[10px] text-slate-400">Content Optimizer</p>
            </div>
          </div>
          <button
            onClick={() => handleCreateDoc()}
            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs flex items-center gap-1 font-medium transition-colors"
            title="Create New Document"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {documents.map(d => (
            <div
              key={d.id}
              onClick={() => selectDoc(d)}
              className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                activeDocId === d.id
                  ? 'bg-emerald-50/80 text-emerald-900 font-medium border border-emerald-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="truncate flex-1 pr-2">
                <div className="truncate">{d.title || 'Untitled Document'}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{d.wordCount || 0} words</span>
                  {d.seoScore !== undefined && d.seoScore !== null && (
                    <span className="font-semibold text-emerald-600">{d.seoScore}/100</span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDoc(d.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-600 transition-opacity"
                title="Delete Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              No documents yet.
            </div>
          )}
        </div>

        {/* Import file footer */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/50">
          <label className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Import File (.md, .txt)</span>
            <input
              type="file"
              accept=".txt,.md,.markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Editor Center */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Document Header Controls */}
        <div className="p-4 border-b border-slate-200 space-y-2.5 bg-white">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                onEdit(content, e.target.value, targetKeyword, metaDescription);
              }}
              placeholder="Article Title (50-60 chars target)..."
              className="text-lg font-bold text-slate-900 border-none focus:outline-none focus:ring-0 w-full placeholder-slate-300"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {lastSavedAt && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1 mr-2">
                  <Clock className="w-3 h-3" />
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Unsaved' : `Saved ${lastSavedAt}`}
                </span>
              )}
              <button
                onClick={loadVersions}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs flex items-center gap-1 font-medium transition-colors"
                title="View version history"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Versions</span>
              </button>
              <button
                onClick={saveVersion}
                disabled={isSaving || !activeDocId}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs flex items-center gap-1 font-medium transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Checkpoint</span>
              </button>
              {activeDocId && (
                <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <a
                    href={api.getEditorExportUrl(activeDocId, 'docx')}
                    download
                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border-r border-slate-200 flex items-center gap-1"
                    title="Export as DOCX"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    <span>DOCX</span>
                  </a>
                  <a
                    href={api.getEditorExportUrl(activeDocId, 'md')}
                    download
                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border-r border-slate-200 flex items-center gap-1"
                    title="Export as Markdown"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    <span>MD</span>
                  </a>
                  <a
                    href={api.getEditorExportUrl(activeDocId, 'html')}
                    download
                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                    title="Export as HTML"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    <span>HTML</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Target Keyword</span>
                {analysis?.targetKeyword && (
                  <span className="text-[10px] text-slate-400">
                    Density: {analysis.keywordDensityPercent}% ({analysis.keywordCount}x)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={targetKeyword}
                onChange={e => {
                  setTargetKeyword(e.target.value);
                  onEdit(content, title, e.target.value, metaDescription);
                }}
                placeholder="e.g. b2b marketing automation"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Meta Description</span>
                <span className={`text-[10px] font-mono ${
                  metaDescription.length >= 140 && metaDescription.length <= 155
                    ? 'text-emerald-600 font-semibold'
                    : metaDescription.length > 155
                    ? 'text-rose-500'
                    : 'text-slate-400'
                }`}>
                  {metaDescription.length}/140-155
                </span>
              </div>
              <input
                type="text"
                value={metaDescription}
                onChange={e => {
                  setMetaDescription(e.target.value);
                  onEdit(content, title, targetKeyword, e.target.value);
                }}
                placeholder="Enter meta description for search snippets..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="px-4 py-1.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => insertFormat('# ', '\n')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('## ', '\n')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('### ', '\n')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
            <span className="w-px h-3.5 bg-slate-300 mx-1" />
            <button
              onClick={() => insertFormat('**', '**')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('*', '*')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <span className="w-px h-3.5 bg-slate-300 mx-1" />
            <button
              onClick={() => insertFormat('- ')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('1. ')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <span className="w-px h-3.5 bg-slate-300 mx-1" />
            <button
              onClick={() => insertFormat('[Link text](', ')')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Insert Link"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('![Image description](', ')')}
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Insert Image with Alt Text"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {undoStack.length > 0 && (
              <button
                onClick={undoSuggestion}
                className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition-colors"
                title="Undo last applied suggestion"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
            )}
            <span className="text-[10px] text-slate-400">
              {analysis?.wordCount || 0} words &bull; {analysis?.characterCount || 0} chars &bull; {analysis?.readingTimeMinutes || 0}m read
            </span>
          </div>
        </div>

        {/* Writing Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              setContent(e.target.value);
              onEdit(e.target.value, title, targetKeyword, metaDescription);
            }}
            placeholder="Write or paste your article in Markdown format..."
            className="w-full h-full resize-none border-none focus:outline-none focus:ring-0 font-sans text-sm leading-relaxed text-slate-800 placeholder-slate-300"
          />
        </div>
      </div>

      {/* Analysis, Suggestions, GEO & Live Crawl Right Sidebar */}
      <div className="w-96 border-l border-slate-200 bg-white flex flex-col shrink-0 h-full overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
              activeTab === 'analysis'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => {
              setActiveTab('suggestions');
              if (suggestions.length === 0) fetchSuggestions();
            }}
            className={`flex-1 py-2.5 text-center border-b-2 transition-all flex items-center justify-center gap-1 ${
              activeTab === 'suggestions'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Ideas</span>
          </button>
          <button
            onClick={() => setActiveTab('geo')}
            className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
              activeTab === 'geo'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            GEO
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
              activeTab === 'live'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Live Page
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* TAB 1: Real Code-Calculated SEO & Readability Analysis */}
          {activeTab === 'analysis' && (
            <div className="space-y-4">
              {/* Score card */}
              <div className="p-4 rounded-xl border bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    SEO Health Score
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5">
                    {analysis ? `${analysis.overallScore}/100` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Calculated deterministically in code
                  </div>
                </div>
                {analysis && (
                  <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm ${getScoreColor(analysis.overallScore)}`}>
                    {analysis.overallScore >= 80 ? 'Optimized' : analysis.overallScore >= 60 ? 'Fair' : 'Needs Work'}
                  </div>
                )}
              </div>

              {/* Readability & stats */}
              {analysis && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <div className="text-[10px] text-slate-400">Flesch Reading Ease</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{analysis.fleschReadingEase}</div>
                    <div className="text-[10px] text-slate-500">{analysis.readingGradeLevel}</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <div className="text-[10px] text-slate-400">Images with Alt</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">
                      {analysis.images.withAlt}/{analysis.images.total}
                    </div>
                    <div className="text-[10px] text-slate-500">{analysis.images.altCoveragePercent}% coverage</div>
                  </div>
                </div>
              )}

              {/* Keyword Placement Checklist */}
              {analysis && analysis.targetKeyword && (
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="font-bold text-slate-800 text-[11px]">Keyword Placement: "{analysis.targetKeyword}"</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {analysis.keywordInTitle ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>In Title</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {analysis.keywordInH1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>In H1 Heading</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {analysis.keywordInFirstParagraph ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>In 1st Paragraph</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {analysis.keywordInSubheadingsCount > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>In H2/H3 Headings</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transparent scoring breakdown */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 text-[11px]">Scoring Rules Breakdown</div>
                {analysis?.breakdown?.map((item, idx) => (
                  <div
                    key={item.name || idx}
                    className="p-2 rounded-lg border border-slate-200 bg-white flex items-start gap-2"
                  >
                    {item.status === 'good' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : item.status === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-slate-400">+{item.score}/{item.maxScore}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.details}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Repeated Phrases Warning */}
              {analysis && analysis.repeatedPhrases && analysis.repeatedPhrases.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
                  <div className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Repeated Phrases</span>
                  </div>
                  <div className="space-y-1">
                    {analysis.repeatedPhrases.map((rp, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-amber-800">
                        <span className="italic">"{rp.phrase}"</span>
                        <span className="font-mono">{rp.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Grounded AI Suggestions */}
          {activeTab === 'suggestions' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 space-y-2">
                <div className="font-bold text-violet-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>Grounded AI Suggestions</span>
                </div>
                <p className="text-[11px] text-violet-700 leading-normal">
                  Gemini inspects your actual text to propose specific titles, meta descriptions, FAQ sections, and rewrites.
                </p>
                <button
                  onClick={fetchSuggestions}
                  disabled={isLoadingSuggestions || !content.trim()}
                  className="w-full py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isLoadingSuggestions ? 'Analyzing text...' : 'Generate New Proposals'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {suggestions.map(sug => (
                  <div
                    key={sug.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      sug.applied ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {sug.type.replace('_', ' ')}
                      </span>
                      {sug.applied && (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Applied
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900">{sug.title}</div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 font-mono text-[11px] text-slate-800 break-words">
                      {sug.suggestedValue}
                    </div>
                    <div className="text-[10px] text-slate-500 italic">{sug.reason}</div>
                    <div className="flex justify-end pt-1">
                      {!sug.applied ? (
                        <button
                          onClick={() => applySuggestion(sug)}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Apply</span>
                        </button>
                      ) : (
                        <button
                          onClick={undoSuggestion}
                          className="px-2 py-1 rounded-md border border-slate-300 text-slate-600 text-[11px] hover:bg-slate-50 transition-colors"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {suggestions.length === 0 && !isLoadingSuggestions && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No suggestions yet. Click above to analyze your text.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GEO Helpers (Generative Engine Optimization) */}
          {activeTab === 'geo' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>GEO Structured Schemas & FAQs</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Generates Article, FAQPage, and Organization JSON-LD strictly grounded in your article content to maximize search clarity.
                </p>
                <button
                  onClick={generateGeo}
                  disabled={isGeneratingGeo || !content.trim()}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <Code2 className="w-3 h-3" />
                  <span>{isGeneratingGeo ? 'Generating Schemas...' : 'Generate GEO Schemas'}</span>
                </button>
              </div>

              {geoResult && (
                <div className="space-y-3">
                  {/* JSON-LD Script */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Combined JSON-LD</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(geoResult.jsonLdCombined);
                          setCopiedGeo(true);
                          setTimeout(() => setCopiedGeo(false), 2000);
                        }}
                        className="text-[10px] border border-slate-200 px-2 py-0.5 rounded text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                      >
                        {copiedGeo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedGeo ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="p-2 rounded bg-slate-900 text-white font-mono text-[10px] overflow-x-auto max-h-48 leading-tight">
                      {geoResult.jsonLdCombined}
                    </pre>
                  </div>

                  {/* FAQ Q&A */}
                  {geoResult.faqSection && geoResult.faqSection.length > 0 && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>Extracted FAQs</span>
                        <button
                          onClick={() => {
                            const faqMarkdown = '\n\n## Frequently Asked Questions\n\n' +
                              geoResult.faqSection.map(f => `### ${f.question}\n${f.answer}\n`).join('\n');
                            const next = content + faqMarkdown;
                            setContent(next);
                            onEdit(next, title, targetKeyword, metaDescription);
                          }}
                          className="text-[10px] text-emerald-700 font-semibold hover:underline"
                        >
                          + Append to Draft
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {geoResult.faqSection.map((faq, idx) => (
                          <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-100 text-[11px] space-y-0.5">
                            <div className="font-bold text-slate-800">Q: {faq.question}</div>
                            <div className="text-slate-600">A: {faq.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 italic">
                    Provenance: {geoResult.disclaimer || 'AI-generated grounded in document text'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Live Page Extractor (SSRF-Safe) */}
          {activeTab === 'live' && (
            <form onSubmit={extractLivePage} className="p-3 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Analyze a Live Page</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Load any public URL. The backend extracts its real title, meta description, headings, and body into this editor so you can optimize it.
              </p>
              <div>
                <input
                  type="url"
                  required
                  value={crawlUrl}
                  onChange={e => setCrawlUrl(e.target.value)}
                  placeholder="https://example.com/blog-post"
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {crawlError && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                  {crawlError}
                </div>
              )}
              <button
                type="submit"
                disabled={isCrawling}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1"
              >
                <Globe className="w-3 h-3" />
                <span>{isCrawling ? 'Crawling page securely...' : 'Import Live Content'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Version History Modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" />
                <span>Document Version History</span>
              </h3>
              <button
                onClick={() => setShowVersions(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {isLoadingVersions ? (
                <div className="text-center py-4 text-xs text-slate-400">Loading versions...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No checkpoints recorded yet.</div>
              ) : (
                versions.map(v => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 flex items-center justify-between text-xs transition-all"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        Version #{v.versionNumber}: {v.title || 'Checkpoint'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Score: {v.seoScore}/100 &bull; {v.savedAt ? new Date(v.savedAt).toLocaleString() : 'Saved'}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreVersion(v.id)}
                      className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowVersions(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-50 font-medium"
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

export default SeoEditor;
