import React, { useState } from 'react';
import { Mail, Copy, Check, Sparkles, Loader2, Send, Download, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { EmailSequenceResult } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const Email: React.FC = () => {
  const navigate = useNavigate();
  const [campaignType, setCampaignType] = useState('Cold Outreach');
  const [targetAudience, setTargetAudience] = useState('CTOs & Heads of Infrastructure');
  const [productService, setProductService] = useState('Automated AWS & Azure cloud migration with zero downtime');
  const [tone, setTone] = useState<'Professional' | 'Friendly' | 'Persuasive' | 'Informative' | 'Promotional'>('Professional');
  const [touchpoints, setTouchpoints] = useState(3);
  const [callToAction, setCallToAction] = useState('15-minute architecture feasibility call');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EmailSequenceResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAudience.trim() || !productService.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.generateEmail({
        campaignType,
        targetAudience: targetAudience.trim(),
        productService: productService.trim(),
        tone,
        touchpoints,
        callToAction: callToAction.trim()
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const copySequence = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result.sequence], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Email_Sequence_${campaignType.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Email Marketing Specialist</h1>
            <p className="text-xs text-slate-500">
              Generate high-converting multi-touch cold sequences, follow-ups, subject line variants, and strong CTAs.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Form */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Campaign Strategy
              </label>
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
              >
                <option value="Cold Outreach">Cold Outreach (Net New Leads)</option>
                <option value="Product Launch">Product Launch & Feature Announcement</option>
                <option value="Follow-Up Sequence">Ghosting / Breakup Follow-Up</option>
                <option value="Event / Webinar Invitation">Event / Webinar Invitation</option>
                <option value="Inbound Lead Nurturing">Inbound Lead Nurturing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tone of Voice
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
              >
                <option value="Professional">Professional (C-Suite & Enterprise)</option>
                <option value="Persuasive">Persuasive (High-Conversion & Pain Point Driven)</option>
                <option value="Friendly">Friendly & Approachable</option>
                <option value="Informative">Informative & Educational</option>
                <option value="Promotional">Promotional & Direct</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Persona
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. VP Marketing, CTO, Head of Sales"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Touchpoints (Number of Emails)
              </label>
              <select
                value={touchpoints}
                onChange={(e) => setTouchpoints(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
              >
                <option value={1}>1 Email (Single Outreach)</option>
                <option value={2}>2 Emails (Intro + Follow-up)</option>
                <option value={3}>3 Emails (Standard Cadence)</option>
                <option value={4}>4 Emails (Extended Sequence)</option>
                <option value={5}>5 Emails (Full Multi-Touch Cadence)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Core Offering / Value Proposition
            </label>
            <textarea
              value={productService}
              onChange={(e) => setProductService(e.target.value)}
              placeholder="e.g. Automated cloud migration software that reduces enterprise cloud transfer times by 65% with zero downtime guarantee."
              rows={2}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              Includes personalization placeholders: {"{{FirstName}}"}, {"{{CompanyName}}"}
            </span>

            <button
              type="submit"
              disabled={isLoading || !targetAudience.trim() || !productService.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Drafting Sequence...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Generate Campaign</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Generated Sequence Output */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 tracking-wider">
                {result.campaignType} • {result.touchpoints} Touchpoints
              </span>
              <h2 className="text-sm font-bold text-slate-900 mt-1">
                Targeted Campaign: {result.targetAudience}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copySequence}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied' : 'Copy All'}</span>
              </button>

              <button
                onClick={downloadTxt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download .txt</span>
              </button>

              <button
                onClick={() =>
                  navigate(`/workspace?prompt=${encodeURIComponent(`Let's personalize this email campaign:\n\n${result.sequence.substring(0, 500)}...`)}`)
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Refine in Chat</span>
              </button>
            </div>
          </div>

          <div className="prose prose-xs max-w-none text-slate-800 leading-relaxed font-sans">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.sequence}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
