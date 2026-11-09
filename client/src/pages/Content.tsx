import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  Share2,
  RefreshCw,
  Edit3,
  Sliders,
  Layers,
  Globe,
  Clock,
  ArrowRight,
  ExternalLink,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ChevronRight,
  Send,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import { useJobs } from '../context/JobContext';

const CONTENT_TYPES = [
  'blog article',
  'LinkedIn post',
  'cold email',
  'email sequence',
  'landing page copy',
  'ad copy',
  'social caption',
  'newsletter',
  'case study outline'
];

const TONES = [
  'Professional & Authoritative',
  'Conversational & Friendly',
  'Data-Driven & Analytical',
  'Bold & Provocative',
  'Persuasive & High-Urgency',
  'Educational & Explanatory',
  'Executive & Concise'
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' }
];

const READING_LEVELS = [
  'General Audience (5th-7th Grade)',
  'Standard Plain English (8th-9th Grade)',
  'Professional / College Level',
  'Technical Specialist / Academic'
];

export const Content: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, startJob } = useJobs();

  // Primary Input Form States
  const [topic, setTopic] = useState<string>('Why high-growth B2B teams are migrating to autonomous AI prospecting');
  const [contentType, setContentType] = useState<string>('LinkedIn post');
  const [variantsCount, setVariantsCount] = useState<number>(3);
  const [tone, setTone] = useState<string>('Professional & Authoritative');
  const [language, setLanguage] = useState<string>('en');
  const [readingLevel, setReadingLevel] = useState<string>('Professional / College Level');

  // Word Count Targets
  const [wordCountTarget, setWordCountTarget] = useState<number>(250);
  const [customRange, setCustomRange] = useState<boolean>(false);
  const [minWordCount, setMinWordCount] = useState<number>(200);
  const [maxWordCount, setMaxWordCount] = useState<number>(300);

  // Target Audience States
  const [targetRole, setTargetRole] = useState<string>('Chief Revenue Officer, VP Sales, GTM Leader');
  const [targetIndustry, setTargetIndustry] = useState<string>('B2B Software, Cloud Services, Enterprise Tech');
  const [targetCompanySize, setTargetCompanySize] = useState<string>('50-500 employees');
  const [targetLocation, setTargetLocation] = useState<string>('North America & Europe');
  const [painPoints, setPainPoints] = useState<string[]>([
    'Low outbound reply rates from generic email blast tools',
    'Sales reps wasting 15+ hours/week on manual LinkedIn research',
    'High email bounce rates and damaged domain reputation'
  ]);
  const [newPainPoint, setNewPainPoint] = useState<string>('');

  // Brand Voice & Optional Constraints
  const [cta, setCta] = useState<string>('Comment "PIPELINE" or visit tekaxis.com to see live demo');
  const [brandVoice, setBrandVoice] = useState<string>('Confident, direct, zero fluff, grounded in metrics');
  const [thingsToAvoid, setThingsToAvoid] = useState<string>('Fake statistics, generic buzzwords (e.g. "synergy", "game-changer"), hyperbolic claims');
  const [primaryKeywords, setPrimaryKeywords] = useState<string>('B2B prospecting, GTM automation, sales pipeline');

  // Generation & Results State
  const [options, setOptions] = useState<any[]>([]);
  const [activeOptionIndex, setActiveOptionIndex] = useState<number>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedBody, setEditedBody] = useState<string>('');
  const [editedTitle, setEditedTitle] = useState<string>('');

  // UI & Loading States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Library & Saved Items Drawer
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [savedCampaigns, setSavedCampaigns] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Sync with persistent background job
  const activeContentJob = jobs.find(j => j.agentId === 'content' && (j.status === 'running' || j.status === 'queued'));
  const lastFinishedContentJob = jobs.find(j => j.agentId === 'content' && j.status === 'completed');

  useEffect(() => {
    if (activeContentJob) {
      setIsGenerating(true);
      setProgressMsg(`${activeContentJob.currentStage || 'Generating content variants...'} (${activeContentJob.progress}%)`);
    } else {
      setIsGenerating(false);
    }
  }, [activeContentJob]);

  useEffect(() => {
    if (lastFinishedContentJob && lastFinishedContentJob.result) {
      try {
        const res = JSON.parse(lastFinishedContentJob.result);
        if (res.options && Array.isArray(res.options)) {
          setOptions(res.options);
          setActiveOptionIndex(0);
        }
      } catch (e) {
        console.warn('Failed parsing content job result:', e);
      }
    }
  }, [lastFinishedContentJob?.jobId]);

  useEffect(() => {
    loadLibrary();
    loadCampaigns();
  }, []);

  const loadLibrary = async () => {
    try {
      const res = await api.getContentItems();
      if (res.success && res.data) {
        setSavedItems(res.data);
      }
    } catch {}
  };

  const loadCampaigns = async () => {
    try {
      const res = await api.getCampaigns();
      if (Array.isArray(res)) {
        setSavedCampaigns(res);
      }
    } catch {}
  };

  // Import audience from a saved GTM pipeline campaign
  const handleImportCampaign = (camp: any) => {
    if (camp.title) setTopic(`How ${camp.title} transforms modern business operations`);
    if (camp.targetIndustry) setTargetIndustry(camp.targetIndustry);
    if (camp.keywords && camp.keywords.length > 0) setPrimaryKeywords(camp.keywords.slice(0, 4).join(', '));
    setShowImportModal(false);
    setSuccessMsg(`Imported ICP target criteria from "${camp.title}".`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Add pain point chip
  const handleAddPainPoint = () => {
    if (!newPainPoint.trim()) return;
    setPainPoints([...painPoints, newPainPoint.trim()]);
    setNewPainPoint('');
  };

  // Remove pain point chip
  const handleRemovePainPoint = (idx: number) => {
    setPainPoints(painPoints.filter((_, i) => i !== idx));
  };

  // Execute Generation (using persistent background job)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg('Topic or brief is required.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsGenerating(true);
    setProgressMsg('Initializing background content generation...');

    const payload = {
      topic: topic.trim(),
      contentType,
      variantsCount,
      tone,
      language,
      readingLevel,
      wordCountTarget: customRange ? undefined : wordCountTarget,
      minWordCount: customRange ? minWordCount : Math.max(20, Math.round(wordCountTarget * 0.9)),
      maxWordCount: customRange ? maxWordCount : Math.round(wordCountTarget * 1.1),
      targetAudience: {
        role: targetRole,
        industry: targetIndustry,
        companySize: targetCompanySize,
        location: targetLocation,
        painPoints,
        notes: brandVoice
      },
      primaryKeywords: primaryKeywords.split(',').map(s => s.trim()).filter(Boolean),
      cta: cta.trim() || undefined,
      brandVoice: brandVoice.trim() || undefined,
      thingsToAvoid: thingsToAvoid.trim() || undefined,
      asyncJob: true
    };

    try {
      // Start as persistent background job (survives tab switches and refresh)
      await startJob('content', payload);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start content generation job.');
      setIsGenerating(false);
    }
  };

  // Refine single option: make shorter, make longer, change tone
  const handleRefine = async (action: 'shorter' | 'longer' | 'change_tone' | 'regenerate', targetTone?: string) => {
    const current = options[activeOptionIndex];
    if (!current) return;

    setIsGenerating(true);
    setProgressMsg(`Refining option ${activeOptionIndex + 1} (${action})...`);
    setErrorMsg(null);

    try {
      const res = await api.refineContent({
        body: current.body,
        action,
        targetTone: targetTone || tone,
        currentTitle: current.title
      });

      if (res.success && res.data) {
        const updated = [...options];
        updated[activeOptionIndex] = {
          ...current,
          body: res.data.body,
          wordCount: res.data.wordCount,
          characterCount: res.data.characterCount,
          readingTimeMinutes: res.data.readingTimeMinutes
        };
        setOptions(updated);
        setSuccessMsg(`Option ${activeOptionIndex + 1} updated successfully!`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Refinement failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save manual edit
  const handleSaveInlineEdit = () => {
    if (editingIndex === null) return;
    const updated = [...options];
    const wCount = editedBody.trim().split(/\s+/).filter(Boolean).length;
    updated[editingIndex] = {
      ...updated[editingIndex],
      title: editedTitle,
      body: editedBody,
      wordCount: wCount,
      characterCount: editedBody.length,
      readingTimeMinutes: Number((wCount / 200).toFixed(1))
    };
    setOptions(updated);
    setEditingIndex(null);
    setSuccessMsg('Inline edits saved.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Copy option body to clipboard
  const handleCopyOption = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    navigator.clipboard.writeText(`${opt.title}\n\n${opt.body}`);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Save option to PostgreSQL Library
  const handleSaveToLibrary = async (idx: number) => {
    const opt = options[idx];
    if (!opt) return;

    try {
      const payload = {
        title: opt.title,
        contentType,
        topic,
        currentBody: opt.body,
        targetAudience: {
          role: targetRole,
          industry: targetIndustry,
          companySize: targetCompanySize,
          location: targetLocation,
          painPoints
        },
        options,
        wordCount: opt.wordCount,
        characterCount: opt.characterCount,
        readingTimeMinutes: opt.readingTimeMinutes
      };

      const res = await api.createContent({ ...payload, asyncJob: false });
      if (res.success) {
        setSuccessMsg(`Option ${idx + 1} saved to your PostgreSQL Content Library!`);
        loadLibrary();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save to library.');
    }
  };

  // Send content to Agent 4 (SEO Content Editor)
  const handleSendToSeoEditor = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    navigate('/seo-editor', {
      state: {
        initialTitle: opt.title,
        initialContent: `<h1>${opt.title}</h1>\n<p>${opt.body.replace(/\n\n+/g, '</p>\n<p>')}</p>`,
        initialKeyword: primaryKeywords.split(',')[0]?.trim() || ''
      }
    });
  };

  // Export option to client file
  const handleExportOption = async (idx: number, format: 'md' | 'txt' | 'docx') => {
    const opt = options[idx];
    if (!opt) return;

    if (format === 'docx') {
      try {
        const payload = {
          title: opt.title,
          contentType,
          topic,
          currentBody: opt.body,
          options: [opt],
          wordCount: opt.wordCount,
          asyncJob: false
        };
        const res = await api.createContent(payload);
        if (res.data?.id) {
          window.location.href = api.getContentExportUrl(res.data.id, 'docx');
          return;
        }
      } catch (e) {
        console.error('Failed to export docx', e);
      }
    }

    let mime = 'text/plain';
    let ext = format;
    let content = `${opt.title}\n\n${opt.body}`;

    if (format === 'md') {
      mime = 'text/markdown';
      content = `# ${opt.title}\n\n${opt.body}`;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${opt.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'content'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 text-slate-800">
      {/* LEFT: Target Audience & Configuration Panel */}
      <aside className="w-96 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 select-none overflow-y-auto">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Content Creator</h2>
              <p className="text-[10px] text-slate-400 font-medium">Audience-targeted copy generator</p>
            </div>
          </div>
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1 shadow-sm"
            title="Open Saved Content Library"
          >
            <BookOpen className="w-3 h-3 text-pink-600" />
            <span>Library ({savedItems.length})</span>
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-4 space-y-4 text-xs">
          {/* Topic / Brief */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>TOPIC OR BRIEF *</span>
              <span className="text-[10px] text-slate-400 font-normal">Required</span>
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Why B2B sales teams are migrating from cold spam to verified LinkedIn decision-maker research"
              className="w-full p-2.5 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-1 focus:ring-pink-500 focus:outline-none"
              required
            />
          </div>

          {/* Content Type & Variants */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">CONTENT TYPE</label>
              <select
                value={contentType}
                onChange={e => setContentType(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:ring-1 focus:ring-pink-500 focus:outline-none capitalize"
              >
                {CONTENT_TYPES.map(ct => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">VARIANTS (1-5)</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setVariantsCount(num)}
                    className={`flex-1 py-1.5 rounded-md font-bold text-xs transition ${
                      variantsCount === num
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Word Count Targets */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">WORD COUNT ENFORCEMENT</span>
              <button
                type="button"
                onClick={() => setCustomRange(!customRange)}
                className="text-[10px] text-pink-600 hover:underline font-semibold"
              >
                {customRange ? 'Switch to Target' : 'Custom Min/Max Range'}
              </button>
            </div>

            {!customRange ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Target: {wordCountTarget} words</span>
                  <span>Range: ±10%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="25"
                  value={wordCountTarget}
                  onChange={e => setWordCountTarget(Number(e.target.value))}
                  className="w-full accent-pink-600"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Min Words</label>
                  <input
                    type="number"
                    value={minWordCount}
                    onChange={e => setMinWordCount(Number(e.target.value))}
                    className="w-full p-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Max Words</label>
                  <input
                    type="number"
                    value={maxWordCount}
                    onChange={e => setMaxWordCount(Number(e.target.value))}
                    className="w-full p-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Target Audience Section */}
          <div className="space-y-2.5 pt-1 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">TARGET AUDIENCE</span>
              {savedCampaigns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>Import from ICP</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">ROLE / JOB TITLE</label>
              <input
                type="text"
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                placeholder="e.g., Head of Growth, VP Engineering, Founder"
                className="w-full p-2 border border-slate-300 rounded-md text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">INDUSTRY & COMPANY SIZE</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={targetIndustry}
                  onChange={e => setTargetIndustry(e.target.value)}
                  placeholder="Industry"
                  className="w-full p-2 border border-slate-300 rounded-md text-xs font-medium"
                />
                <input
                  type="text"
                  value={targetCompanySize}
                  onChange={e => setTargetCompanySize(e.target.value)}
                  placeholder="Company Size"
                  className="w-full p-2 border border-slate-300 rounded-md text-xs font-medium"
                />
              </div>
            </div>

            {/* Pain Points Chips */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">TARGET PAIN POINTS</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {painPoints.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 border border-pink-200 text-pink-800 rounded text-[10px]"
                  >
                    <span>{p}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePainPoint(i)}
                      className="text-pink-600 hover:text-pink-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newPainPoint}
                  onChange={e => setNewPainPoint(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPainPoint();
                    }
                  }}
                  placeholder="Add pain point & press Enter..."
                  className="flex-1 p-1.5 border border-slate-300 rounded text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddPainPoint}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Tone, Language & Reading Level */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">TONE & STYLE</label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                >
                  {TONES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">LANGUAGE (10+)</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">READING LEVEL</label>
              <select
                value={readingLevel}
                onChange={e => setReadingLevel(e.target.value)}
                className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
              >
                {READING_LEVELS.map(rl => (
                  <option key={rl} value={rl}>
                    {rl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Keywords & Constraints */}
          <div className="space-y-1 pt-1 border-t border-slate-200">
            <label className="text-[10px] font-semibold text-slate-600">PRIMARY KEYWORDS & CTA</label>
            <input
              type="text"
              value={primaryKeywords}
              onChange={e => setPrimaryKeywords(e.target.value)}
              placeholder="comma-separated keywords"
              className="w-full p-1.5 border border-slate-300 rounded text-xs mb-1"
            />
            <input
              type="text"
              value={cta}
              onChange={e => setCta(e.target.value)}
              placeholder="Call to Action (CTA)"
              className="w-full p-1.5 border border-slate-300 rounded text-xs"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-200 transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating {variantsCount} Distinct Options...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Content Options</span>
              </>
            )}
          </button>
        </form>
      </aside>

      {/* CENTER & RIGHT: Output Variants & Editor Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Top Notification / Status Banner */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-pink-700 font-semibold bg-pink-50 px-3 py-1 rounded-full">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-600" />
                <span>{progressMsg || 'Generating...'}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold bg-rose-50 px-3 py-1 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}
            {!isGenerating && !successMsg && !errorMsg && (
              <span className="text-xs text-slate-500 font-medium">
                {options.length > 0
                  ? `${options.length} verified variant(s) generated with code-calculated word counts.`
                  : 'Configure brief and click Generate Content Options.'}
              </span>
            )}
          </div>

          {/* Action buttons for active option */}
          {options.length > 0 && options[activeOptionIndex] && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSendToSeoEditor(activeOptionIndex)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                title="Open this draft inside the interactive SEO Content Editor workspace"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Send to SEO Editor</span>
              </button>

              <button
                onClick={() => handleSaveToLibrary(activeOptionIndex)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Library</span>
              </button>
            </div>
          )}
        </div>

        {/* Variants Selector Tabs */}
        {options.length > 0 && (
          <div className="px-6 py-2 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">
              Variants ({options.length}):
            </span>
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setActiveOptionIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                  activeOptionIndex === idx
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Option {idx + 1}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    activeOptionIndex === idx ? 'bg-pink-700 text-pink-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {opt.wordCount} words
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {options.length > 0 && options[activeOptionIndex] ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Option Card Header */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-pink-100 text-pink-700 font-bold text-[10px] rounded uppercase">
                      Variant {activeOptionIndex + 1} of {options.length}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{options[activeOptionIndex].title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-mono mt-1.5">
                    <span>
                      Words: <strong className="text-slate-800">{options[activeOptionIndex].wordCount}</strong>
                    </span>
                    <span>
                      Characters: <strong className="text-slate-800">{options[activeOptionIndex].characterCount}</strong>
                    </span>
                    <span>
                      Reading Time: <strong className="text-slate-800">{options[activeOptionIndex].readingTimeMinutes} min</strong>
                    </span>
                    <span
                      className={`font-semibold ${
                        options[activeOptionIndex].withinTargetRange ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {options[activeOptionIndex].withinTargetRange ? '✓ Within Target Range' : '⚡ Length Calibrated'}
                    </span>
                  </div>
                </div>

                {/* Option Actions: Copy, Export, Refine */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyOption(activeOptionIndex)}
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1"
                    title="Copy option text"
                  >
                    {copiedIndex === activeOptionIndex ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleExportOption(activeOptionIndex, 'docx')}
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1"
                    title="Export Word Document (.docx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>DOCX</span>
                  </button>

                  <button
                    onClick={() => handleExportOption(activeOptionIndex, 'md')}
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1"
                    title="Export Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>MD</span>
                  </button>

                  <button
                    onClick={() => handleExportOption(activeOptionIndex, 'txt')}
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1"
                    title="Export Plain Text"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>TXT</span>
                  </button>
                </div>
              </div>

              {/* Option Body Display & Inline Editor */}
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                {editingIndex === activeOptionIndex ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value)}
                      className="w-full p-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                    <textarea
                      rows={14}
                      value={editedBody}
                      onChange={e => setEditedBody(e.target.value)}
                      className="w-full p-3 text-xs leading-relaxed border border-slate-300 rounded-lg font-sans focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveInlineEdit}
                        className="px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-lg"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Generated Content Body
                      </span>
                      <button
                        onClick={() => {
                          setEditingIndex(activeOptionIndex);
                          setEditedTitle(options[activeOptionIndex].title);
                          setEditedBody(options[activeOptionIndex].body);
                        }}
                        className="text-xs text-pink-600 hover:text-pink-800 font-semibold flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Inline</span>
                      </button>
                    </div>
                    <div className="prose prose-slate max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-800">
                      {options[activeOptionIndex].body}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick AI Refine Bar */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                  Quick Refine Option:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRefine('shorter')}
                    disabled={isGenerating}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50"
                  >
                    Make Shorter
                  </button>
                  <button
                    onClick={() => handleRefine('longer')}
                    disabled={isGenerating}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50"
                  >
                    Make Longer
                  </button>
                  <button
                    onClick={() => handleRefine('change_tone', 'Bold & Provocative')}
                    disabled={isGenerating}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50"
                  >
                    More Provocative
                  </button>
                  <button
                    onClick={() => handleRefine('regenerate')}
                    disabled={isGenerating}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate Variant</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Content Generated Yet</h3>
              <p className="text-xs max-w-sm mt-1 text-slate-500">
                Configure your brief, target audience pain points, and desired word count on the left, then click
                Generate Content Options.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Slide-over: Saved PostgreSQL Content Library */}
      {showLibrary && (
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full z-20 shrink-0 select-none shadow-xl">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-pink-600" />
              Content Library ({savedItems.length})
            </span>
            <button
              onClick={() => setShowLibrary(false)}
              className="text-xs text-slate-400 hover:text-slate-700 p-1 rounded"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {savedItems.map(item => (
              <div
                key={item.id}
                className="p-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition space-y-1.5"
              >
                <div className="font-bold text-xs text-slate-900 truncate">{item.title}</div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="capitalize font-medium">{item.contentType}</span>
                  <span className="font-mono">{item.wordCount || 0} words</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">{item.topic}</div>
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setTopic(item.title);
                      setOptions([
                        {
                          title: item.title,
                          body: item.currentBody,
                          wordCount: item.wordCount,
                          characterCount: item.characterCount,
                          readingTimeMinutes: item.readingTimeMinutes,
                          withinTargetRange: true
                        }
                      ]);
                      setActiveOptionIndex(0);
                      setShowLibrary(false);
                    }}
                    className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded font-semibold text-[10px] hover:bg-pink-100"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
            {savedItems.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-8">No saved items in library yet.</div>
            )}
          </div>
        </aside>
      )}

      {/* Modal: Import from saved GTM pipeline campaign */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600" />
                Import ICP from Pipeline Campaigns
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-700 text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Select any campaign created by the B2B Prospector agent to import its verified keywords and industry criteria.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {savedCampaigns.map(camp => (
                <div
                  key={camp.id}
                  onClick={() => handleImportCampaign(camp)}
                  className="p-2.5 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition text-xs"
                >
                  <div className="font-bold text-slate-800">{camp.title}</div>
                  <div className="text-[10px] text-slate-500">{camp.targetIndustry}</div>
                </div>
              ))}
              {savedCampaigns.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-4">No saved campaigns found.</div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
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
export default Content;
