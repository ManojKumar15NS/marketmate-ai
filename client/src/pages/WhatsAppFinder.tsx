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
  AlertCircle,
  Star,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Map,
  Linkedin,
  Mail,
  UserCheck,
  Users,
  Compass,
  Briefcase,
  Award,
  HelpCircle,
  Layers,
  ChevronRight,
  PhoneForwarded,
  Info
} from 'lucide-react';
import { useJobs } from '../context/JobContext';
import { api } from '../services/api';
import { WhatsAppLead, WhatsAppSearchRun, B2BDecisionMaker, RoleCategory } from '../types';

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
    label: 'Healthcare / Hospital Booking & Inquiry',
    template: 'Hello {businessName}, I came across your healthcare center in {location} and would like to learn more about your services and appointment availability.'
  },
  {
    label: 'B2B Strategic Partnership',
    template: 'Hi {businessName} team, I am reaching out regarding a strategic growth and operational partnership opportunity in {location}. Can we connect briefly?'
  },
  {
    label: 'Vendor / Technology Procurement',
    template: 'Dear {businessName} leadership, we provide enterprise solutions tailored for {location} organizations. Could you direct me to your procurement or operations head?'
  }
];

export const WhatsAppFinder: React.FC = () => {
  // Inputs
  const [keywords, setKeywords] = useState('Eye Hospitals and Eye Clinics');
  const [location, setLocation] = useState('Bangalore');
  const [countryCode, setCountryCode] = useState('+91');
  const [limit, setLimit] = useState<number>(30);
  const [includeDecisionMakers, setIncludeDecisionMakers] = useState(true);
  const [messageTemplate, setMessageTemplate] = useState(PRESET_TEMPLATES[0].template);

  // Search state
  const [currentRun, setCurrentRun] = useState<WhatsAppSearchRun | null>(null);
  const [pastRuns, setPastRuns] = useState<WhatsAppSearchRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Active view tab & layout mode
  const [activeTab, setActiveTab] = useState<'companies' | 'decision_makers' | 'outreach' | 'coverage'>('companies');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Result filters
  const [searchFilter, setSearchFilter] = useState('');
  const [localityFilter, setLocalityFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [mobileOnlyFilter, setMobileOnlyFilter] = useState(false);
  const [highScoreOnlyFilter, setHighScoreOnlyFilter] = useState(false);
  const [hasDmFilter, setHasDmFilter] = useState(false);
  const [hasEmailFilter, setHasEmailFilter] = useState(false);

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
      console.warn('Could not load past searches:', err);
    }
  };

  const handleStartSearch = async (useBackground: boolean = false) => {
    if (!keywords.trim()) {
      setSearchError('Please specify an industry, business category or keywords.');
      return;
    }
    if (!location.trim()) {
      setSearchError('Please specify a target city or region.');
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
          messageTemplate,
          includeDecisionMakers
        });
      } else {
        const res = await api.searchWhatsApp({
          keywords: keywords.trim(),
          location: location.trim(),
          countryCode,
          limit,
          messageTemplate,
          includeDecisionMakers,
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

  // Distinct localities in active results
  const availableLocalities = Array.from(
    new Set((currentRun?.leads || []).map(l => l.locality || l.city).filter(Boolean))
  );

  // Filtered companies
  const displayedLeads = (currentRun?.leads || []).filter(lead => {
    if (mobileOnlyFilter && !lead.isMobile) return false;
    if (highScoreOnlyFilter && (lead.scores?.totalScore || 0) < 70) return false;
    if (hasDmFilter && (!lead.decisionMakers || lead.decisionMakers.length === 0)) return false;
    if (hasEmailFilter && (!lead.email && !lead.decisionMakers?.some(dm => dm.email))) return false;
    if (localityFilter !== 'all' && (lead.locality || lead.city) !== localityFilter) return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const inName = lead.businessName.toLowerCase().includes(q);
      const inPhone = lead.phoneRaw.includes(q) || lead.phoneInternational.includes(q);
      const inAddress = lead.address.toLowerCase().includes(q);
      const inLocality = (lead.locality || '').toLowerCase().includes(q);
      const inDm = (lead.decisionMakers || []).some(dm => dm.name.toLowerCase().includes(q) || dm.designation.toLowerCase().includes(q));
      return inName || inPhone || inAddress || inLocality || inDm;
    }
    return true;
  });

  // Extract all decision makers across displayed companies
  const allDecisionMakers: B2BDecisionMaker[] = (currentRun?.decisionMakers || []).filter(dm => {
    if (roleFilter !== 'all' && dm.roleCategory !== roleFilter) return false;
    if (hasEmailFilter && !dm.email) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        dm.name.toLowerCase().includes(q) ||
        dm.designation.toLowerCase().includes(q) ||
        dm.companyName.toLowerCase().includes(q) ||
        (dm.branchLocation || '').toLowerCase().includes(q)
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
        .replace(/\{location\}/gi, lead.locality || lead.city || location)
        .trim();
    }
    return `https://wa.me/${lead.phoneDigitsOnly}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 pb-16">
      {/* Top Banner / Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">B2B Business & Decision-Maker Intelligence Agent</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Multi-Zone Discovery
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Decision-Maker Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Large-scale geographic business discovery, leadership identification, E.164 phone verification, and WhatsApp outreach.
              </p>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <History className="w-3.5 h-3.5" />
              <span>Saved Searches ({pastRuns.length})</span>
            </button>
            <button
              onClick={() => setIsTemplateEditorOpen(!isTemplateEditorOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Outreach Template</span>
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
                <History className="w-4 h-4 text-emerald-600" /> Historical Discovery Searches
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
                      setLocation(run.city || run.location);
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
                        {run.stats.totalFound} companies ({run.stats.decisionMakersFound || 0} leaders, {run.stats.mobileVerified} mobile)
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
                <h2 className="text-sm font-bold tracking-tight">Personalized WhatsApp & Cold-Outreach Message Template</h2>
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

        {/* Advanced Discovery Search Criteria Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Keywords / Business Type */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Industry, Category or Keywords
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Eye Hospitals, Software Development, Dental Clinics"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">Specialty or service category</p>
            </div>

            {/* Target Location / City */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Target Metropolis or City
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bangalore, Mysore, Mumbai, Delhi, Dubai"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">Automated multi-zone geographic expansion applied</p>
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

            {/* Search Target Budget */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Target Leads Budget
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium bg-white"
              >
                <option value={15}>15 leads (Focused)</option>
                <option value={30}>30 leads (Multi-Zone)</option>
                <option value={50}>50 leads (City-Wide)</option>
                <option value={100}>100 leads (Exhaustive)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Multi-query target quota</p>
            </div>
          </div>

          {/* Options & Geographic Expansion Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDecisionMakers}
                  onChange={(e) => setIncludeDecisionMakers(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Identify Authorized Leadership & Decision-Makers (CEOs, Founders, Directors, Hospital Administrators)
                </span>
              </label>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Geographic Zoning Active (Indiranagar, Koramangala, Jayanagar, JP Nagar, Whitefield, etc.)</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Source Verified (Google Maps, Practo, Justdial, LinkedIn, Domains) • Zero fabricated records</span>
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm shadow-emerald-200 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing City-Wide B2B Discovery...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Discover Businesses & Leaders</span>
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
                  <span className="font-bold">B2B Intelligence Agent Active:</span>{' '}
                  <span>{activeJob.currentStage || 'Scanning commercial zones & executive registries...'}</span>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    Job ID: {activeJob.jobId} • Progress: {activeJob.progress}%
                  </div>
                </div>
              </div>
              <div className="w-36 bg-emerald-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results KPI Statistics Bar */}
        {currentRun && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Discovered</div>
              <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                {currentRun.stats.totalFound}
                <span className="text-xs font-semibold text-slate-400">places</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={currentRun.location}>
                Across {currentRun.city || currentRun.location}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Companies & Branches</div>
              <div className="text-2xl font-black text-emerald-600 mt-1 flex items-baseline gap-1.5">
                {currentRun.stats.uniqueCompanies || currentRun.leads.length}
                <span className="text-xs font-semibold text-emerald-700">unique</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {currentRun.stats.duplicatesRemoved || 0} duplicates merged
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Decision-Makers Found</div>
              <div className="text-2xl font-black text-indigo-600 mt-1 flex items-baseline gap-1.5">
                {currentRun.stats.decisionMakersFound || currentRun.decisionMakers?.length || 0}
                <span className="text-xs font-semibold text-indigo-700">leaders</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Founders, CEOs & Directors</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Ready (Mobile)</div>
              <div className="text-2xl font-black text-teal-600 mt-1 flex items-baseline gap-1.5">
                {currentRun.stats.mobileVerified}
                <span className="text-xs font-semibold text-teal-700">
                  {currentRun.stats.totalFound > 0 ? Math.round((currentRun.stats.mobileVerified / currentRun.stats.totalFound) * 100) : 0}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Cellular numbers verified</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Professional Emails</div>
              <div className="text-2xl font-black text-purple-600 mt-1 flex items-baseline gap-1.5">
                {currentRun.stats.professionalEmailsFound || currentRun.leads.filter(l => l.email || l.decisionMakers?.some(dm => dm.email)).length}
                <span className="text-xs font-semibold text-purple-700">emails</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Public business contacts</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Confidence Leads</div>
              <div className="text-2xl font-black text-blue-600 mt-1 flex items-baseline gap-1.5">
                {currentRun.stats.highConfidence}
                <span className="text-xs font-semibold text-blue-700">verified</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Lead score &ge; 70/100</div>
            </div>
          </div>
        )}

        {/* Intelligence Dashboard Tabs & Leads Showcase */}
        {currentRun && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Top Navigation Tabs */}
            <div className="border-b border-slate-200 px-4 pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0">
                <button
                  onClick={() => setActiveTab('companies')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition border ${
                    activeTab === 'companies'
                      ? 'bg-white text-emerald-800 border-slate-200 shadow-xs'
                      : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Companies & Branches ({displayedLeads.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('decision_makers')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition border ${
                    activeTab === 'decision_makers'
                      ? 'bg-white text-indigo-800 border-slate-200 shadow-xs'
                      : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Decision-Makers & Leaders ({allDecisionMakers.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('outreach')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition border ${
                    activeTab === 'outreach'
                      ? 'bg-white text-teal-800 border-slate-200 shadow-xs'
                      : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-teal-600" />
                  <span>WhatsApp & Cold Outreach</span>
                </button>

                <button
                  onClick={() => setActiveTab('coverage')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition border ${
                    activeTab === 'coverage'
                      ? 'bg-white text-purple-800 border-slate-200 shadow-xs'
                      : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Compass className="w-4 h-4 text-purple-600" />
                  <span>Search Coverage & Sources</span>
                </button>
              </div>

              {/* View Switcher & Multi-Format Export Dropdown */}
              <div className="flex items-center gap-2 pb-2 md:pb-0">
                {activeTab === 'companies' && (
                  <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 rounded-md transition ${
                        viewMode === 'cards'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Card / Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-md transition ${
                        viewMode === 'table'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Table View"
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* 1-Tap Smartphone Contacts Sync (.vcf) */}
                <a
                  href={api.getWhatsAppExportUrl('vcf', currentRun.id)}
                  download
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg border border-emerald-300 transition shadow-xs"
                  title="Import contacts with names, titles, and WhatsApp links into your smartphone"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="hidden sm:inline">vCard (.vcf)</span>
                </a>

                {/* Excel Multi-Sheet Export */}
                <a
                  href={api.getWhatsAppExportUrl('xlsx', currentRun.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition shadow-xs"
                  title="Download complete styled Excel workbook with Companies, Decision-Makers and CRM Ready tabs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </a>

                {/* CRM Formats Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CRM CSV</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        Export CRM Ready
                      </div>
                      <a
                        href={api.getWhatsAppExportUrl('csv', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="block px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                      >
                        Standard CSV (.csv)
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('hubspot', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="block px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                      >
                        HubSpot CRM Import
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('salesforce', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="block px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                      >
                        Salesforce Leads CSV
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('zoho', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="block px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                      >
                        Zoho CRM Leads CSV
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/30">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Text */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search companies, leaders, phones, areas..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52 md:w-64 font-medium"
                  />
                </div>

                {/* Locality Filter */}
                {availableLocalities.length > 1 && (
                  <select
                    value={localityFilter}
                    onChange={(e) => setLocalityFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Localities ({availableLocalities.length} zones)</option>
                    {availableLocalities.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                )}

                {/* Role Filter (when in Decision-Makers tab) */}
                {activeTab === 'decision_makers' && (
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Leadership Roles</option>
                    <option value="founder">Founders & Owners</option>
                    <option value="c_level">C-Level (CEOs, COOs)</option>
                    <option value="medical_director">Medical Directors</option>
                    <option value="director">Directors & Administrators</option>
                    <option value="head_of_dept">Heads & Operations</option>
                    <option value="manager">Managers</option>
                  </select>
                )}

                {/* Toggle Pills */}
                <button
                  onClick={() => setMobileOnlyFilter(!mobileOnlyFilter)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    mobileOnlyFilter
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Mobile / WhatsApp Only
                </button>

                <button
                  onClick={() => setHasDmFilter(!hasDmFilter)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    hasDmFilter
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Decision-Maker Found
                </button>

                <button
                  onClick={() => setHasEmailFilter(!hasEmailFilter)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    hasEmailFilter
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Email Available
                </button>

                <button
                  onClick={() => setHighScoreOnlyFilter(!highScoreOnlyFilter)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    highScoreOnlyFilter
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Score &ge; 70
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                Showing <span className="font-bold text-slate-800">{activeTab === 'decision_makers' ? allDecisionMakers.length : displayedLeads.length}</span> results
              </div>
            </div>

            {/* TAB CONTENT 1: COMPANIES & BRANCHES */}
            {activeTab === 'companies' && (
              displayedLeads.length === 0 ? (
                <div className="text-center py-14 px-4">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-700">No companies match your active filters</h3>
                  <p className="text-xs text-slate-400 mt-1">Try clearing some filters or searching a broader city.</p>
                </div>
              ) : viewMode === 'cards' ? (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/30">
                  {displayedLeads.map(lead => {
                    const waUrl = getDynamicWhatsAppUrl(lead);
                    const fitScore = lead.scores?.companyFitScore || 75;
                    const qualityScore = lead.scores?.contactQualityScore || 75;
                    const totalScore = lead.scores?.totalScore || 75;
                    const dms = lead.decisionMakers || [];

                    return (
                      <div
                        key={lead.id}
                        className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3"
                      >
                        {/* Header: Company & Scores */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                                {lead.businessName}
                              </h3>
                              {lead.brandName && lead.brandName !== lead.businessName && (
                                <span className="inline-block text-[10px] text-slate-400 mt-0.5 font-medium">
                                  Part of <span className="font-semibold text-slate-600">{lead.brandName}</span>
                                </span>
                              )}
                            </div>

                            {/* Lead Score Badge */}
                            <div
                              className={`px-2 py-1 rounded-lg text-center shrink-0 border ${
                                totalScore >= 75
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : totalScore >= 50
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                              title={`Fit: ${fitScore}/100 | Quality: ${qualityScore}/100`}
                            >
                              <div className="text-[10px] font-bold uppercase tracking-tight">Score</div>
                              <div className="text-sm font-black leading-none">{totalScore}</div>
                            </div>
                          </div>

                          {/* Locality & Branch Badge */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {lead.locality && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{lead.locality}</span>
                              </span>
                            )}

                            <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                              {lead.category}
                            </span>

                            {lead.rating && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{lead.rating}</span>
                              </span>
                            )}
                          </div>

                          {/* Address */}
                          <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-2.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed text-[11px]">{lead.address}</span>
                          </div>
                        </div>

                        {/* Decision-Makers Snapshot */}
                        {dms.length > 0 ? (
                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 space-y-1.5">
                            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Key Decision-Maker:
                            </div>
                            <div className="text-xs font-bold text-slate-900">{dms[0].name}</div>
                            <div className="text-[11px] text-slate-600 leading-tight">{dms[0].designation}</div>
                            <div className="flex items-center gap-2 pt-0.5">
                              {dms[0].linkedinUrl && (
                                <a
                                  href={dms[0].linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-sky-700 font-semibold flex items-center gap-0.5 hover:underline"
                                >
                                  <Linkedin className="w-2.5 h-2.5" /> LinkedIn
                                </a>
                              )}
                              {dms[0].email && (
                                <span className="text-[10px] text-purple-700 font-semibold flex items-center gap-0.5">
                                  <Mail className="w-2.5 h-2.5" /> {dms[0].email}
                                </span>
                              )}
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">
                                {dms[0].employmentStatus}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-[11px] text-slate-500 flex items-center justify-between">
                            <span>Main Reception / Desk Line Available</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-slate-200 text-slate-600">Reception Line</span>
                          </div>
                        )}

                        {/* Phone & Direct Links */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lead.phoneInternational || lead.phoneRaw || 'Desk Line Sourced'}</span>
                            </div>
                            <button
                              onClick={() => handleCopy(lead.phoneInternational || lead.phoneRaw, `p_${lead.id}`)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition"
                              title="Copy Phone"
                            >
                              {copiedId === `p_${lead.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Line Status Tag */}
                          <div>
                            {lead.isMobile ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Smartphone className="w-3 h-3" /> Cellular Mobile (WhatsApp Ready)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                <PhoneCall className="w-3 h-3" /> Direct Commercial Line
                              </span>
                            )}
                          </div>

                          {/* External Links */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            {lead.googleProfileUrl && (
                              <a
                                href={lead.googleProfileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-medium transition"
                              >
                                <Map className="w-3 h-3 text-blue-600" />
                                <span>Google Maps</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              </a>
                            )}

                            {lead.website && (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition"
                              >
                                <Globe className="w-3 h-3 text-slate-500" />
                                <span>Website</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              </a>
                            )}
                          </div>

                          {/* 1-Tap Direct WhatsApp Chat */}
                          <div className="pt-1">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-200 transition"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Chat on WhatsApp</span>
                              <ExternalLink className="w-3 h-3 opacity-80" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* TABLE VIEW */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Company & Branch</th>
                        <th className="py-3 px-4">Locality / Zone</th>
                        <th className="py-3 px-4">Lead Score</th>
                        <th className="py-3 px-4">Key Decision-Maker</th>
                        <th className="py-3 px-4">Phone & Line Type</th>
                        <th className="py-3 px-4">WhatsApp Direct</th>
                        <th className="py-3 px-4">Maps & Web</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedLeads.map(lead => {
                        const waUrl = getDynamicWhatsAppUrl(lead);
                        const dms = lead.decisionMakers || [];
                        const topDm = dms[0];
                        const totalScore = lead.scores?.totalScore || 75;

                        return (
                          <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 max-w-[200px]">
                              <div className="font-bold text-slate-900">{lead.businessName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{lead.category}</div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <MapPin className="w-3 h-3 text-emerald-600" />
                                {lead.locality || lead.city}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                                  totalScore >= 75
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {totalScore}/100
                              </span>
                            </td>

                            <td className="py-3.5 px-4 max-w-[180px]">
                              {topDm ? (
                                <div>
                                  <div className="font-bold text-slate-900 truncate">{topDm.name}</div>
                                  <div className="text-[10px] text-slate-500 truncate">{topDm.designation}</div>
                                  {topDm.linkedinUrl && (
                                    <a
                                      href={topDm.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-sky-600 hover:underline flex items-center gap-0.5 mt-0.5"
                                    >
                                      <Linkedin className="w-2.5 h-2.5" /> LinkedIn
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Desk Line Available</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-mono font-semibold text-slate-800">
                                {lead.phoneInternational || lead.phoneRaw}
                              </div>
                              <div className="mt-0.5">
                                {lead.isMobile ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    Mobile Line
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500">Commercial Line</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chat</span>
                                <ExternalLink className="w-3 h-3 opacity-80" />
                              </a>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1">
                                {lead.googleProfileUrl && (
                                  <a
                                    href={lead.googleProfileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <Map className="w-3 h-3 text-blue-500" /> Maps
                                  </a>
                                )}
                                {lead.website && (
                                  <a
                                    href={lead.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-slate-600 hover:underline flex items-center gap-1"
                                  >
                                    <Globe className="w-3 h-3 text-slate-400" /> Website
                                  </a>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleCopy(waUrl, `w_${lead.id}`)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
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
              )
            )}

            {/* TAB CONTENT 2: AUTHORIZED DECISION-MAKERS */}
            {activeTab === 'decision_makers' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      Authorized Key Decision-Makers & Executive Registry
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Identified founders, managing directors, hospital administrators, operations heads, and medical specialists.
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    {allDecisionMakers.length} Executives Discovered
                  </div>
                </div>

                {allDecisionMakers.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-700">No decision-makers matched your filters</h3>
                    <p className="text-xs text-slate-400 mt-1">Make sure "Identify Authorized Leadership" was enabled during the search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allDecisionMakers.map(dm => (
                      <div
                        key={dm.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-md hover:border-indigo-300 transition flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">{dm.name}</h3>
                              <p className="text-xs font-semibold text-indigo-700 mt-0.5">{dm.designation}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                dm.employmentStatus === 'verified'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : dm.employmentStatus === 'partially_verified'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {dm.employmentStatus}
                            </span>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold">{dm.companyName}</span>
                            </div>

                            {dm.branchLocation && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{dm.branchLocation}</span>
                              </div>
                            )}

                            {dm.email && (
                              <div className="text-xs text-purple-700 font-medium flex items-center gap-1.5 pt-1">
                                <Mail className="w-3.5 h-3.5 text-purple-500" />
                                <span className="font-mono">{dm.email}</span>
                              </div>
                            )}

                            {dm.phone && (
                              <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="font-mono">{dm.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          {dm.linkedinUrl ? (
                            <a
                              href={dm.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-semibold transition"
                            >
                              <Linkedin className="w-3.5 h-3.5 text-sky-600" />
                              <span>View LinkedIn Profile</span>
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No LinkedIn profile found</span>
                          )}

                          <div className="text-[10px] font-bold text-slate-400">
                            Confidence: <span className="text-slate-800 font-bold">{dm.confidenceScore}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: OUTREACH & COLD CALLING */}
            {activeTab === 'outreach' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-teal-600" />
                      1-Tap Outreach & Phone Verification Registry
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Classified contact lines, WhatsApp direct chat links, and cold-calling prep for sales representatives.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedLeads.map(lead => {
                    const waUrl = getDynamicWhatsAppUrl(lead);

                    return (
                      <div
                        key={lead.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{lead.businessName}</h3>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{lead.locality || lead.city}</span>
                            </div>
                          </div>

                          {lead.isMobile ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-emerald-600" /> WhatsApp Ready
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">
                              Landline Line
                            </span>
                          )}
                        </div>

                        {/* Phone Display & Action */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</div>
                            <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                              {lead.phoneInternational || lead.phoneRaw}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopy(lead.phoneInternational || lead.phoneRaw, `out_p_${lead.id}`)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                            >
                              {copiedId === `out_p_${lead.id}` ? 'Copied' : 'Copy'}
                            </button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Open WhatsApp</span>
                            </a>
                          </div>
                        </div>

                        {/* Outreach Message Preview */}
                        <div className="text-xs text-slate-600 bg-emerald-50/40 border border-emerald-100 rounded-lg p-2.5">
                          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                            Pre-Filled Message Preview:
                          </div>
                          <p className="font-mono text-[11px] text-slate-700 line-clamp-2">
                            {messageTemplate
                              .replace(/\{businessName\}/gi, lead.businessName)
                              .replace(/\{location\}/gi, lead.locality || lead.city)
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: SEARCH COVERAGE & SOURCES */}
            {activeTab === 'coverage' && (
              <div className="p-5 space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-purple-600" />
                    Geographic Search Coverage & Multi-Source Audit
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Transparent breakdown of geographic localities scanned, data sources queried, and deduplication statistics.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Coverage Stats Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Search Scope</h3>
                    <div className="text-xs space-y-1 text-slate-600 pt-1">
                      <div className="flex justify-between">
                        <span>Target City:</span>
                        <span className="font-bold text-slate-800">{currentRun.city || currentRun.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Requested Quota:</span>
                        <span className="font-bold text-slate-800">{currentRun.requestedLimit} leads</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Actual Discovered:</span>
                        <span className="font-bold text-emerald-700">{currentRun.actualDiscoveredCount} verified</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duplicates Merged:</span>
                        <span className="font-bold text-blue-700">{currentRun.stats.duplicatesRemoved || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Local Zones Scanned */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Localities & Zones Scanned ({currentRun.coverage?.zonesCompleted?.length || availableLocalities.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-40 overflow-y-auto">
                      {(currentRun.coverage?.zonesCompleted || availableLocalities).map((z, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded text-slate-700">
                          {z}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sources Queried */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Directories & Sources</h3>
                    <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4 pt-1">
                      <li>Google Maps & Business Profiles</li>
                      <li>Google Search Grounding (Gemini 2.5 Flash)</li>
                      <li>Practo & Justdial Registries</li>
                      <li>Sulekha & IndiaMART B2B Directories</li>
                      <li>LinkedIn Public Executive Profiles</li>
                      <li>Official Company Domains</li>
                    </ul>
                  </div>
                </div>

                {/* Transparency Disclaimer Notice */}
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold">Public Data & Coverage Transparency Notice</h4>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      MarketMate AI collects commercial business contacts and leadership records exclusively from indexed public directories, official company domains, Google Business profiles, and public professional networks. We never promise that every single establishment in a multi-million resident metropolis has been retrieved. Results reflect verified public availability at the time of query.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppFinder;
