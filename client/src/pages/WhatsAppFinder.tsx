import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  Phone,
  Globe,
  MapPin,
  Star,
  CheckCircle2,
  Download,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Copy,
  Check,
  Send,
  MessageSquare,
  ShieldCheck,
  Briefcase,
  Mail,
  Linkedin,
  ChevronDown,
  ChevronRight,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  RotateCw,
  Loader2,
  FileSpreadsheet,
  FileText,
  Smartphone,
  Info,
  AlertCircle,
  History,
  X,
  Compass
} from 'lucide-react';
import { api } from '../services/api';
import { useJobs } from '../context/JobContext';
import { CompanyDetailModal } from '../components/CompanyDetailModal';
import { WhatsAppLead, WhatsAppSearchRun, B2BDecisionMaker, RoleCategory } from '../types';

export interface CountryOption {
  name: string;
  code: string;
  flag: string;
}

export const WORLD_COUNTRIES: CountryOption[] = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'Ireland', code: '+353', flag: '🇮🇪' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Philippines', code: '+63', flag: '🇵🇭' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { name: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Oman', code: '+968', flag: '🇴🇲' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
  { name: 'Mexico', code: '+52', flag: '🇲🇽' },
  { name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { name: 'Chile', code: '+56', flag: '🇨🇱' },
  { name: 'Colombia', code: '+57', flag: '🇨🇴' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { name: 'Poland', code: '+48', flag: '🇵🇱' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { name: 'Kenya', code: '+254', flag: '🇰🇪' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬' },
  { name: 'Israel', code: '+972', flag: '🇮🇱' },
  { name: 'Vietnam', code: '+84', flag: '🇻🇳' },
  { name: 'Thailand', code: '+66', flag: '🇹🇭' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { name: 'Hong Kong', code: '+852', flag: '🇭🇰' },
  { name: 'Norway', code: '+47', flag: '🇳🇴' },
  { name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { name: 'Finland', code: '+358', flag: '🇫🇮' },
  { name: 'Belgium', code: '+32', flag: '🇧🇪' },
  { name: 'Austria', code: '+43', flag: '🇦🇹' },
  { name: 'Portugal', code: '+351', flag: '🇵🇹' }
];

export const WhatsAppFinder: React.FC = () => {
  // Simplified Search Inputs (clean start, customizable for any business & location)
  const [keywords, setKeywords] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(WORLD_COUNTRIES[0]);
  const [city, setCity] = useState('');
  const [includeDecisionMakers, setIncludeDecisionMakers] = useState(true);

  // Search execution & active run state
  const [currentRun, setCurrentRun] = useState<WhatsAppSearchRun | null>(null);
  const [pastRuns, setPastRuns] = useState<WhatsAppSearchRun[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [discoveryStage, setDiscoveryStage] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [buttonState, setButtonState] = useState<'idle' | 'discovering' | 'completed' | 'retry'>('idle');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'businesses' | 'decision_makers' | 'contacts' | 'sources'>('businesses');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedLeadForModal, setSelectedLeadForModal] = useState<WhatsAppLead | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter criteria
  const [searchFilter, setSearchFilter] = useState('');
  const [localityFilter, setLocalityFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [mobileOnlyFilter, setMobileOnlyFilter] = useState(false);
  const [emailOnlyFilter, setEmailOnlyFilter] = useState(false);
  const [highScoreOnlyFilter, setHighScoreOnlyFilter] = useState(false);

  // Background jobs hook
  const { jobs, startJob } = useJobs();

  // Load past searches on mount
  useEffect(() => {
    loadPastSearches();
  }, []);

  // Poll active background job until completion
  useEffect(() => {
    if (!activeJobId) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await api.getJob(activeJobId);
        if (!isSubscribed) return;

        if (res && res.success && res.data) {
          const job = res.data;
          setDiscoveryProgress(job.progress || 0);
          setDiscoveryStage(job.currentStage || 'Discovering verified establishments, Google Maps data & leadership...');

          if (job.status === 'completed') {
            setIsDiscovering(false);
            setButtonState('completed');
            setActiveJobId(null);
            clearInterval(interval);

            if (job.result) {
              try {
                const parsed = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
                if (parsed && parsed.leads) {
                  setCurrentRun(parsed);
                }
              } catch (e) {
                console.warn('Could not parse job result:', e);
              }
            }
            loadPastSearches();
          } else if (job.status === 'failed') {
            setIsDiscovering(false);
            setButtonState('retry');
            setSearchError(job.error || 'Discovery failed. Please verify API parameters and retry.');
            setActiveJobId(null);
            clearInterval(interval);
          } else if (job.status === 'cancelled') {
            setIsDiscovering(false);
            setButtonState('idle');
            setActiveJobId(null);
            clearInterval(interval);
          }
        }
      } catch (err: any) {
        console.warn('Job polling warning:', err);
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeJobId]);

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

  // Main Discovery Action (Asynchronous Job Workflow - immune to timeouts)
  const handleStartDiscovery = async () => {
    if (!keywords.trim()) {
      setSearchError('Please specify an industry or business category.');
      return;
    }
    if (!city.trim()) {
      setSearchError('Please specify a target city.');
      return;
    }

    setSearchError(null);
    setIsDiscovering(true);
    setButtonState('discovering');
    setDiscoveryProgress(5);
    setDiscoveryStage(`Resolving geographic zones in ${city.trim()}...`);

    const fullLocation = `${city.trim()}, ${selectedCountry.name}`;

    try {
      // 1. Enqueue background job via startJob (never drops HTTP connection)
      const job = await startJob('whatsapp', {
        keywords: keywords.trim(),
        location: fullLocation,
        city: city.trim(),
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        includeDecisionMakers
      });

      if (job && job.jobId) {
        setActiveJobId(job.jobId);
      }
    } catch (err: any) {
      setIsDiscovering(false);
      setButtonState('retry');
      setSearchError(err?.message || 'Failed to start discovery. Please verify your connection.');
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
      setPastRuns((prev) => prev.filter((r) => r.id !== id));
      if (currentRun?.id === id) {
        const remaining = pastRuns.filter((r) => r.id !== id);
        setCurrentRun(remaining[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  // Extract localities present in current dataset
  const availableLocalities = useMemo(() => {
    if (!currentRun?.leads) return [];
    return Array.from(
      new Set(currentRun.leads.map((l) => l.locality || l.city).filter(Boolean))
    );
  }, [currentRun]);

  // Flattened decision-makers list
  const allDecisionMakers = useMemo(() => {
    if (!currentRun?.leads) return [];
    const dms: Array<B2BDecisionMaker & { parentLead: WhatsAppLead }> = [];
    currentRun.leads.forEach((l) => {
      (l.decisionMakers || []).forEach((dm) => {
        dms.push({ ...dm, parentLead: l });
      });
    });

    return dms.filter((dm) => {
      if (roleFilter !== 'all' && dm.roleCategory !== roleFilter) return false;
      if (localityFilter !== 'all' && (dm.branchLocation || dm.parentLead.locality || dm.parentLead.city) !== localityFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          dm.name.toLowerCase().includes(q) ||
          dm.designation.toLowerCase().includes(q) ||
          dm.companyName.toLowerCase().includes(q) ||
          (dm.email || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [currentRun, roleFilter, localityFilter, searchFilter]);

  // Filtered companies
  const displayedLeads = useMemo(() => {
    if (!currentRun?.leads) return [];
    return currentRun.leads.filter((lead) => {
      if (mobileOnlyFilter && !lead.isMobile) return false;
      if (emailOnlyFilter && !lead.email && !lead.decisionMakers?.some((dm) => Boolean(dm.email))) return false;
      if (highScoreOnlyFilter && (lead.scores?.totalScore || 0) < 70) return false;
      if (localityFilter !== 'all' && (lead.locality || lead.city) !== localityFilter) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const inName = lead.businessName.toLowerCase().includes(q);
        const inPhone = lead.phoneRaw.includes(q) || lead.phoneInternational.includes(q);
        const inAddress = lead.address.toLowerCase().includes(q);
        const inLocality = (lead.locality || '').toLowerCase().includes(q);
        const inDm = (lead.decisionMakers || []).some(
          (dm) => dm.name.toLowerCase().includes(q) || dm.designation.toLowerCase().includes(q)
        );
        return inName || inPhone || inAddress || inLocality || inDm;
      }
      return true;
    });
  }, [currentRun, mobileOnlyFilter, emailOnlyFilter, highScoreOnlyFilter, localityFilter, searchFilter]);

  // Active filter count for badge
  const activeFilterCount =
    (localityFilter !== 'all' ? 1 : 0) +
    (roleFilter !== 'all' ? 1 : 0) +
    (mobileOnlyFilter ? 1 : 0) +
    (emailOnlyFilter ? 1 : 0) +
    (highScoreOnlyFilter ? 1 : 0) +
    (searchFilter.trim() ? 1 : 0);

  // 6 Compact Dashboard Metric Calculations
  const statBusinessesFound = currentRun ? currentRun.leads.length : 0;
  const statUniqueBranches = currentRun ? (currentRun.coverage?.uniqueBusinesses || currentRun.leads.length) : 0;
  const statDecisionMakers = currentRun
    ? (currentRun.decisionMakers?.length || currentRun.leads.reduce((acc, l) => acc + (l.decisionMakers?.length || 0), 0))
    : 0;
  const statVerifiedPhones = currentRun
    ? currentRun.leads.filter((l) => Boolean(l.phoneInternational || l.phoneRaw)).length
    : 0;
  const statMobileReady = currentRun ? currentRun.leads.filter((l) => l.isMobile).length : 0;
  const statProfessionalEmails = currentRun
    ? currentRun.leads.filter((l) => Boolean(l.email || l.decisionMakers?.some((dm) => dm.email))).length
    : 0;
  const statHighConfidence = currentRun
    ? currentRun.leads.filter((l) => (l.scores?.totalScore || 0) >= 70 || l.confidence === 'high').length
    : 0;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  B2B Business, Google Maps & Decision-Maker Finder
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  Google Maps Grounded
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Discover verified companies with Google Maps listings, websites, direct phone numbers, and authorized leadership.
              </p>
            </div>

            {pastRuns.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-xs self-start sm:self-auto"
              >
                <History className="w-3.5 h-3.5 text-gray-500" />
                <span>Search History ({pastRuns.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Error Alert Banner */}
        {searchError && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3 text-xs text-red-800 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Discovery Notice</p>
                <p className="mt-0.5 text-red-700">{searchError}</p>
              </div>
            </div>
            <button
              onClick={() => setSearchError(null)}
              className="text-red-400 hover:text-red-600 p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. SIMPLIFIED SEARCH FORM */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Field 1: Industry / Business Category */}
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Industry / Business Category
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. Software Companies, Manufacturing, Real Estate, Solar Energy, Eye Hospitals"
                  disabled={isDiscovering}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Field 2: Country (Searchable Dropdown worldwide, default India) */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Country
              </label>
              <div className="relative">
                <select
                  value={selectedCountry.name}
                  onChange={(e) => {
                    const country = WORLD_COUNTRIES.find((c) => c.name === e.target.value) || WORLD_COUNTRIES[0];
                    setSelectedCountry(country);
                  }}
                  disabled={isDiscovering}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition appearance-none cursor-pointer"
                >
                  {WORLD_COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field 3: City (Interpreted within country) */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                City / Region
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bangalore, Mysore, Mumbai, London"
                  disabled={isDiscovering}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Form Bottom Row: Checkbox & Primary Action */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Field 4: Decision-Maker Discovery (One simple checkbox, checked by default) */}
            <label className="flex items-center gap-2.5 text-xs font-medium text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDecisionMakers}
                onChange={(e) => setIncludeDecisionMakers(e.target.checked)}
                disabled={isDiscovering}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
              />
              <span>Find decision-makers and company leadership</span>
            </label>

            {/* Primary Action Button: "Discover Businesses & Leaders" */}
            <button
              onClick={handleStartDiscovery}
              disabled={isDiscovering}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg text-white shadow-xs transition ${
                isDiscovering
                  ? 'bg-purple-400 cursor-not-allowed'
                  : buttonState === 'completed'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : buttonState === 'retry'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
              }`}
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Discovering...</span>
                </>
              ) : buttonState === 'completed' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Discovery Completed</span>
                </>
              ) : buttonState === 'retry' ? (
                <>
                  <RotateCw className="w-4 h-4" />
                  <span>Retry Discovery</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Discover Businesses & Leaders</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Indicator (Active while discovering) */}
          {isDiscovering && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                <span className="font-medium text-purple-700 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {discoveryStage || 'Searching across geographic zones and directories...'}
                </span>
                <span className="font-semibold text-gray-700">{discoveryProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(discoveryProgress, 6)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. SIX COMPACT METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {/* Card 1: Businesses Found */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Businesses Found</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{statBusinessesFound}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Total establishments</div>
          </div>

          {/* Card 2: Unique Companies & Branches */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Unique Companies</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{statUniqueBranches}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Distinct branches</div>
          </div>

          {/* Card 3: Decision-Makers */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Decision-Makers</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">{statDecisionMakers}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Founders, CEOs, Heads</div>
          </div>

          {/* Card 4: Verified Phone Numbers */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verified Phones</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{statVerifiedPhones}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">{statMobileReady} WhatsApp ready</div>
          </div>

          {/* Card 5: Professional Emails */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Emails</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{statProfessionalEmails}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Executive contacts</div>
          </div>

          {/* Card 6: High-Confidence Leads */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">High-Confidence</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{statHighConfidence}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Score ≥ 70 / 100</div>
          </div>
        </div>

        {/* 3. RESULTS DASHBOARD WITH 4 TABS */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Tabs Bar & Controls Header */}
          <div className="p-3.5 sm:p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* 4 Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setActiveTab('businesses')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  activeTab === 'businesses'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Businesses & Maps ({displayedLeads.length})
              </button>

              <button
                onClick={() => setActiveTab('decision_makers')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  activeTab === 'decision_makers'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Decision-Makers ({allDecisionMakers.length})
              </button>

              <button
                onClick={() => setActiveTab('contacts')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  activeTab === 'contacts'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Contacts & WhatsApp ({statMobileReady})
              </button>

              <button
                onClick={() => setActiveTab('sources')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  activeTab === 'sources'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Search Sources
              </button>
            </div>

            {/* Controls: View Toggle, Collapsible Filter Toggle, Compact Export Dropdown */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              {/* Card / Table Toggle */}
              {(activeTab === 'businesses' || activeTab === 'decision_makers') && (
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-md transition ${
                      viewMode === 'cards' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="Card View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition ${
                      viewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="Table View"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Collapsible Filter Toggle Button */}
              <button
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  isFilterPanelOpen || activeFilterCount > 0
                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Compact Export Dropdown (Excel, CSV, Zoho, HubSpot, Salesforce, vCard) */}
              {currentRun && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        Export Formats
                      </div>
                      <a
                        href={api.getWhatsAppExportUrl('xlsx', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-800 font-medium"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Excel Workbook (.xlsx)</span>
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('csv', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-800 font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 text-gray-600" />
                        <span>Universal CSV (.csv)</span>
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('zoho', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-800 font-medium"
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center">
                          Z
                        </span>
                        <span>Zoho CRM (.csv)</span>
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('hubspot', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-800 font-medium"
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold flex items-center justify-center">
                          H
                        </span>
                        <span>HubSpot CRM (.csv)</span>
                      </a>
                      <a
                        href={api.getWhatsAppExportUrl('salesforce', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-800 font-medium"
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center">
                          S
                        </span>
                        <span>Salesforce CRM (.csv)</span>
                      </a>
                      <div className="border-t border-gray-100 my-1"></div>
                      <a
                        href={api.getWhatsAppExportUrl('vcf', currentRun.id)}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-emerald-700 font-medium"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Bulk vCard (.vcf)</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Filter Panel */}
          {isFilterPanelOpen && (
            <div className="p-4 bg-gray-50/70 border-b border-gray-200 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Search Text */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter by name, phone, address..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Locality / Zone Dropdown */}
                {availableLocalities.length > 0 && (
                  <select
                    value={localityFilter}
                    onChange={(e) => setLocalityFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="all">All Localities ({availableLocalities.length} zones)</option>
                    {availableLocalities.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                )}

                {/* Role Filter (when in Decision-Makers tab) */}
                {activeTab === 'decision_makers' && (
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="all">All Leadership Roles</option>
                    <option value="founder">Founders & Owners</option>
                    <option value="c_level">C-Level (CEOs, COOs)</option>
                    <option value="medical_director">Medical Directors</option>
                    <option value="director">Directors & Administrators</option>
                    <option value="head_of_dept">Heads of Department</option>
                    <option value="manager">Managers</option>
                  </select>
                )}

                {/* Checkbox Toggles */}
                <div className="flex flex-wrap items-center gap-3 md:col-span-2 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mobileOnlyFilter}
                      onChange={(e) => setMobileOnlyFilter(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span>Mobile / WhatsApp Only</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailOnlyFilter}
                      onChange={(e) => setEmailOnlyFilter(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span>Email Available</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highScoreOnlyFilter}
                      onChange={(e) => setHighScoreOnlyFilter(e.target.checked)}
                      className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <span>Score ≥ 70</span>
                  </label>

                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setSearchFilter('');
                        setLocalityFilter('all');
                        setRoleFilter('all');
                        setMobileOnlyFilter(false);
                        setEmailOnlyFilter(false);
                        setHighScoreOnlyFilter(false);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium underline ml-auto"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: BUSINESSES & GOOGLE MAPS PROFILES */}
          {activeTab === 'businesses' && (
            displayedLeads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-gray-800">No businesses match your active criteria</h3>
                <p className="text-xs text-gray-400 mt-1">Try clearing some filters or running a new discovery.</p>
              </div>
            ) : viewMode === 'cards' ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-gray-50/40">
                {displayedLeads.map((lead) => {
                  const totalScore = lead.scores?.totalScore || 75;
                  const dms = lead.decisionMakers || [];
                  const primaryPhone = lead.phoneInternational || lead.phoneRaw;
                  const alternatePhones = (lead.phones || []).filter(
                    (p) => (p.e164Number || p.originalNumber) !== lead.phoneInternational && (p.originalNumber || p.e164Number) !== lead.phoneRaw
                  );
                  const mapsUrl =
                    lead.googleProfileUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${lead.businessName} ${lead.address || lead.locality || lead.city}`
                    )}`;
                  const cleanWebsite = lead.website
                    ? lead.website.startsWith('http')
                      ? lead.website
                      : `https://${lead.website}`
                    : null;
                  const websiteDomain = cleanWebsite
                    ? cleanWebsite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
                    : null;

                  return (
                    <div
                      key={lead.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        {/* Company Header: Name, Brand, Category & Score */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3
                              onClick={() => setSelectedLeadForModal(lead)}
                              className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 cursor-pointer hover:text-purple-700 transition"
                              title="Click to view full Google Maps & leadership details"
                            >
                              {lead.businessName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {lead.brandName && lead.brandName !== lead.businessName && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                  Part of {lead.brandName}
                                </span>
                              )}
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700">
                                {lead.category || 'Business'}
                              </span>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            Score {totalScore}
                          </span>
                        </div>

                        {/* 1. Google Maps & Physical Address Box */}
                        <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 space-y-1.5 text-xs">
                          <div className="flex items-start gap-1.5 text-gray-700">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">{lead.address}</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-gray-200/60">
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3 text-blue-600" />
                              <span>View on Google Maps</span>
                            </a>

                            {lead.rating && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{lead.rating}</span>
                              </span>
                            )}
                          </div>

                          {lead.operatingHours && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-0.5">
                              <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">{lead.operatingHours}</span>
                            </div>
                          )}
                        </div>

                        {/* 2. Official Website Link */}
                        {cleanWebsite && (
                          <div className="flex items-center justify-between text-xs px-1">
                            <div className="flex items-center gap-1.5 text-gray-600 truncate">
                              <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate font-medium text-gray-700">{websiteDomain}</span>
                            </div>
                            <a
                              href={cleanWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:underline shrink-0"
                            >
                              Visit Website ↗
                            </a>
                          </div>
                        )}

                        {/* 3. Phone Numbers & WhatsApp Readiness */}
                        <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-gray-500" />
                              <span className="font-bold text-gray-900">{primaryPhone || 'Unlisted'}</span>
                            </div>
                            {lead.isMobile ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                WhatsApp Ready
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                Reception Landline
                              </span>
                            )}
                          </div>

                          {alternatePhones.length > 0 && (
                            <div className="text-[11px] text-gray-500 pl-5">
                              <span className="text-gray-400">Alt:</span>{' '}
                              {alternatePhones.map((p) => p.e164Number || p.originalNumber).join(', ')}
                            </div>
                          )}
                        </div>

                        {/* 4. Decision-Makers Preview */}
                        {dms.length > 0 && (
                          <div className="pt-1.5 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="font-medium text-purple-700 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {dms.length} Decision-Maker{dms.length > 1 ? 's' : ''} Found
                            </span>
                            <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                              {dms[0].name} ({dms[0].designation})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {lead.isMobile && lead.whatsappUrl ? (
                            <a
                              href={lead.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          ) : null}

                          {primaryPhone && (
                            <button
                              onClick={() => handleCopy(primaryPhone, lead.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            >
                              {copiedId === lead.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === lead.id ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedLeadForModal(lead)}
                          className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline"
                        >
                          View Full Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Business & Category</th>
                      <th className="px-4 py-3">Google Maps & Address</th>
                      <th className="px-4 py-3">Rating & Hours</th>
                      <th className="px-4 py-3">Contact Phone</th>
                      <th className="px-4 py-3">Line Type</th>
                      <th className="px-4 py-3">Website</th>
                      <th className="px-4 py-3">Decision-Makers</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedLeads.map((lead) => {
                      const mapsUrl =
                        lead.googleProfileUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${lead.businessName} ${lead.address || lead.locality || lead.city}`
                        )}`;
                      const cleanWebsite = lead.website
                        ? lead.website.startsWith('http')
                          ? lead.website
                          : `https://${lead.website}`
                        : null;
                      const websiteDomain = cleanWebsite
                        ? cleanWebsite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
                        : null;

                      return (
                        <tr key={lead.id} className="hover:bg-gray-50/70 transition">
                          <td className="px-4 py-3">
                            <div
                              onClick={() => setSelectedLeadForModal(lead)}
                              className="font-bold text-gray-900 cursor-pointer hover:text-purple-700"
                            >
                              {lead.businessName}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {lead.brandName && lead.brandName !== lead.businessName
                                ? `Branch of ${lead.brandName}`
                                : lead.category || 'Business'}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="line-clamp-2 text-gray-600">{lead.address}</div>
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline mt-0.5"
                            >
                              <MapPin className="w-3 h-3 text-red-500" />
                              <span>Google Maps ↗</span>
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            {lead.rating ? (
                              <div className="flex items-center gap-1 text-amber-600 font-semibold">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{lead.rating}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">Unrated</span>
                            )}
                            {lead.operatingHours && (
                              <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[130px]" title={lead.operatingHours}>
                                {lead.operatingHours}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800">{lead.phoneInternational || lead.phoneRaw || 'N/A'}</div>
                            {lead.phones && lead.phones.length > 1 && (
                              <div className="text-[10px] text-gray-400">+{lead.phones.length - 1} alternate</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lead.isMobile ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Mobile (WhatsApp)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                Landline
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {cleanWebsite ? (
                              <a
                                href={cleanWebsite}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-800 hover:underline font-medium truncate max-w-[120px] block"
                                title={cleanWebsite}
                              >
                                {websiteDomain}
                              </a>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lead.decisionMakers && lead.decisionMakers.length > 0 ? (
                              <span className="font-semibold text-purple-700">
                                {lead.decisionMakers.length} Found
                              </span>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                            {lead.isMobile && lead.whatsappUrl && (
                              <a
                                href={lead.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition"
                              >
                                WhatsApp
                              </a>
                            )}
                            <button
                              onClick={() => setSelectedLeadForModal(lead)}
                              className="px-2 py-1 text-[11px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                            >
                              Details
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

          {/* TAB 2: DECISION-MAKERS */}
          {activeTab === 'decision_makers' && (
            allDecisionMakers.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-gray-800">No decision-makers found for this search</h3>
                <p className="text-xs text-gray-400 mt-1">Make sure the leadership discovery checkbox is enabled.</p>
              </div>
            ) : viewMode === 'cards' ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-gray-50/40">
                {allDecisionMakers.map((dm) => (
                  <div
                    key={dm.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 leading-snug">{dm.name}</h4>
                          <p className="text-xs text-purple-700 font-medium mt-0.5">{dm.designation}</p>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                          {dm.roleCategory}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                        <div className="font-medium text-gray-800">{dm.companyName}</div>
                        {dm.branchLocation && <div className="text-[11px] text-gray-400">{dm.branchLocation}</div>}
                      </div>

                      {dm.sourceEvidence && (
                        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 line-clamp-2">
                          {dm.sourceEvidence}
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="capitalize">{dm.employmentStatus}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {dm.email && (
                          <a href={`mailto:${dm.email}`} className="text-blue-600 hover:text-blue-800" title={dm.email}>
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {dm.linkedinUrl && (
                          <a href={dm.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="LinkedIn">
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Decision-Maker</th>
                      <th className="px-4 py-3">Designation</th>
                      <th className="px-4 py-3">Company & Branch</th>
                      <th className="px-4 py-3">Role Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allDecisionMakers.map((dm) => (
                      <tr key={dm.id} className="hover:bg-gray-50/70 transition">
                        <td className="px-4 py-3 font-bold text-gray-900">{dm.name}</td>
                        <td className="px-4 py-3 text-gray-700">{dm.designation}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{dm.companyName}</div>
                          {dm.branchLocation && <div className="text-[10px] text-gray-400">{dm.branchLocation}</div>}
                        </td>
                        <td className="px-4 py-3 uppercase text-[10px] font-bold text-purple-700">{dm.roleCategory}</td>
                        <td className="px-4 py-3 text-emerald-700 font-medium capitalize">{dm.employmentStatus}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {dm.linkedinUrl && (
                            <a href={dm.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              LinkedIn
                            </a>
                          )}
                          {dm.email && (
                            <a href={`mailto:${dm.email}`} className="text-gray-600 hover:underline">
                              Email
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* TAB 3: CONTACTS & WHATSAPP */}
          {activeTab === 'contacts' && (
            <div className="p-4 divide-y divide-gray-100">
              {displayedLeads
                .filter((l) => l.isMobile)
                .map((lead) => {
                  const mapsUrl =
                    lead.googleProfileUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${lead.businessName} ${lead.address || lead.locality || lead.city}`
                    )}`;

                  return (
                    <div
                      key={lead.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            onClick={() => setSelectedLeadForModal(lead)}
                            className="text-sm font-bold text-gray-900 cursor-pointer hover:text-purple-700"
                          >
                            {lead.businessName}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            WhatsApp Ready
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>{lead.locality || lead.city}</span>
                          <span>•</span>
                          <span className="font-semibold text-gray-700">{lead.phoneInternational || lead.phoneRaw}</span>
                          <span>•</span>
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium"
                          >
                            <MapPin className="w-3 h-3 text-red-500" />
                            <span>Google Maps</span>
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(lead.phoneInternational || lead.phoneRaw, lead.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                          {copiedId === lead.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === lead.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {lead.whatsappUrl && (
                          <a
                            href={lead.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat on WhatsApp</span>
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedLeadForModal(lead)}
                          className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* TAB 4: SEARCH SOURCES & COVERAGE */}
          {activeTab === 'sources' && (
            <div className="p-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Sources Queried</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {(currentRun?.coverage?.sourcesQueried || [
                    'Google Search Grounding (Gemini 2.5 Flash)',
                    'Google Maps & Google Business Profiles',
                    'Practo & Justdial Healthcare Registry',
                    'Sulekha & IndiaMART B2B Directories',
                    'LinkedIn Public Executive Profiles',
                    'Official Company Domains'
                  ]).map((src) => (
                    <div key={src} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-gray-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{src}</span>
                    </div>
                  ))}
                </div>
              </div>

              {currentRun?.coverage && (
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Geographic Zone Coverage</h4>
                  <p className="text-xs text-gray-600 mb-3">{currentRun.coverage.remainingCoverageNote}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {currentRun.coverage.zonesAttempted.map((zone) => {
                      const isCompleted = currentRun.coverage?.zonesCompleted.includes(zone);
                      return (
                        <span
                          key={zone}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            isCompleted
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}
                        >
                          {zone} {isCompleted ? '✓' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FULL COMPANY, GOOGLE MAPS & LEADERSHIP MODAL */}
      {selectedLeadForModal && (
        <CompanyDetailModal
          lead={selectedLeadForModal}
          onClose={() => setSelectedLeadForModal(null)}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Recent Searches</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto mt-2">
              {pastRuns.map((run) => (
                <div key={run.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div
                    onClick={() => {
                      setCurrentRun(run);
                      setShowHistoryModal(false);
                    }}
                    className="cursor-pointer hover:text-purple-600 flex-1 truncate"
                  >
                    <div className="font-semibold text-gray-800 truncate">{run.keywords}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {run.location} • {run.leads.length} leads
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSearch(run.id)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded"
                    title="Delete"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppFinder;
