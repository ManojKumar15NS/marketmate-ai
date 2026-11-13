import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  PhoneCall,
  MapPin,
  Building2,
  Search,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  Filter,
  Sparkles,
  RefreshCw,
  Loader2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Send,
  FileText,
  Smartphone,
  Globe,
  SlidersHorizontal,
  CheckCircle2,
  History,
  AlertCircle
} from 'lucide-react';
import { useJobs } from '../context/JobContext';
import { api } from '../services/api';
import { WhatsAppLead, WhatsAppSearchRun } from '../types';

const COUNTRY_OPTIONS = [
  { code: '+91', name: 'India (+91)', flag: '🇮🇳' },
  { code: '+1', name: 'USA / Canada (+1)', flag: '🇺🇸' },
  { code: '+971', name: 'United Arab Emirates (+971)', flag: '🇦🇪' },
  { code: '+44', name: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: '+61', name: 'Australia (+61)', flag: '🇦🇺' },
  { code: '+65', name: 'Singapore (+65)', flag: '🇸🇬' },
  { code: '+966', name: 'Saudi Arabia (+966)', flag: '🇸🇦' },
  { code: '+49', name: 'Germany (+49)', flag: '🇩🇪' },
  { code: '+33', name: 'France (+33)', flag: '🇫🇷' },
  { code: '+81', name: 'Japan (+81)', flag: '🇯🇵' },
  { code: '+60', name: 'Malaysia (+60)', flag: '🇲🇾' },
];

const PRESET_TEMPLATES = [
  {
    label: 'Service Inquiry',
    template: 'Hello {businessName}, I came across your business in {location} and would like to learn more about your services.'
  },
  {
    label: 'Consultation & Booking',
    template: 'Hi {businessName}, I would like to schedule an appointment or consultation at your {location} center. Please let me know available slots.'
  },
  {
    label: 'B2B Growth Partnership',
    template: 'Hi {businessName} team, I am reaching out regarding a marketing and operational partnership opportunity in {location}. Can we connect briefly?'
  }
];

export const WhatsAppFinder: React.FC = () => {
  // Inputs
  const [keywords, setKeywords] = useState('Eye Hospital');
  const [location, setLocation] = useState('Indiranagar, Bangalore');
  const [countryCode, setCountryCode] = useState('+91');
  const [limit, setLimit] = useState<number>(15);
  const [messageTemplate, setMessageTemplate] = useState(PRESET_TEMPLATES[0].template);

  // Search state
  const [currentRun, setCurrentRun] = useState<WhatsAppSearchRun | null>(null);
  const [pastRuns, setPastRuns] = useState<WhatsAppSearchRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Result filters
  const [searchFilter, setSearchFilter] = useState('');
  const [mobileOnlyFilter, setMobileOnlyFilter] = useState(false);
  const [highConfidenceFilter, setHighConfidenceFilter] = useState(false);

  // Background jobs hook
  const { jobs, startJob } = useJobs();
  const activeJob = jobs.find(j => j.agentId === 'whatsapp' && (j.status === 'running' || j.status === 'queued'));

  // Load past searches on mount
  useEffect(() => {
    loadPastSearches();
  }, []);

  // Update current run if background job completes
  useEffect(() => {
    if (activeJob?.status === 'completed' && activeJob.result) {
      try {
        const parsed = JSON.parse(activeJob.result);
        if (parsed.leads) {
          setCurrentRun(parsed);
          loadPastSearches();
        }
      } catch {
        // ignore
      }
    }
  }, [activeJob?.status, activeJob?.result]);

  const loadPastSearches = async () => {
    try {
      const res = await api.getWhatsAppSearches();
      if (res.success && res.data) {
        setPastRuns(res.data);
        if (!currentRun && res.data.length > 0) {
          setCurrentRun(res.data[0]);
        }
      }
    } catch (err) {
      console.warn('Could not load past WhatsApp searches:', err);
    }
  };

  const handleStartSearch = async (useBackground: boolean = false) => {
    if (!keywords.trim()) {
      setSearchError('Please specify a business keyword or service category.');
      return;
    }
    if (!location.trim()) {
      setSearchError('Please specify a location (e.g., city, area).');
      return;
    }

    setSearchError(null);
    setIsLoading(true);

    try {
      if (useBackground) {
        await startJob('whatsapp', {
          keywords: keywords.trim(),
          location: location.trim(),
          countryCode,
          limit,
          messageTemplate
        });
      } else {
        const res = await api.searchWhatsApp({
          keywords: keywords.trim(),
          location: location.trim(),
          countryCode,
          limit,
          messageTemplate,
          asyncJob: false
        });

        if (res.success && 'leads' in res.data) {
          setCurrentRun(res.data as WhatsAppSearchRun);
          loadPastSearches();
        }
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteSearch = async (id: string) => {
    try {
      await api.deleteWhatsAppSearch(id);
      setPastRuns(prev => prev.filter(r => r.id !== id));
      if (currentRun?.id === id) {
        const remaining = pastRuns.filter(r => r.id !== id);
        setCurrentRun(remaining[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  // Filtered leads
  const displayedLeads = (currentRun?.leads || []).filter(lead => {
    if (mobileOnlyFilter && !lead.isMobile) return false;
    if (highConfidenceFilter && lead.confidence !== 'high') return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        lead.businessName.toLowerCase().includes(q) ||
        lead.phoneRaw.includes(q) ||
        lead.address.toLowerCase().includes(q) ||
        lead.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate dynamic WhatsApp URL with active template
  const getDynamicWhatsAppUrl = (lead: WhatsAppLead) => {
    if (!lead.phoneDigitsOnly) return '#';
    let msg = '';
    if (messageTemplate && messageTemplate.trim()) {
      msg = messageTemplate
        .replace(/\{businessName\}/gi, lead.businessName)
        .replace(/\{location\}/gi, lead.city || location)
        .trim();
    }
    return `https://wa.me/${lead.phoneDigitsOnly}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">WhatsApp Number Finder</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Specialist Agent
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                  E.164 Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Discover verified WhatsApp business numbers, physical locations, and 1-click chat links by keywords and location.
              </p>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <History className="w-3.5 h-3.5" />
              <span>Past Searches ({pastRuns.length})</span>
            </button>
            <button
              onClick={() => setIsTemplateEditorOpen(!isTemplateEditorOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Message Template</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Past Searches Drawer */}
        {showHistory && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" /> Past Discovery Runs
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
            {pastRuns.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No past searches saved yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3">
                {pastRuns.map(run => (
                  <div
                    key={run.id}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition flex items-center justify-between ${
                      currentRun?.id === run.id
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                    onClick={() => {
                      setCurrentRun(run);
                      setKeywords(run.keywords);
                      setLocation(run.location);
                      setCountryCode(run.countryCode);
                    }}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{run.keywords}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{run.location}</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        {run.stats.totalFound} numbers found ({run.stats.mobileVerified} mobile)
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSearch(run.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Delete search"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Template Customizer Card */}
        {isTemplateEditorOpen && (
          <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold tracking-tight">Personalized WhatsApp Outreach Template</h2>
              </div>
              <button
                onClick={() => setIsTemplateEditorOpen(false)}
                className="text-xs text-emerald-300 hover:text-white"
              >
                Hide
              </button>
            </div>
            <p className="text-xs text-emerald-100">
              When you click "Chat on WhatsApp", this pre-filled message is automatically loaded in the WhatsApp chat.
              Use <code className="bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-300">{"{businessName}"}</code> and{' '}
              <code className="bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-300">{"{location}"}</code> for dynamic personalization.
            </p>

            <div className="flex flex-wrap gap-2">
              {PRESET_TEMPLATES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setMessageTemplate(p.template)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                    messageTemplate === p.template
                      ? 'bg-emerald-400 text-slate-900 font-bold'
                      : 'bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={3}
              className="w-full text-xs font-mono bg-emerald-950/70 border border-emerald-700 rounded-lg p-3 text-white placeholder-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Write your custom message..."
            />
          </div>
        )}

        {/* Search & Criteria Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Keywords / Business Type */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Business Category or Keywords
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Eye Hospital, Dental Clinic, Interior Designers"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">Specialty or service category</p>
            </div>

            {/* Target Location */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Target Location (City / Area)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Indiranagar, Bangalore, or South Mumbai"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">Geocoded against OpenStreetMap Nominatim</p>
            </div>

            {/* Country Code */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Country Code
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium bg-white"
              >
                {COUNTRY_OPTIONS.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">For E.164 normalization</p>
            </div>

            {/* Result Limit */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Limit Leads
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium bg-white"
              >
                <option value={10}>10 contacts</option>
                <option value={15}>15 contacts</option>
                <option value={25}>25 contacts</option>
                <option value={40}>40 contacts</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Live web extraction target</p>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero fabricated entries • Live citations & map verified</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleStartSearch(true)}
                disabled={isLoading || Boolean(activeJob)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-50"
              >
                <span>Run in Background</span>
              </button>
              <button
                onClick={() => handleStartSearch(false)}
                disabled={isLoading || Boolean(activeJob)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Discovering WhatsApp Numbers...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Find WhatsApp Numbers</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {searchError && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Active Background Job Indicator */}
          {activeJob && (
            <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <div>
                  <span className="font-bold">Background WhatsApp Agent Active:</span>{' '}
                  <span>{activeJob.currentStage || 'Scanning commercial directories...'}</span>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    Job ID: {activeJob.jobId} • Progress: {activeJob.progress}%
                  </div>
                </div>
              </div>
              <div className="w-32 bg-emerald-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results KPI Statistics */}
        {currentRun && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Discovered</div>
              <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                {currentRun.stats.totalFound}
                <span className="text-xs font-semibold text-slate-400">contacts</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                In {currentRun.location}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mobile / WhatsApp Ready</div>
              <div className="text-2xl font-black text-emerald-600 mt-1 flex items-baseline gap-2">
                {currentRun.stats.mobileVerified}
                <span className="text-xs font-semibold text-emerald-700">
                  {currentRun.stats.totalFound > 0 ? Math.round((currentRun.stats.mobileVerified / currentRun.stats.totalFound) * 100) : 0}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Cellular numbers verified</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">High Confidence</div>
              <div className="text-2xl font-black text-blue-600 mt-1 flex items-baseline gap-2">
                {currentRun.stats.highConfidence}
                <span className="text-xs font-semibold text-blue-700">verified</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Direct listings & web cited</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Websites Identified</div>
              <div className="text-2xl font-black text-violet-600 mt-1 flex items-baseline gap-2">
                {currentRun.stats.withWebsite}
                <span className="text-xs font-semibold text-violet-700">sites</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Official domain presence</div>
            </div>
          </div>
        )}

        {/* Results Toolbar & Leads Table */}
        {currentRun && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Table Header / Action Toolbar */}
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter results..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 md:w-60"
                  />
                </div>

                <button
                  onClick={() => setMobileOnlyFilter(!mobileOnlyFilter)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    mobileOnlyFilter
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Mobile Only
                </button>
                <button
                  onClick={() => setHighConfidenceFilter(!highConfidenceFilter)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    highConfidenceFilter
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  High Confidence
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                {/* 1-Tap Smartphone Contacts Sync (.vcf) */}
                <a
                  href={api.getWhatsAppExportUrl('vcf', currentRun.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg border border-emerald-300 transition shadow-sm"
                  title="Download vCard file to add all contacts directly to your smartphone WhatsApp"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Download vCard (.vcf)</span>
                </a>

                {/* CSV Download */}
                <a
                  href={api.getWhatsAppExportUrl('csv', currentRun.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </a>

                {/* Excel Download */}
                <a
                  href={api.getWhatsAppExportUrl('xlsx', currentRun.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel (.xlsx)</span>
                </a>
              </div>
            </div>

            {/* Leads Table */}
            {displayedLeads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No leads match your current filter</h3>
                <p className="text-xs text-slate-400 mt-1">Try clearing filters or running a new search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Business / Organization</th>
                      <th className="py-3 px-4">Contact Phone & E.164</th>
                      <th className="py-3 px-4">WhatsApp Direct Chat</th>
                      <th className="py-3 px-4">Address / Location</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedLeads.map((lead) => {
                      const waUrl = getDynamicWhatsAppUrl(lead);

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                          {/* Business Name & Category */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{lead.businessName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">
                                {lead.category}
                              </span>
                              {lead.website && (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                                >
                                  <Globe className="w-3 h-3" />
                                  <span>Website</span>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Phone & International */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800">
                              <span>{lead.phoneInternational || lead.phoneRaw}</span>
                              <button
                                onClick={() => handleCopy(lead.phoneInternational || lead.phoneRaw, `p_${lead.id}`)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                                title="Copy Phone Number"
                              >
                                {copiedId === `p_${lead.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {lead.isMobile ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Smartphone className="w-2.5 h-2.5" /> Mobile (WhatsApp Ready)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                  <PhoneCall className="w-2.5 h-2.5" /> Direct Contact Line
                                </span>
                              )}
                            </div>
                          </td>

                          {/* WhatsApp Direct Chat Button */}
                          <td className="py-3.5 px-4">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Chat on WhatsApp</span>
                              <ExternalLink className="w-3 h-3 opacity-80" />
                            </a>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono truncate max-w-[200px]" title={waUrl}>
                              wa.me/{lead.phoneDigitsOnly}
                            </div>
                          </td>

                          {/* Address & City */}
                          <td className="py-3.5 px-4">
                            <div className="text-slate-700 font-medium max-w-[220px] truncate" title={lead.address}>
                              {lead.address}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{lead.city || currentRun.location}</span>
                            </div>
                          </td>

                          {/* Confidence */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                lead.confidence === 'high'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {lead.confidence}
                            </span>
                            {lead.sourceUrl && (
                              <div className="mt-1">
                                <a
                                  href={lead.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 truncate max-w-[120px]"
                                  title={lead.sourceTitle || lead.sourceUrl}
                                >
                                  <span>Source listing</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleCopy(waUrl, `w_${lead.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                              title="Copy WhatsApp Chat Link"
                            >
                              {copiedId === `w_${lead.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700 font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppFinder;
