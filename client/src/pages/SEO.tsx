import React, { useState, useEffect } from 'react';
import {
  Globe2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Link2,
  Image as ImageIcon,
  Heading,
  Copy,
  Check,
  RotateCcw,
  StopCircle,
  FileCode,
  Gauge,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { useJobs } from '../context/JobContext';
import { SeoAnalysisResult } from '../types';

export const SEO: React.FC = () => {
  const [url, setUrl] = useState('');
  const [audit, setAudit] = useState<SeoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Meta Generator State
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [metaResult, setMetaResult] = useState<string | null>(null);
  const [copiedMeta, setCopiedMeta] = useState(false);

  // Background Job integration
  const { jobs, startJob, cancelJob, retryJob } = useJobs();
  const currentJob = jobs.find((j) => j.agentId === 'seo' && (j.status === 'running' || j.status === 'queued'));
  const lastCompletedJob = jobs.find((j) => j.agentId === 'seo' && j.status === 'completed');
  const lastInterruptedJob = jobs.find((j) => j.agentId === 'seo' && (j.status === 'interrupted' || j.status === 'failed'));

  // Restore completed audit from job state on mount or job completion
  useEffect(() => {
    if (lastCompletedJob && lastCompletedJob.result) {
      try {
        const parsed = JSON.parse(lastCompletedJob.result);
        setAudit(parsed);
        try {
          const input = JSON.parse(lastCompletedJob.input);
          if (input.url && !url) setUrl(input.url);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
  }, [lastCompletedJob]);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setError(null);
    setAudit(null);
    setMetaResult(null);

    try {
      await startJob('seo', { url: url.trim(), refresh: true });
    } catch (err: any) {
      setError(err.message || 'Failed to start background SEO audit.');
    }
  };

  const handleGenerateMeta = async () => {
    if (!audit) return;
    setIsGeneratingMeta(true);
    try {
      const pageData = audit.pageData || (audit as any);
      const summary = `Title: ${pageData.title}. Description: ${pageData.description}. Primary H1s: ${(pageData.headings?.h1 || []).join(', ')}`;
      const res = await api.generateSeoMeta(summary);
      setMetaResult(res.result);
    } catch (err: any) {
      alert('Meta generation failed: ' + err.message);
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  const copyMetaToClipboard = async () => {
    if (!metaResult) return;
    await navigator.clipboard.writeText(metaResult);
    setCopiedMeta(true);
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  const isRunning = Boolean(currentJob);
  const activePageData = audit?.pageData || (audit as any);

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Globe2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SEO & GEO Specialist Agent</h1>
            <p className="text-xs text-slate-500">
              Deterministic website crawler, on-page health auditor, and Generative Engine Optimization (GEO/AEO) engine.
            </p>
          </div>
        </div>
      </div>

      {/* URL Input Form */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
        <form onSubmit={handleAudit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Website URL to Audit
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={isRunning}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 font-mono"
              />
              <button
                type="submit"
                disabled={isRunning || !url.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40 shrink-0"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Auditing Website...</span>
                  </>
                ) : (
                  <>
                    <Globe2 className="w-3.5 h-3.5" />
                    <span>Run SEO Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Runs as an isolated background job. SSRF-safe, robots.txt aware, with deterministic scoring.</span>
            {isRunning && currentJob && (
              <button
                type="button"
                onClick={() => cancelJob(currentJob.jobId)}
                className="text-red-500 hover:underline flex items-center gap-1 font-semibold"
              >
                <StopCircle className="w-3 h-3" />
                <span>Cancel Audit</span>
              </button>
            )}
          </div>
        </form>

        {/* Live Background Progress Bar */}
        {isRunning && currentJob && (
          <div className="mt-4 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-blue-900 font-semibold">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>{currentJob.currentStage || 'Running background crawl & audit...'}</span>
              </div>
              <span className="font-mono">{currentJob.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${currentJob.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Interrupted / Error Recovery Banner */}
        {!isRunning && lastInterruptedJob && !audit && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Previous audit was interrupted: <strong>{lastInterruptedJob.error || 'Server restart or timeout'}</strong>
              </span>
            </div>
            <button
              onClick={() => retryJob(lastInterruptedJob.jobId)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Audit</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Results */}
      {audit && (
        <div className="space-y-6 animate-fade-in">
          {/* Score & Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Score Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">SEO Health Score</span>
              <div className="my-2 flex items-baseline gap-2">
                <span
                  className={`text-3xl font-extrabold ${
                    audit.score >= 80 ? 'text-emerald-600' : audit.score >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}
                >
                  {audit.score}
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {audit.score >= 80 ? 'Well Optimized' : audit.score >= 60 ? 'Needs Improvements' : 'Critical Issues'}
              </span>
            </div>

            {/* Headings Stat */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Heading Hierarchy</span>
                <Heading className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-xl font-bold text-slate-800">{activePageData.headings?.h1?.length || 0} H1</p>
              <p className="text-[11px] text-slate-400">
                {activePageData.headings?.h2?.length || 0} H2 • {activePageData.headings?.h3?.length || 0} H3
              </p>
            </div>

            {/* Images Stat */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Image Alt Attributes</span>
                <ImageIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-xl font-bold text-slate-800">
                {activePageData.images?.missingAlt === 0 ? 'All Good' : `${activePageData.images?.missingAlt || 0} Missing`}
              </p>
              <p className="text-[11px] text-slate-400">{activePageData.images?.total || 0} total images</p>
            </div>

            {/* Performance Stat */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Speed / Core Web Vitals</span>
                <Gauge className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-slate-800">
                {typeof audit.performance?.score === 'number' ? `${audit.performance.score}/100` : 'Not measured'}
              </p>
              <p className="text-[10px] text-slate-400 truncate" title={audit.performance?.details}>
                {audit.performance?.details || 'Requires PageSpeed API Key'}
              </p>
            </div>
          </div>

          {/* Current Meta Tags Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Extracted Page Metadata</h2>
                <p className="text-[11px] text-slate-500">Character counts and tag validation calculated directly in code.</p>
              </div>
              <button
                onClick={handleGenerateMeta}
                disabled={isGeneratingMeta}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
              >
                {isGeneratingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate Optimized Meta</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Title Tag</span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200">
                    {activePageData.titleLength} characters
                  </span>
                </div>
                <p className="font-medium text-slate-800 break-words">{activePageData.title || '(No <title> tag found)'}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Meta Description</span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200">
                    {activePageData.descriptionLength} characters
                  </span>
                </div>
                <p className="font-medium text-slate-800 break-words">{activePageData.description || '(No meta description found)'}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Canonical Tag</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activePageData.canonicalUrl ? 'Present' : 'Missing'}
                  </span>
                </div>
                <p className="font-medium text-slate-800 font-mono text-[11px] truncate">
                  {activePageData.canonicalUrl || 'None'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Robots.txt & Sitemap</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    HTTP {audit.robotsTxt?.status} / {audit.sitemap?.status}
                  </span>
                </div>
                <p className="font-medium text-slate-800 text-[11px]">
                  robots.txt: {audit.robotsTxt?.found ? 'Active' : 'Missing (404)'} • sitemap: {audit.sitemap?.found ? 'Accessible' : 'Missing'}
                </p>
              </div>
            </div>

            {/* Generated Meta Box */}
            {metaResult && (
              <div className="mt-4 p-4 rounded-xl bg-violet-50/70 border border-violet-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    AI-Optimized Metadata Recommendations
                  </span>
                  <button
                    onClick={copyMetaToClipboard}
                    className="flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                  >
                    {copiedMeta ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMeta ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                  {metaResult}
                </pre>
              </div>
            )}
          </div>

          {/* Technical Findings Table with URL, Actual Value, Evidence, and Fix */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Detected Technical SEO Findings & Evidence</h2>
              <p className="text-[11px] text-slate-500">
                Every finding presents verified evidence from the crawled HTML, actual values, and code-level fixes.
              </p>
            </div>

            <div className="space-y-3">
              {(audit.findings || []).map((finding: any, idx: number) => {
                const isCritical = finding.priority === 'critical';
                const isWarning = finding.priority === 'warning';
                const isGood = finding.priority === 'good';
                const isNotChecked = finding.priority === 'not_checked';

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      isCritical
                        ? 'bg-red-50/60 border-red-200'
                        : isWarning
                        ? 'bg-amber-50/60 border-amber-200'
                        : isNotChecked
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-emerald-50/60 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        {isCritical && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                        {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                        {isGood && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {isNotChecked && <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-slate-900">{finding.title}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-mono">
                        {finding.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-500 block">Actual Extracted Value:</span>
                        <div className="font-mono text-slate-800 bg-white/80 p-1.5 rounded border border-slate-200/60 break-words">
                          {finding.actualValue}
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-500 block">HTML Proof / Evidence:</span>
                        <div className="font-mono text-slate-700 bg-white/80 p-1.5 rounded border border-slate-200/60 break-words">
                          {finding.evidence}
                        </div>
                      </div>
                    </div>

                    {finding.fix && (
                      <div className="pt-1 text-[11px] text-slate-800 font-medium">
                        <strong className="text-slate-900">Recommended Fix:</strong> {finding.fix}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* GEO / AEO Recommendations */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-bold text-slate-900">Generative Engine Optimization (GEO/AEO) Signals</h2>
            </div>
            <p className="text-xs text-slate-500">
              Tactics to maximize visibility when AI answer engines (ChatGPT Search, Perplexity, Gemini, Google AI Overviews) formulate answers.
            </p>
            <div className="space-y-2 pt-2">
              {(audit.geoAeoRecommendations || []).map((rec: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
                  <span>{typeof rec === 'string' ? rec : rec.action || rec.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
