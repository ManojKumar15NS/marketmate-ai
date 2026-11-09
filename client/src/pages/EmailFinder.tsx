import React, { useState, useEffect } from 'react';
import {
  AtSign,
  Search,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  Trash2,
  ExternalLink,
  Plus,
  X,
  Filter,
  Globe,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  History,
  Layers,
  ChevronDown,
  Mail,
  MapPin,
  Settings as SettingsIcon,
  AlertTriangle,
  Send,
  StopCircle,
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useJobs } from '../context/JobContext';
import { api } from '../services/api';
import { DiscoveredContact, EmailSearchRun, HunterSettings } from '../types';

export const EmailFinder: React.FC = () => {
  // Mode: Single Company Mode vs Keyword Discovery Mode (target 100+)
  const [mode, setMode] = useState<'single_company' | 'keyword_discovery'>('single_company');

  // Inputs
  const [websiteInput, setWebsiteInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([
    'CEO',
    'Founder',
    'Managing Director',
    'Head of Sales',
    'Head of Marketing',
    'Operations Head',
    'CTO'
  ]);
  const [targetLocation, setTargetLocation] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [resultLimit, setResultLimit] = useState<number>(100);

  // Results & History
  const [activeSearch, setActiveSearch] = useState<EmailSearchRun | null>(null);
  const [savedSearches, setSavedSearches] = useState<EmailSearchRun[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  // Hunter Provider Settings
  const [hunterSettings, setHunterSettings] = useState<HunterSettings | null>(null);

  // Persistent Background Job Hook
  const { jobs, startJob, cancelJob, retryJob } = useJobs();
  const activeJob = jobs.find(j => j.agentId === 'email_finder' && (j.status === 'running' || j.status === 'queued'));
  const lastFinishedJob = jobs.find(j => j.agentId === 'email_finder' && j.status === 'completed');
  const lastInterruptedJob = jobs.find(j => j.agentId === 'email_finder' && (j.status === 'interrupted' || j.status === 'failed'));

  // Loading & Progress
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState('');
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [isEnrichingBulk, setIsEnrichingBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync background job with UI state
  useEffect(() => {
    if (activeJob) {
      setIsSearching(true);
      setSearchStage(`${activeJob.currentStage || 'Running LinkedIn discovery...'} (${activeJob.progress}%)`);
      try {
        const input = JSON.parse(activeJob.input);
        if (input.website && !websiteInput) setWebsiteInput(input.website);
      } catch {}
    } else {
      setIsSearching(false);
      setSearchStage('');
    }
  }, [activeJob]);

  // Sync completed job
  useEffect(() => {
    if (lastFinishedJob && lastFinishedJob.result) {
      try {
        const result = JSON.parse(lastFinishedJob.result);
        if (result && result.contacts) {
          setActiveSearch(result);
          setSavedSearches(prev => [result, ...prev.filter(s => s.id !== result.id)]);
          setSuccessMsg(`Discovered ${result.actualDiscoveredCount || result.contacts.length} verified decision-makers! LinkedIn profiles verified.`);
        }
      } catch {}
    }
  }, [lastFinishedJob?.completedAt]);

  // Table Filters & Selection
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Copy Feedback
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedBulk, setCopiedBulk] = useState(false);
  const [importingToLeads, setImportingToLeads] = useState(false);

  // Load saved searches and Hunter settings on mount
  useEffect(() => {
    loadSearches();
    loadHunterSettings();
  }, []);

  const loadSearches = async () => {
    try {
      const list = await api.getEmailSearches();
      setSavedSearches(list);
      if (list.length > 0 && !activeSearch) {
        setActiveSearch(list[0]);
      }
    } catch (err: any) {
      console.warn('Could not load email search history:', err.message);
    }
  };

  const loadHunterSettings = async () => {
    try {
      const res = await api.getHunterSettings();
      setHunterSettings(res);
    } catch {
      // non-fatal
    }
  };

  // Keyword Management
  const handleAddKeyword = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    const clean = keywordInput.trim();
    if (clean && !keywords.includes(clean)) {
      setKeywords([...keywords, clean]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords(keywords.filter(k => k !== kwToRemove));
  };

  // Launch Primary Feature: LinkedIn People Discovery (Zero Hunter dependency, Background Job)
  const handleStartSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'single_company' && !websiteInput.trim()) {
      setError('Please enter a company website URL or domain for Single Company Mode.');
      return;
    }
    if (keywords.length === 0) {
      setError('Please add at least one search role or keyword.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setSelectedContactIds(new Set());

    try {
      await startJob('email_finder', {
        mode,
        website: websiteInput.trim() || undefined,
        keywords,
        targetIndustry: targetIndustry.trim() || undefined,
        targetLocation: targetLocation.trim() || undefined,
        limit: resultLimit
      });
      setSuccessMsg(`LinkedIn discovery started in background! You can switch tabs or refresh without losing progress.`);
    } catch (err: any) {
      setError(err.message || 'LinkedIn people discovery encountered an error. Please try again.');
    }
  };

  // Optional Feature: On-Demand Email Enrichment via Hunter
  const handleEnrichSelectedContacts = async () => {
    if (!activeSearch) return;

    if (!hunterSettings?.configured || !hunterSettings?.emailDiscoveryEnabled) {
      setError('Email discovery is currently disabled. Please add and enable your Hunter API key in Settings.');
      return;
    }

    const targetIds = selectedContactIds.size > 0
      ? Array.from(selectedContactIds)
      : filteredContacts.filter(c => !c.email).map(c => c.id);

    if (targetIds.length === 0) {
      setError('Please select at least one contact to find their email.');
      return;
    }

    setIsEnrichingBulk(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.enrichContacts(activeSearch.id, targetIds);
      setActiveSearch(res.searchRun);
      setSavedSearches(prev => prev.map(s => s.id === res.searchRun.id ? res.searchRun : s));

      if (res.creditsExhausted) {
        setError(res.message);
      } else {
        setSuccessMsg(res.message);
      }
      loadHunterSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to enrich emails via Hunter.');
    } finally {
      setIsEnrichingBulk(false);
    }
  };

  const handleEnrichSingleContact = async (contactId: string) => {
    if (!activeSearch) return;

    if (!hunterSettings?.configured || !hunterSettings?.emailDiscoveryEnabled) {
      setError('Email discovery is currently disabled. Please add and enable your Hunter API key in Settings.');
      return;
    }

    setEnrichingIds(prev => new Set(prev).add(contactId));
    setError(null);

    try {
      const res = await api.enrichSingleContact(activeSearch.id, contactId);
      setActiveSearch(res.searchRun);
      setSavedSearches(prev => prev.map(s => s.id === res.searchRun.id ? res.searchRun : s));

      if (res.creditsExhausted) {
        setError('Hunter quota limit reached (HTTP 402/429). Configure key in Settings.');
      } else {
        setSuccessMsg(res.message);
      }
      loadHunterSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to find email for this contact.');
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  // Filter Contacts
  const contacts = activeSearch?.contacts || [];
  const filteredContacts = contacts.filter(c => {
    if (statusFilter === 'with_email' && !c.email) return false;
    if (statusFilter === 'no_email' && Boolean(c.email)) return false;
    if (statusFilter === 'verified' && c.emailStatus !== 'Verified') return false;
    if (statusFilter === 'publicly_listed' && c.emailStatus !== 'Publicly listed') return false;

    if (departmentFilter !== 'all' && c.department.toLowerCase() !== departmentFilter.toLowerCase()) {
      return false;
    }
    if (!tableSearch.trim()) return true;

    const q = tableSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      c.company.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.industry && c.industry.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q)) ||
      c.discoveryKeyword.toLowerCase().includes(q)
    );
  });

  // Unique departments for filter dropdown
  const uniqueDepartments = Array.from(new Set(contacts.map(c => c.department).filter(Boolean)));

  // Multi-Select
  const handleToggleSelectAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleToggleContact = (id: string) => {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContactIds(next);
  };

  // Copy Single Email
  const copySingleEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Copy Bulk Selected
  const copySelectedEmails = () => {
    const selected = contacts.filter(c => selectedContactIds.has(c.id));
    const targetList = selected.length > 0 ? selected : filteredContacts;
    const emails = targetList.map(c => c.email).filter(Boolean) as string[];
    if (emails.length === 0) {
      setError('None of the selected contacts have a verified email address to copy.');
      return;
    }
    navigator.clipboard.writeText(emails.join(', '));
    setCopiedBulk(true);
    setTimeout(() => setCopiedBulk(false), 2000);
  };

  // Import to Prospecting Leads
  const handleImportToLeads = async () => {
    const selected = contacts.filter(c => selectedContactIds.has(c.id));
    const targetList = selected.length > 0 ? selected : filteredContacts;
    if (targetList.length === 0) return;

    setImportingToLeads(true);
    setError(null);
    try {
      const res = await api.importContactsToLeads(targetList);
      setSuccessMsg(`Successfully imported ${res.importedCount} LinkedIn decision-makers into your B2B Prospector leads workspace!`);
    } catch (err: any) {
      setError(err.message || 'Failed to import contacts to leads');
    } finally {
      setImportingToLeads(false);
    }
  };

  // Delete Search Run
  const handleDeleteSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteEmailSearch(id);
      setSavedSearches(prev => prev.filter(s => s.id !== id));
      if (activeSearch?.id === id) {
        const remaining = savedSearches.filter(s => s.id !== id);
        setActiveSearch(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete search');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-6 space-y-6">
      {/* Top Header & Provider Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  LinkedIn People & Email Finder
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Main Feature
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Discover verified LinkedIn decision-makers and authorized professionals. Optionally find professional emails using Hunter.
              </p>
            </div>
          </div>
        </div>

        {/* Live Search History Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Search History ({savedSearches.length})</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showHistoryDropdown && (
            <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Saved People Searches
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {savedSearches.map(run => (
                  <div
                    key={run.id}
                    onClick={() => {
                      setActiveSearch(run);
                      setShowHistoryDropdown(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
                      activeSearch?.id === run.id ? 'bg-blue-50 text-blue-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold truncate">
                        {run.mode === 'single_company' ? run.domain || 'Domain Search' : `Keyword: ${run.keywords[0]}`}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {run.actualDiscoveredCount} contacts · {new Date(run.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={e => handleDeleteSearch(run.id, e)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded"
                      title="Delete search"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {savedSearches.length === 0 && (
                  <div className="text-xs text-slate-400 italic p-3 text-center">No past searches yet</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HUNTER CONFIGURATION BANNER (Independent Feature Separation) */}
      {!hunterSettings?.configured || !hunterSettings?.emailDiscoveryEnabled ? (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-600">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Email discovery is currently disabled.</strong> LinkedIn People Finder is fully active. Add your Hunter API key in Settings whenever you wish to enable professional email discovery.
            </span>
          </div>
          <Link
            to="/settings"
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs transition shadow-2xs shrink-0 self-start sm:self-auto"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>Configure Hunter in Settings</span>
          </Link>
        </div>
      ) : hunterSettings?.status === 'credits_exhausted' ? (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Hunter quota limit reached (HTTP 402/429).</strong> LinkedIn People Finder continues working normally. Email verification is optional.
            </span>
          </div>
          <Link
            to="/settings"
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 font-semibold rounded-lg text-xs transition shrink-0 self-start sm:self-auto"
          >
            <span>View Settings</span>
          </Link>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Hunter API Connected</strong> ({hunterSettings.remainingSearches ?? 0} searches remaining). Optional 1-click email enrichment is ready for your discovered contacts.
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700 font-semibold">Key: {hunterSettings.maskedKey}</span>
        </div>
      )}

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode('single_company')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${
            mode === 'single_company'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Single Company Mode</span>
        </button>
        <button
          onClick={() => setMode('keyword_discovery')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${
            mode === 'keyword_discovery'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Keyword Discovery Mode (100+ Contacts Target)</span>
        </button>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
        {lastInterruptedJob && !activeJob && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Interrupted Task Detected:</strong> Previous LinkedIn discovery was interrupted ({lastInterruptedJob.error || 'Server restart'}).
              </span>
            </div>
            <button
              type="button"
              onClick={() => retryJob(lastInterruptedJob.jobId)}
              className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Task
            </button>
          </div>
        )}

        <form onSubmit={handleStartSearch} className="space-y-4">
          {/* Target Website Input (for Single Company Mode) */}
          {mode === 'single_company' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Company Website URL or Domain <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={websiteInput}
                  onChange={e => setWebsiteInput(e.target.value)}
                  placeholder="e.g. stripe.com or companydomain.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required={mode === 'single_company'}
                />
              </div>
            </div>
          )}

          {/* Keywords & Priority Decision-Maker Roles Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Priority Roles & Discovery Keywords <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Type role and press Enter or click +
              </span>
            </div>

            {/* Keyword Chips */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px]">
              {keywords.map(kw => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 text-blue-800 rounded-lg text-xs font-semibold shadow-xs"
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-blue-400 hover:text-blue-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="flex-1 min-w-[140px] flex items-center gap-1.5">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={handleAddKeyword}
                  placeholder="Add role (e.g. Procurement, Managing Director, CTO)..."
                  className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none px-1"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="p-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold"
                  title="Add role"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Optional Location, Industry, and Target Limit Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Location (Optional)
              </label>
              <input
                type="text"
                value={targetLocation}
                onChange={e => setTargetLocation(e.target.value)}
                placeholder="e.g. California, Seattle, London, Global"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Industry (Optional)
              </label>
              <input
                type="text"
                value={targetIndustry}
                onChange={e => setTargetIndustry(e.target.value)}
                placeholder="e.g. B2B SaaS, AgTech, FinTech, Manufacturing"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Contact Limit
              </label>
              <select
                value={resultLimit}
                onChange={e => setResultLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value={25}>25 contacts (Fastest)</option>
                <option value={50}>50 contacts</option>
                <option value={100}>100 contacts (Recommended Target)</option>
                <option value={250}>250 contacts (Deep Search)</option>
                <option value={500}>500 contacts (Exhaustive Network)</option>
              </select>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Independent Public LinkedIn Discovery · 100% Free · No Hunter required</span>
            </div>

            <div className="flex items-center gap-2">
              {isSearching && activeJob && (
                <button
                  type="button"
                  onClick={() => cancelJob(activeJob.jobId)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl text-xs border border-red-200 transition"
                >
                  <StopCircle className="w-4 h-4 text-red-600" />
                  <span>Cancel</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isSearching}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Discovering People ({searchStage || 'Processing'})...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Find LinkedIn Decision-Makers</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* KPI Stats Counters if Search Active */}
      {activeSearch && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Decision-Makers</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{activeSearch.actualDiscoveredCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Target: {activeSearch.requestedLimit}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs">
            <div className="text-[11px] font-bold text-blue-600 uppercase">LinkedIn Profiles</div>
            <div className="text-2xl font-extrabold text-blue-700 mt-1">
              {activeSearch.stats.linkedinProfilesFound ?? activeSearch.contacts.filter(c => Boolean(c.linkedinUrl)).length}
            </div>
            <div className="text-[10px] text-blue-500 mt-0.5">Verified profile URLs</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
            <div className="text-[11px] font-bold text-emerald-600 uppercase">Emails Discovered</div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              {activeSearch.stats.emailsFound ?? activeSearch.contacts.filter(c => Boolean(c.email)).length}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Verified via Hunter</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs">
            <div className="text-[11px] font-bold text-purple-600 uppercase">Verified Mailboxes</div>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">{activeSearch.stats.verified}</div>
            <div className="text-[10px] text-purple-500 mt-0.5">Deliverable SMTP</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Duplicates Filtered</div>
            <div className="text-2xl font-extrabold text-slate-700 mt-1">{activeSearch.stats.duplicatesRemoved}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Unique leadership only</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Sources Queried</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{activeSearch.sourcesUsed.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">LinkedIn, Directories</div>
          </div>
        </div>
      )}

      {/* RESULTS TABLE SECTION - MATCHING SPECIFICATION (Section 5) */}
      {activeSearch && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Table Toolbar & Bulk Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            {/* Left: Search input & Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Filter name, title, company, email..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium"
              >
                <option value="all">All Profiles ({contacts.length})</option>
                <option value="with_email">With Email ({contacts.filter(c => Boolean(c.email)).length})</option>
                <option value="no_email">Email Unavailable / Not Found ({contacts.filter(c => !c.email).length})</option>
                <option value="verified">Verified Deliverable ({activeSearch.stats.verified})</option>
                <option value="publicly_listed">Publicly Listed ({activeSearch.stats.publiclyListed})</option>
              </select>

              {uniqueDepartments.length > 0 && (
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium"
                >
                  <option value="all">All Departments</option>
                  {uniqueDepartments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Right: Bulk Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Optional On-Demand Email Enrichment via Hunter */}
              <button
                onClick={handleEnrichSelectedContacts}
                disabled={isEnrichingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                title={hunterSettings?.configured ? "Query Hunter.io to discover and verify emails for selected contacts" : "Configure Hunter in Settings first"}
              >
                {isEnrichingBulk ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AtSign className="w-3.5 h-3.5" />
                )}
                <span>
                  {selectedContactIds.size > 0
                    ? `Find Emails for Selected (${selectedContactIds.size})`
                    : 'Find Emails for Contacts'}
                </span>
              </button>

              <button
                onClick={copySelectedEmails}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                title="Copy valid emails to clipboard"
              >
                {copiedBulk ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBulk ? 'Copied!' : 'Copy Emails'}</span>
              </button>

              <button
                onClick={handleImportToLeads}
                disabled={importingToLeads}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                title="Import contacts into B2B Prospector leads"
              >
                {importingToLeads ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>Import to Prospector</span>
              </button>

              <a
                href={api.getEmailFinderExportCsvUrl(activeSearch.id)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
                title="Export results to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </a>

              <a
                href={api.getEmailFinderExportExcelUrl(activeSearch.id)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
                title="Export results to Excel spreadsheet (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel</span>
              </a>
            </div>
          </div>

          {/* TABLE MATCHING EXACT SPECIFICATION */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-2.5 px-3">Person Name</th>
                  <th className="py-2.5 px-3">Job Title</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Industry</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">LinkedIn Profile</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Email Status</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.map(c => {
                  const isSelected = selectedContactIds.has(c.id);
                  const isCopied = copiedEmail === c.email;
                  const isEnrichingThis = enrichingIds.has(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleContact(c.id)}
                          className="rounded border-slate-300"
                        />
                      </td>

                      {/* 1. Person Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {c.department}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Job Title */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{c.title}</div>
                      </td>

                      {/* 3. Company */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{c.company}</div>
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-mono text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          <span>{c.domain}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>

                      {/* 4. Industry */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                          {c.industry || 'Commercial Enterprise'}
                        </span>
                      </td>

                      {/* 5. Location */}
                      <td className="py-3 px-3 text-slate-600">
                        <div className="flex items-center gap-1 text-[11px]">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{c.location || 'Global / US'}</span>
                        </div>
                      </td>

                      {/* 6. LinkedIn Profile */}
                      <td className="py-3 px-3">
                        {c.linkedinUrl ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={c.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0077b5] hover:bg-[#005582] text-white rounded text-[10px] font-bold shadow-2xs transition"
                                title="Open verified LinkedIn profile"
                              >
                                <span>in</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                  c.verificationStatus === 'Verified'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : c.verificationStatus === 'Partially verified'
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : c.verificationStatus === 'Rejected'
                                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {c.verificationStatus || 'Unverified'}
                              </span>
                            </div>
                            {c.companyEvidence && (
                              <div
                                className="text-[10px] text-slate-500 font-sans italic max-w-[200px] truncate"
                                title={`Evidence: ${c.companyEvidence}`}
                              >
                                {c.companyEvidence}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* 7. Email */}
                      <td className="py-3 px-3">
                        {c.email ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-800">
                            <a
                              href={`mailto:${c.email}`}
                              className="hover:underline hover:text-blue-600 truncate max-w-[170px]"
                            >
                              {c.email}
                            </a>
                            <button
                              onClick={() => copySingleEmail(c.email!)}
                              className="text-slate-400 hover:text-blue-600 p-0.5"
                              title="Copy email"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Email not found
                          </span>
                        )}
                      </td>

                      {/* 8. Email Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.emailStatus === 'Verified'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.emailStatus === 'Publicly listed'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : c.emailStatus === 'Found but unverified'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {c.emailStatus === 'Unavailable' ? 'Unavailable' : c.emailStatus}
                        </span>
                      </td>

                      {/* 9. Source */}
                      <td className="py-3 px-3">
                        <div className="text-[11px] font-medium text-slate-700">{c.discoverySource}</div>
                        {c.sourceUrl && (
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-slate-400 hover:text-blue-600 hover:underline truncate max-w-[140px] block"
                            title={c.sourceUrl}
                          >
                            {c.sourceUrl.replace(/^https?:\/\//, '').substring(0, 22)}...
                          </a>
                        )}
                        {c.lastCheckedDate && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Checked: {new Date(c.lastCheckedDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!c.email && (
                            <button
                              onClick={() => handleEnrichSingleContact(c.id)}
                              disabled={isEnrichingThis}
                              className="flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded text-[11px] font-semibold transition disabled:opacity-50"
                              title="Find email using Hunter.io"
                            >
                              {isEnrichingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <AtSign className="w-3 h-3" />
                              )}
                              <span>Find Email</span>
                            </button>
                          )}
                          {c.email && (
                            <button
                              onClick={() => copySingleEmail(c.email!)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                              title="Copy email address"
                            >
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredContacts.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">No decision-makers match the current filter.</p>
                <p>Try resetting the search filters or execute a new query above.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailFinder;
