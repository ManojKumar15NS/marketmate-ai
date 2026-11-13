import React, { useState } from 'react';
import {
  X,
  Play,
  RotateCcw,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
  Globe,
  Search,
  Users,
  FileText,
  Compass,
  Mail,
  Layers,
  MessageSquare
} from 'lucide-react';
import { useJobs } from '../context/JobContext';
import { BackgroundJob } from '../types';
import { useNavigate } from 'react-router-dom';

export const BackgroundActivityPanel: React.FC = () => {
  const { jobs, activeCount, isPanelOpen, closePanel, cancelJob, retryJob } = useJobs();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'interrupted'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!isPanelOpen) return null;

  const filteredJobs = jobs.filter((j) => {
    if (filter === 'active') return j.status === 'running' || j.status === 'queued';
    if (filter === 'completed') return j.status === 'completed';
    if (filter === 'interrupted') return j.status === 'interrupted' || j.status === 'failed' || j.status === 'cancelled';
    return true;
  });

  const getAgentMeta = (agentId: BackgroundJob['agentId']) => {
    switch (agentId) {
      case 'prospector':
        return { label: 'B2B Prospector', icon: Globe, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', path: '/prospecting' };
      case 'seo':
        return { label: 'SEO & GEO Agent', icon: Search, color: 'text-blue-600 bg-blue-50 border-blue-200', path: '/seo' };
      case 'email_finder':
        return { label: 'LinkedIn & Email Finder', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200', path: '/email-finder' };
      case 'document':
        return { label: 'Document Intelligence', icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-200', path: '/reports' };
      case 'research':
        return { label: 'Market Research', icon: Compass, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', path: '/research' };
      case 'email':
        return { label: 'Email Outreach', icon: Mail, color: 'text-sky-600 bg-sky-50 border-sky-200', path: '/email' };
      case 'whatsapp':
        return { label: 'WhatsApp Finder', icon: MessageSquare, color: 'text-emerald-700 bg-emerald-50 border-emerald-300', path: '/whatsapp' };
      default:
        return { label: 'Agent', icon: Layers, color: 'text-slate-600 bg-slate-50 border-slate-200', path: '/' };
    }
  };

  const getTargetSummary = (job: BackgroundJob): string => {
    try {
      const input = JSON.parse(job.input);
      if (input.url) return input.url;
      if (input.website) return input.website;
      if (input.topic) return `Topic: ${input.topic}`;
      if (input.filename) return input.filename;
      if (input.recipientName) return `To: ${input.recipientName} (${input.companyName})`;
      if (input.keywords && input.location) return `${input.keywords} (${input.location})`;
      if (input.keywords && input.keywords.length > 0) return `Keywords: ${Array.isArray(input.keywords) ? input.keywords.slice(0, 2).join(', ') : input.keywords}`;
    } catch {
      // ignore
    }
    return job.agentId.toUpperCase();
  };

  const handleCancel = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await cancelJob(jobId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await retryJob(jobId);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-sm">Background Activity Panel</h2>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold animate-pulse">
                    {activeCount} Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Persistent SQLite job queue & worker execution</p>
            </div>
          </div>
          <button
            onClick={closePanel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-xs bg-white">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({jobs.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filter === 'active' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Active ({jobs.filter((j) => j.status === 'running' || j.status === 'queued').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Completed ({jobs.filter((j) => j.status === 'completed').length})
          </button>
          <button
            onClick={() => setFilter('interrupted')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              filter === 'interrupted' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Interrupted / Failed ({jobs.filter((j) => j.status === 'interrupted' || j.status === 'failed' || j.status === 'cancelled').length})
          </button>
        </div>

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {filteredJobs.map((job) => {
            const meta = getAgentMeta(job.agentId);
            const Icon = meta.icon;
            const target = getTargetSummary(job);

            return (
              <div key={job.jobId} className="pt-3 first:pt-0 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg border text-xs ${meta.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{meta.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">#{job.jobId.slice(-6)}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate max-w-xs font-mono">{target}</div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {job.status === 'running' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Running
                      </span>
                    )}
                    {job.status === 'queued' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                        <Clock className="w-2.5 h-2.5" />
                        Queued
                      </span>
                    )}
                    {job.status === 'completed' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Done
                      </span>
                    )}
                    {job.status === 'interrupted' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold" title="Process was interrupted by server restart or shutdown">
                        <RotateCcw className="w-2.5 h-2.5" />
                        Interrupted
                      </span>
                    )}
                    {job.status === 'failed' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Failed
                      </span>
                    )}
                    {job.status === 'cancelled' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium">
                        <StopCircle className="w-2.5 h-2.5" />
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Current Stage */}
                {(job.status === 'running' || job.status === 'queued') && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate pr-2">{job.currentStage || 'Processing...'}</span>
                      <span className="font-mono font-bold text-slate-700 shrink-0">{job.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message if failed or interrupted */}
                {job.error && (job.status === 'failed' || job.status === 'interrupted') && (
                  <div className="p-2 bg-red-50/70 border border-red-100 rounded text-[11px] text-red-700 font-mono break-all">
                    {job.error}
                  </div>
                )}

                {/* Action Row */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-[10px] text-slate-400">
                    {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-2">
                    {(job.status === 'running' || job.status === 'queued') && (
                      <button
                        onClick={() => handleCancel(job.jobId)}
                        disabled={actionLoadingId === job.jobId}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] transition"
                      >
                        <StopCircle className="w-3 h-3 text-red-500" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {(job.status === 'interrupted' || job.status === 'failed') && (
                      <button
                        onClick={() => handleRetry(job.jobId)}
                        disabled={actionLoadingId === job.jobId}
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded font-bold text-[11px] transition shadow-2xs"
                      >
                        {actionLoadingId === job.jobId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        <span>Retry</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        closePanel();
                        navigate(meta.path);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:underline font-medium text-[11px]"
                    >
                      <span>Open Workspace</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredJobs.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <span>No background jobs match the current filter.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
