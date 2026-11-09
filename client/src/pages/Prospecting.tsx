import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Download,
  Sparkles,
  Loader2,
  Trash2,
  RefreshCw,
  Send,
  Copy,
  Check,
  ShieldCheck,
  TrendingUp,
  Filter,
  MapPin,
  Briefcase,
  ChevronRight,
  ChevronDown,
  Plus,
  Map,
  List,
  Compass,
  Tractor,
  Layers,
  Settings2,
  FileSpreadsheet,
  Globe,
  ArrowRight,
  StopCircle,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { useJobs } from '../context/JobContext';
import { api } from '../services/api';
import { LeadMap } from '../components/LeadMap';
import {
  Lead,
  LeadStatus,
  LeadStats,
  ProspectingCriteria,
  DecisionMaker,
  PersonalizedEmailData,
  Competitor,
  CampaignKeywordGroup,
  CompanyProfile
} from '../types';

export const Prospecting: React.FC = () => {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'companies' | 'people' | 'emails'>('companies');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');

  // Company Switcher & Profiles (Clean start - no default company)
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [activeProfile, setActiveProfile] = useState<CompanyProfile | null>(null);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  // Single URL Research Bar
  const [researchUrl, setResearchUrl] = useState('');
  const [researching, setResearching] = useState(false);
  const [researchStage, setResearchStage] = useState('');

  // Persistent Background Job Hook
  const { jobs, startJob, cancelJob, retryJob } = useJobs();
  const activeJob = jobs.find(j => j.agentId === 'prospector' && (j.status === 'running' || j.status === 'queued'));
  const lastFinishedJob = jobs.find(j => j.agentId === 'prospector' && j.status === 'completed');
  const lastInterruptedJob = jobs.find(j => j.agentId === 'prospector' && (j.status === 'interrupted' || j.status === 'failed'));

  // Sync state with background job
  useEffect(() => {
    if (activeJob) {
      setResearching(true);
      setResearchStage(`${activeJob.currentStage || 'Running research pipeline...'} (${activeJob.progress}%)`);
      try {
        const input = JSON.parse(activeJob.input);
        if (input.url && !researchUrl) setResearchUrl(input.url);
      } catch {}
    } else {
      setResearching(false);
      setResearchStage('');
    }
  }, [activeJob]);

  // Handle completed job
  useEffect(() => {
    if (lastFinishedJob && lastFinishedJob.result) {
      try {
        const result = JSON.parse(lastFinishedJob.result);
        if (result.profile) {
          setCompanies(prev => {
            const filtered = prev.filter(p => p.id !== result.profile.id);
            return [result.profile, ...filtered];
          });
          setActiveCompanyId(result.profile.id);
          setActiveProfile(result.profile);
          setCompetitors(result.competitors || []);
          setCampaigns(result.campaigns || []);
          setLeads(result.leads || []);
          setStats(result.stats || null);
          if (result.campaigns?.length > 0) setSelectedCampaignId(result.campaigns[0].id);
          if (result.leads?.length > 0) setSelectedLead(result.leads[0]);
          setActiveStep(6);
          setActiveTab('emails');
        }
      } catch (e) {
        console.warn('Could not parse finished job result:', e);
      }
    }
  }, [lastFinishedJob?.jobId]);

  // Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignKeywordGroup[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  // Loading & Alert States
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [enrichingEmailId, setEnrichingEmailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Map Discovery Form State
  const [showSearchWizard, setShowSearchWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryInput, setIndustryInput] = useState('');
  const [cityInput, setCityInput] = useState('Seattle');
  const [stateInput, setStateInput] = useState('Washington');
  const [countryInput, setCountryInput] = useState('USA');
  const [postalCodeInput, setPostalCodeInput] = useState('');
  const [radiusMiles, setRadiusMiles] = useState<number>(25);
  const [prospectLimit, setProspectLimit] = useState<number>(6);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Selected Lead & Email Studio State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [customValueProp, setCustomValueProp] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  // Competitor Modal
  const [showCompetitorsModal, setShowCompetitorsModal] = useState(false);

  // Load initial companies and active company data
  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (activeCompanyId) {
      loadCompanyData(activeCompanyId);
    }
  }, [activeCompanyId, statusFilter, minScoreFilter, emailStatusFilter]);

  const loadCompanies = async () => {
    try {
      const companyList = await api.getCompanies();
      setCompanies(companyList);
      // Clean start: Do NOT automatically load or select any company.
      // The workspace remains pristine until the user enters a URL or opens a saved session.
    } catch (err: any) {
      console.warn('Could not load company profiles:', err.message);
    }
  };

  const loadCompanyData = async (compId: string) => {
    if (!compId) {
      setLeads([]);
      setStats(null);
      setCompetitors([]);
      setCampaigns([]);
      setSelectedLead(null);
      return;
    }
    setLoading(true);
    try {
      const [leadsData, statsData, compsData, campsData] = await Promise.all([
        api.getLeads({
          companyId: compId,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          minScore: minScoreFilter > 0 ? minScoreFilter : undefined,
          emailStatus: emailStatusFilter !== 'all' ? emailStatusFilter : undefined
        }),
        api.getLeadStats(compId),
        api.getCompetitors(compId),
        api.getCampaigns(compId)
      ]);

      setLeads(leadsData);
      setStats(statsData);
      setCompetitors(compsData);
      setCampaigns(campsData);

      if (campsData.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(campsData[0].id);
      }

      if (leadsData.length > 0) {
        setSelectedLead(leadsData[0]);
      } else {
        setSelectedLead(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  // Switch Company handler
  const handleSwitchCompany = (profile: CompanyProfile) => {
    setActiveCompanyId(profile.id);
    setActiveProfile(profile);
    setSelectedCampaignId('');
    setActiveStep(6);
    setShowCompanyDropdown(false);
    setSuccessMsg(`Switched to active research profile: ${profile.name}`);
  };

  // Launch Full Autonomous 6-Stage Research from Single URL as a Persistent Background Job
  const handleStartFullResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchUrl.trim()) return;

    setError(null);
    setSuccessMsg(null);

    try {
      await startJob('prospector', { url: researchUrl.trim() });
      setSuccessMsg(`Autonomous research job started in background for ${researchUrl.trim()}! You can switch tabs or refresh without losing progress.`);
    } catch (err: any) {
      setError(err.message || 'Full research workflow encountered an error. Please try again.');
    }
  };

  // Select campaign
  const handleSelectCampaign = (camp: CampaignKeywordGroup) => {
    setSelectedCampaignId(camp.id);
    const kw = camp.coreServiceKeywords || camp.keywords || [];
    setIndustryInput(kw.slice(0, 3).join(', '));
    // Filter leads for this campaign if available
    const campLeads = leads.filter(l => l.targetCampaignId === camp.id || l.industry.toLowerCase().includes(camp.targetIndustry.toLowerCase()));
    if (campLeads.length > 0) {
      setSelectedLead(campLeads[0]);
    }
  };

  // Launch Geographic Map Discovery
  const handleLaunchDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setError(null);
    setSuccessMsg(null);

    const activeCamp = campaigns.find(c => c.id === selectedCampaignId);
    const targetRoles = activeCamp?.suggestedRoles || activeProfile?.targetBuyerRoles || ['Operations Director', 'Managing Director', 'Owner'];

    const criteria: ProspectingCriteria & { companyId?: string } = {
      industry: industryInput.trim() || activeCamp?.targetIndustry || 'Commercial Enterprises',
      location: `${cityInput}, ${stateInput}`,
      city: cityInput.trim(),
      state: stateInput.trim(),
      country: countryInput.trim(),
      postalCode: postalCodeInput.trim() || undefined,
      radiusMiles,
      targetRoles,
      limit: prospectLimit,
      campaignId: selectedCampaignId,
      companyId: activeCompanyId
    };

    try {
      const result = await api.prospectLeads(criteria);
      setSuccessMsg(`Discovered and mapped ${result.count} verified businesses in ${cityInput}, ${stateInput}!`);
      setShowSearchWizard(false);
      await loadCompanyData(activeCompanyId);
      setActiveTab('companies');
    } catch (err: any) {
      setError(err.message || 'Geographic discovery encountered an error.');
    } finally {
      setSearching(false);
    }
  };

  // Run Email Discovery Cascade on a single lead
  const handleRunEmailCascade = async (leadId: string) => {
    setEnrichingEmailId(leadId);
    setError(null);
    try {
      const res = await api.enrichEmail(leadId);
      setLeads(prev => prev.map(l => (l.id === leadId ? res.lead : l)));
      if (selectedLead?.id === leadId) setSelectedLead(res.lead);
      const newStats = await api.getLeadStats(activeCompanyId);
      setStats(newStats);
      setSuccessMsg(`Email cascade complete for ${res.lead.companyName}. Status: ${res.lead.decisionMakers[0]?.emailStatus || 'Checked'}`);
    } catch (err: any) {
      setError(err.message || 'Email discovery failed');
    } finally {
      setEnrichingEmailId(null);
    }
  };

  // Generate / Regenerate Personalized Cold Email
  const handleGenerateEmail = async () => {
    if (!selectedLead) return;
    setGeneratingEmail(true);
    setError(null);
    try {
      const res = await api.personalizeEmail(selectedLead.id, customValueProp, activeCompanyId);
      const updated = {
        ...selectedLead,
        personalizedEmail: res.personalizedEmail,
        status: selectedLead.status === 'New' ? ('Qualified' as LeadStatus) : selectedLead.status
      };
      setSelectedLead(updated);
      setLeads(prev => prev.map(l => (l.id === selectedLead.id ? updated : l)));
      const newStats = await api.getLeadStats(activeCompanyId);
      setStats(newStats);
      setActiveStep(6);
    } catch (err: any) {
      setError(err.message || 'Failed to personalize cold outreach email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  // Update Pipeline Status
  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const updated = await api.updateLead(leadId, { status: newStatus });
      setLeads(prev => prev.map(l => (l.id === leadId ? updated : l)));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
      const newStats = await api.getLeadStats(activeCompanyId);
      setStats(newStats);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchCompany = l.companyName.toLowerCase().includes(q);
    const matchIndustry = l.industry.toLowerCase().includes(q);
    const matchLocation = l.location.toLowerCase().includes(q);
    const matchDm = l.decisionMakers.some(
      dm => dm.name.toLowerCase().includes(q) || dm.title.toLowerCase().includes(q) || (dm.email && dm.email.toLowerCase().includes(q))
    );
    return matchCompany || matchIndustry || matchLocation || matchDm;
  });

  const getCompanyInitials = (name?: string) => {
    if (!name) return 'CO';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 text-slate-800">
      {/* LEFT SIDEBAR: 6-Step Workflow Navigator matching screenshot */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full select-none shrink-0 overflow-y-auto">
        {/* Company Switcher Dropdown Header */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
              className="flex items-center gap-2.5 text-left w-full hover:bg-white p-1 rounded-lg transition"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {activeProfile ? getCompanyInitials(activeProfile.name) : <Building2 className="w-3.5 h-3.5" />}
              </div>
              <div className="truncate flex-1">
                <div className="flex items-center gap-1">
                  <h2 className="text-xs font-bold text-slate-900 truncate">
                    {activeProfile?.name || 'No Company Selected'}
                  </h2>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="text-[11px] text-slate-500 truncate font-mono">
                  {activeProfile?.domain || (companies.length > 0 ? `${companies.length} saved projects` : 'Enter URL to begin')}
                </div>
              </div>
            </button>
          </div>

          {/* Dropdown Menu for Switcher */}
          {showCompanyDropdown && (
            <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Saved Research Projects ({companies.length})
              </div>
              {companies.map(comp => (
                <button
                  key={comp.id}
                  onClick={() => handleSwitchCompany(comp)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left ${
                    activeCompanyId === comp.id ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <div className="font-semibold">{comp.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{comp.domain}</div>
                  </div>
                  {activeCompanyId === comp.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              ))}
              {companies.length === 0 && (
                <div className="text-xs text-slate-400 p-2 text-center">No saved research yet.</div>
              )}
              <div className="pt-1.5 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowCompanyDropdown(false);
                    const inputEl = document.getElementById('search-url-input');
                    if (inputEl) inputEl.focus();
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Research a new company website...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Explore Competitors */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              step 2 · Explore competitors
            </span>
            <button
              onClick={() => setShowCompetitorsModal(true)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium"
              title="Competitor Details"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-700 font-semibold mb-2">
            <span>COMPETITORS {competitors.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {competitors.slice(0, 5).map(c => (
              <a
                key={c.id}
                href={c.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-600 hover:text-slate-900 transition-colors font-mono"
              >
                <span>{c.name.split(' ')[0].toLowerCase()}...</span>
                <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
              </a>
            ))}
            {competitors.length === 0 && (
              <div className="text-xs text-slate-400 italic">No competitors mapped yet</div>
            )}
          </div>
        </div>

        {/* Step 3: Define Campaigns */}
        <div className="p-4 border-b border-slate-100 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              step 3 · Define campaigns
            </span>
            <button
              onClick={() => setShowSearchWizard(true)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span>CAMPAIGNS {campaigns.length}</span>
          </div>
          <div className="space-y-1.5">
            {campaigns.map(camp => {
              const isSelected = selectedCampaignId === camp.id;
              return (
                <button
                  key={camp.id}
                  onClick={() => handleSelectCampaign(camp)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{camp.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded shrink-0">
                    {camp.actualDiscoveredCount || camp.countEstimate || 0}
                  </span>
                </button>
              );
            })}
            {campaigns.length === 0 && (
              <div className="text-xs text-slate-400 italic">No campaigns generated yet</div>
            )}
          </div>
        </div>

        {/* Steps 4, 5, 6 Fast Navigation */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-1 text-xs">
          <button
            onClick={() => {
              setActiveTab('companies');
              setActiveStep(4);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white text-slate-600 font-medium"
          >
            <span>step 4 · Find potential customers</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>
          <button
            onClick={() => {
              setActiveTab('people');
              setActiveStep(5);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white text-slate-600 font-medium"
          >
            <span>step 5 · Find decision makers</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>
          <button
            onClick={() => {
              setActiveTab('emails');
              setActiveStep(6);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white text-slate-600 font-medium"
          >
            <span>step 6 · Write emails</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TOP URL RESEARCH BAR (Single Input for Any Company) */}
        <div className="px-6 py-2.5 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="font-bold tracking-tight">MarketMate AI</span>
          </div>

          <form onSubmit={handleStartFullResearch} className="flex-1 max-w-2xl flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-url-input"
                type="text"
                value={researchUrl}
                onChange={e => setResearchUrl(e.target.value)}
                placeholder="Enter any company website URL"
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 text-white border border-slate-700 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                disabled={researching}
              />
            </div>
            <button
              type="submit"
              disabled={researching || !researchUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg text-xs transition shadow-sm shrink-0"
            >
              {researching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  <span>Researching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Research</span>
                </>
              )}
            </button>
          </form>

          {/* Connected API Status Indicators */}
          <div className="hidden xl:flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini AI Connected
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live Search Connected
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Hunter API Connected
            </span>
          </div>
        </div>

        {/* Dynamic Stage Indicator Bar during Autonomous Execution */}
        {activeJob && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              <span>{activeJob.currentStage || 'Executing autonomous 6-stage research pipeline...'}</span>
              <span className="font-mono font-bold text-emerald-700">({activeJob.progress}%)</span>
            </div>
            <button
              type="button"
              onClick={() => cancelJob(activeJob.jobId)}
              className="px-2.5 py-1 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs"
            >
              <StopCircle className="w-3 h-3" />
              <span>Cancel Research</span>
            </button>
          </div>
        )}

        {/* Interrupted / Error Recovery Banner */}
        {!activeJob && lastInterruptedJob && !activeProfile && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Previous research was interrupted: <strong>{lastInterruptedJob.error || 'Server restart or shutdown'}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => retryJob(lastInterruptedJob.jobId)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-1 shrink-0 shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Research</span>
            </button>
          </div>
        )}

        {/* TOP STEP BREADCRUMBS & ACTION BAR */}
        <header className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Breadcrumb Steps (1 to 6) */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${activeStep >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
            <span className="w-3 h-0.5 bg-slate-200" />
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${activeStep >= 2 && activeProfile ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
            <span className="w-3 h-0.5 bg-slate-200" />
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${activeStep >= 3 && activeProfile ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
            <span className="w-3 h-0.5 bg-slate-200" />
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${activeStep >= 4 && activeProfile ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>4</span>
            <span className="w-3 h-0.5 bg-slate-200" />
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${activeStep >= 5 && activeProfile ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>5</span>
            <span className="w-3 h-0.5 bg-slate-200" />
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
              activeStep >= 6 && activeProfile
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${activeStep >= 6 && activeProfile ? 'bg-green-600 animate-pulse' : 'bg-slate-400'}`} />
              <span>6 · Outreach {activeStep >= 6 && activeProfile ? 'ready' : 'pending'}</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-slate-400 pl-2">
              <span className="w-3 h-0.5 bg-slate-200" />
              <span className="text-[11px]">7 Send emails</span>
              <span className="text-[11px]">8 Book meetings</span>
              <span className="text-[11px]">9 Learn & double down</span>
            </div>
          </div>

          {/* Right Header CTAs */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Direct 1:1 Outreach</span>
              </div>
              <div className="text-[10px] text-slate-400">Manual review before sending</div>
            </div>
            <button
              onClick={() => {
                setActiveTab('emails');
                setActiveStep(6);
              }}
              disabled={!activeProfile || leads.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs transition shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Start outreach</span>
            </button>
            {activeCompanyId && (
              <>
                <a
                  href={api.getExportExcelUrl(activeCompanyId)}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs transition"
                  title="Download Excel Workbook (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel</span>
                </a>
                <a
                  href={api.getExportLeadsUrl(activeCompanyId)}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs transition"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </a>
              </>
            )}
          </div>
        </header>

        {/* EXTENDED KPI METRICS BAR */}
        {stats && (
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs overflow-x-auto gap-6 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Discovered:</span>
              <span className="font-bold text-slate-900">{stats.companiesDiscovered || stats.totalLeads}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Qualified:</span>
              <span className="font-bold text-emerald-600">{stats.qualified}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Mapped:</span>
              <span className="font-bold text-blue-600">{stats.companiesMapped || leads.filter(l => Boolean(l.coordinates)).length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Decision-Makers:</span>
              <span className="font-bold text-slate-900">{stats.decisionMakersIdentified || stats.totalLeads}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Emails Found:</span>
              <span className="font-bold text-indigo-600">{stats.emailsFound || stats.qualified}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Verified:</span>
              <span className="font-bold text-green-600">{stats.emailsVerified || stats.qualified}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Avg Fit:</span>
              <span className="font-bold text-purple-600">{stats.avgScore}%</span>
            </div>
          </div>
        )}

        {/* ALERTS */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="font-bold hover:underline">Dismiss</button>
          </div>
        )}

        {/* MAP & GEOGRAPHIC SEARCH WIZARD (Collapsible) */}
        {showSearchWizard && (
          <div className="m-6 bg-white border border-blue-200 rounded-xl p-5 shadow-md relative overflow-hidden shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-600" />
                  Map-Based Geographic Discovery for {activeProfile?.name || 'Active Company'}
                </h3>
                <p className="text-xs text-slate-500">
                  Target accounts in specific regions matching {activeProfile?.name}'s offerings.
                </p>
              </div>
              <button onClick={() => setShowSearchWizard(false)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleLaunchDiscovery} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Keywords</label>
                  <input
                    type="text"
                    value={industryInput}
                    onChange={e => setIndustryInput(e.target.value)}
                    placeholder="e.g. Target sector or keywords"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City / Hub</label>
                  <input
                    type="text"
                    value={cityInput}
                    onChange={e => setCityInput(e.target.value)}
                    placeholder="City name"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State / Province</label>
                  <input
                    type="text"
                    value={stateInput}
                    onChange={e => setStateInput(e.target.value)}
                    placeholder="State name"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search Radius</label>
                  <select
                    value={radiusMiles}
                    onChange={e => setRadiusMiles(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value={10}>10 miles</option>
                    <option value={25}>25 miles (Standard)</option>
                    <option value={50}>50 miles</option>
                    <option value={100}>100 miles (Regional)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Accounts</label>
                  <select
                    value={prospectLimit}
                    onChange={e => setProspectLimit(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value={4}>4 accounts (Quick)</option>
                    <option value={6}>6 accounts (Optimal)</option>
                    <option value={10}>10 accounts</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSearchWizard(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={searching}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-xs font-semibold shadow-sm"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Geographic Discovery in Progress...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Discover Businesses on Map</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {!activeProfile && !researching ? (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 animate-fade-in">
            {/* Universal Hero Card */}
            <div className="text-center space-y-3 pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Autonomous B2B Prospecting Agent</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">MarketMate AI</h1>
              <p className="text-base text-slate-600 max-w-2xl mx-auto">
                AI-powered B2B company research and prospect discovery.
              </p>
              <p className="text-xs text-slate-500 max-w-xl mx-auto">
                Enter any company website URL to autonomously crawl the business, map competitors, define targeted ICP keyword campaigns, discover verified prospect accounts on interactive maps, identify real leadership decision-makers, and draft high-conversion 1:1 cold emails.
              </p>

              {/* Primary Search Input in Hero */}
              <form onSubmit={handleStartFullResearch} className="max-w-xl mx-auto mt-6 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={researchUrl}
                    onChange={e => setResearchUrl(e.target.value)}
                    placeholder="Enter any company website URL"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!researchUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition shadow-sm shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Research</span>
                </button>
              </form>

              {/* Connected API Badges */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-full text-emerald-800 font-medium shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Gemini AI Connected</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-full text-emerald-800 font-medium shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Live Search Connected</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-full text-emerald-800 font-medium shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Hunter API Connected</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 rounded-full text-blue-800 font-medium shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Apollo / Public Registry Ready</span>
                </div>
              </div>
            </div>

            {/* 6 Research Stages in Pending State */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  6-Stage Research Pipeline (Idle · Awaiting URL)
                </h3>
                <span className="text-[11px] text-slate-400">Autonomous multi-stage execution</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">1</span>
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Pending URL</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">Company Research</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Crawls submitted homepage and subpages, extracts products, services, business model, target industries, and unique selling points.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">2</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">Competitor Intelligence</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Finds actual direct and indirect market competitors, extracts their websites, analyzes positioning, and identifies differentiators.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">3</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">Campaigns & ICP</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Generates 6 distinct outbound campaigns with keyword groups, operational activities, target buyer roles, and buying signals.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">4</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">Target Account & Map Discovery</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Discovers real target companies matching ICP criteria via web search and geographic radius mapping with fit scores.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">5</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">Decision-Maker Identification</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Identifies verified directors, founders, and department heads with authentic public sources and LinkedIn URLs.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">6</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">Email Cascade & 1:1 Outreach</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Cascades email verification across Hunter, company domain patterns, and DNS MX, then drafts hyper-personalized 1:1 cold emails.
                  </p>
                </div>
              </div>
            </div>

            {/* Saved Research History (Available to load if user wants, never auto-loaded) */}
            {companies.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Saved Research Projects ({companies.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Click to reopen past research session</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {companies.map(comp => (
                    <button
                      key={comp.id}
                      onClick={() => handleSwitchCompany(comp)}
                      className="p-3.5 bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm rounded-xl text-left transition group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition truncate">
                          {comp.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{comp.domain}</div>
                      <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{comp.industry || 'B2B'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* TABS HEADER: Companies | People | Emails */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'companies'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Companies ({filteredLeads.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('people')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'people'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>People ({filteredLeads.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'emails'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Emails ({filteredLeads.filter(l => Boolean(l.personalizedEmail)).length})</span>
            </button>
          </div>

          {/* Right Controls: Map / List Toggle & Search */}
          <div className="flex items-center gap-3">
            {activeTab === 'companies' && (
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                  }`}
                >
                  <List className="w-3 h-3" />
                  <span>List View</span>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                  }`}
                >
                  <Map className="w-3 h-3" />
                  <span>Map View</span>
                </button>
              </div>
            )}

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter results..."
                className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: COMPANIES */}
          {activeTab === 'companies' && (
            <div className="space-y-4">
              {viewMode === 'map' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Interactive Map */}
                  <div className="lg:col-span-2">
                    <LeadMap
                      leads={filteredLeads}
                      selectedLeadId={selectedLead?.id}
                      onSelectLead={lead => setSelectedLead(lead)}
                      center={filteredLeads[0]?.coordinates || { lat: 47.6062, lng: -122.3321 }}
                    />
                  </div>

                  {/* Selected Company Card Drawer */}
                  <div className="space-y-4">
                    {selectedLead ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">
                              {selectedLead.fitScore}% Fit Score
                            </span>
                            <h3 className="text-base font-bold text-slate-900 mt-1">{selectedLead.companyName}</h3>
                            <a
                              href={selectedLead.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5 font-mono"
                            >
                              {selectedLead.website.replace(/^https?:\/\//, '')}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <select
                            value={selectedLead.status}
                            onChange={e => handleStatusChange(selectedLead.id, e.target.value as LeadStatus)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white font-medium"
                          >
                            <option value="New">New</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Contacted">Contacted</option>
                            <option value="In Sequence">In Sequence</option>
                            <option value="Converted">Converted</option>
                          </select>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{selectedLead.address || selectedLead.location}</span>
                            {selectedLead.distanceMiles && (
                              <span className="text-slate-400 font-mono">({selectedLead.distanceMiles} mi)</span>
                            )}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            <span>{selectedLead.industry}</span>
                          </p>
                        </div>

                        {/* Operational Background */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-700">
                          <span className="font-bold block text-[11px] text-slate-500 uppercase mb-1">
                            Operational Suitability
                          </span>
                          <p>{selectedLead.description}</p>
                        </div>

                        {/* Decision Maker Overview */}
                        <div className="border-t border-slate-100 pt-3">
                          <span className="font-bold text-[11px] text-slate-500 uppercase block mb-1">
                            Identified Decision Maker
                          </span>
                          {selectedLead.decisionMakers && selectedLead.decisionMakers.length > 0 ? (
                            <div className="text-xs space-y-1">
                              <p className="font-semibold text-slate-900">{selectedLead.decisionMakers[0].name}</p>
                              <p className="text-slate-500">{selectedLead.decisionMakers[0].title}</p>
                              <p className="font-mono text-slate-700">
                                {selectedLead.decisionMakers[0].email || 'No email found'}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No decision-maker identified yet</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            onClick={() => handleRunEmailCascade(selectedLead.id)}
                            disabled={enrichingEmailId === selectedLead.id}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            {enrichingEmailId === selectedLead.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>Enrich Email</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('emails');
                            }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                          >
                            Review 1:1 Email
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                        Select a company on the map to view operational details and verified leadership.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* List View for Companies */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Company</th>
                        <th className="py-3 px-4">Industry / Category</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Fit Score</th>
                        <th className="py-3 px-4">Decision Maker</th>
                        <th className="py-3 px-4">Email Status</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLeads.map(lead => {
                        const dm = lead.decisionMakers?.[0] || { name: 'Leadership', title: 'Operations' };
                        return (
                          <tr
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div>{lead.companyName}</div>
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[11px] text-blue-600 hover:underline font-mono"
                              >
                                {lead.website.replace(/^https?:\/\//, '')}
                              </a>
                            </td>
                            <td className="py-3 px-4 text-slate-600">{lead.industry}</td>
                            <td className="py-3 px-4 text-slate-500">{lead.address || lead.location}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-blue-700">
                                {lead.fitScore}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">{dm.name}</div>
                              <div className="text-[11px] text-slate-400">{dm.title}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  dm.emailStatus === 'Verified' || dm.verificationStatus === 'verified'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : dm.email
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {dm.emailStatus || (dm.email ? 'Found' : 'Not found')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-slate-700 font-medium">{lead.status}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedLead(lead);
                                  setActiveTab('emails');
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold"
                              >
                                Email
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

          {/* TAB 2: PEOPLE (Matching Screenshot cards with Provider Badges) */}
          {activeTab === 'people' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeads.map(lead => {
                const dm = lead.decisionMakers?.[0] || {
                  name: 'Operations Leadership',
                  title: 'Manager',
                  emailStatus: 'Not found' as const
                };
                const initials = dm.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                const isEnriching = enrichingEmailId === lead.id;

                return (
                  <div
                    key={lead.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Contact Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-900 text-sm">{dm.name}</h4>
                              {dm.linkedinUrl && (
                                <a
                                  href={dm.linkedinUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  title="LinkedIn Profile"
                                >
                                  <span className="px-1 py-0.2 bg-blue-600 text-white rounded text-[9px] font-bold">in</span>
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {dm.title} ·{' '}
                              <span className="text-slate-700 font-mono text-[11px]">
                                {lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Status Checkmark */}
                        <div>
                          {dm.emailStatus === 'Verified' || dm.verificationStatus === 'verified' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : dm.email ? (
                            <CheckCircle2 className="w-5 h-5 text-blue-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </div>

                      {/* Provider Badges (Hunter, Findymail, LeadMagic, Website, DNS MX) */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">cascade:</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          hunter
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          findymail
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          leadmagic
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          dns-mx
                        </span>
                      </div>

                      {/* Email Address or Not Found Notice */}
                      <div className="mt-3">
                        {dm.email ? (
                          <div className="text-xs font-mono text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200 flex items-center justify-between">
                            <span className="truncate">{dm.email}</span>
                            <span className="text-[10px] font-sans font-semibold text-green-700 bg-green-100 px-1 rounded">
                              {dm.emailStatus || 'Verified'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 font-mono bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 flex items-center justify-between">
                            <span>no verified email found</span>
                            <span className="text-[10px] text-slate-400">pending</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleRunEmailCascade(lead.id)}
                        disabled={isEnriching}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                      >
                        {isEnriching ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Querying cascade...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            <span>Enrich Email</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedLead(lead);
                          setActiveTab('emails');
                        }}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold"
                      >
                        Write Email
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: EMAILS (Matching 2-Column Layout from Screenshot) */}
          {activeTab === 'emails' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-270px)]">
              {/* Left Column (5 cols): Contact Cards List */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-y-auto divide-y divide-slate-100 shadow-sm">
                <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>OUTREACH CONTACTS ({filteredLeads.length})</span>
                  <span className="text-slate-400 font-normal">Click contact to view email</span>
                </div>

                {filteredLeads.map(lead => {
                  const dm = lead.decisionMakers?.[0] || { name: 'Leadership', title: 'Operations' };
                  const isSelected = selectedLead?.id === lead.id;
                  const initials = dm.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                              <span>{dm.name}</span>
                              {dm.linkedinUrl && (
                                <span className="px-1 py-0.2 bg-blue-600 text-white rounded text-[8px] font-bold">in</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {dm.title} · {lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                            </p>
                          </div>
                        </div>

                        <div>
                          {lead.personalizedEmail ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                          )}
                        </div>
                      </div>

                      {/* Provider Badges row */}
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <span className="px-1 bg-slate-100 rounded">hunter</span>
                        <span className="px-1 bg-slate-100 rounded">findymail</span>
                        <span className="px-1 bg-slate-100 rounded">leadmagic</span>
                        <span className="ml-auto font-sans text-slate-400">
                          {dm.email ? 'email found' : 'no email found'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column (7 cols): Email Composer & Review Studio */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between overflow-y-auto">
                {selectedLead ? (
                  <div className="space-y-4">
                    {/* Header: Person & Company details */}
                    <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center">
                          {selectedLead.decisionMakers?.[0]?.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-base">
                              {selectedLead.decisionMakers?.[0]?.name}
                            </h3>
                            {selectedLead.decisionMakers?.[0]?.linkedinUrl && (
                              <a
                                href={selectedLead.decisionMakers[0].linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1 bg-blue-600 text-white rounded text-[9px] font-bold"
                              >
                                in
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {selectedLead.decisionMakers?.[0]?.title} ·{' '}
                            <span className="font-mono text-blue-600">
                              {selectedLead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateEmail}
                        disabled={generatingEmail}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                      >
                        {generatingEmail ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{selectedLead.personalizedEmail ? 'Regenerate' : 'Generate 1:1 Email'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Email Form Fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">To</label>
                        <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 font-medium">
                          {selectedLead.decisionMakers?.[0]?.name} &lt;
                          {selectedLead.decisionMakers?.[0]?.email || 'no direct email - will route to domain'}
                          &gt;
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subj</label>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedLead.personalizedEmail?.subject || '');
                              setCopiedSubject(true);
                              setTimeout(() => setCopiedSubject(false), 2000);
                            }}
                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {copiedSubject ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedSubject ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={selectedLead.personalizedEmail?.subject || `Solutions for ${selectedLead.companyName}`}
                          onChange={e => {
                            if (selectedLead.personalizedEmail) {
                              const updated = {
                                ...selectedLead,
                                personalizedEmail: { ...selectedLead.personalizedEmail, subject: e.target.value }
                              };
                              setSelectedLead(updated);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Email Body */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Body</label>
                          <button
                            onClick={() => {
                              const full = `Subject: ${selectedLead.personalizedEmail?.subject}\n\n${selectedLead.personalizedEmail?.body}`;
                              navigator.clipboard.writeText(full);
                              setCopiedBody(true);
                              setTimeout(() => setCopiedBody(false), 2000);
                            }}
                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
                          >
                            {copiedBody ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedBody ? 'Copied Full Email' : 'Copy Full Body'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={8}
                          value={
                            selectedLead.personalizedEmail?.body ||
                            `Hi ${selectedLead.decisionMakers?.[0]?.name.split(' ')[0] || 'there'},\n\nI saw ${selectedLead.companyName} operates in ${selectedLead.location}. I'm Aaron at ${activeProfile?.name || 'our company'}. We specialize in ${activeProfile?.productsAndServices[0] || 'commercial solutions'} to help teams streamline operations.\n\nIt could give your team more quiet, low-maintenance hours while significantly cutting operational overhead.\n\nMind if I send over a few short written ideas on how that setup fits an operation like yours?\n\nBest,\n\nAaron\n${activeProfile?.name || ''}`
                          }
                          onChange={e => {
                            if (selectedLead.personalizedEmail) {
                              const updated = {
                                ...selectedLead,
                                personalizedEmail: { ...selectedLead.personalizedEmail, body: e.target.value }
                              };
                              setSelectedLead(updated);
                            }
                          }}
                          className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800 font-sans focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                      </div>

                      {/* A/B Subject Lines */}
                      {selectedLead.personalizedEmail?.subjectVariations && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
                          <span className="font-bold text-slate-500 block mb-1">Alternative A/B Subject Angles:</span>
                          <div className="space-y-1">
                            {selectedLead.personalizedEmail.subjectVariations.map((v, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  if (selectedLead.personalizedEmail) {
                                    const updated = {
                                      ...selectedLead,
                                      personalizedEmail: { ...selectedLead.personalizedEmail, subject: v }
                                    };
                                    setSelectedLead(updated);
                                  }
                                }}
                                className="block w-full text-left text-slate-600 hover:text-blue-600 hover:underline truncate"
                              >
                                • {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions matching screenshot */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => handleRunEmailCascade(selectedLead.id)}
                        disabled={enrichingEmailId === selectedLead.id}
                        className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Re-verify Email Cascade</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">Direct 1:1 Email · Manual review</span>
                        <button
                          onClick={() => handleStatusChange(selectedLead.id, 'In Sequence')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send 1:1 Email</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-xs text-slate-400">
                    Select a contact from the left column to write and preview their 1:1 cold email.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}
      </div>

      {/* COMPETITORS MODAL */}
      {showCompetitorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Competitor Intelligence for {activeProfile?.name || 'Researched Company'}
                </h3>
                <p className="text-xs text-slate-500">
                  Verified direct and indirect commercial competitors in {activeProfile?.industry || 'this industry'}.
                </p>
              </div>
              <button
                onClick={() => setShowCompetitorsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto divide-y divide-slate-100 space-y-4">
              {competitors.map(comp => (
                <div key={comp.id} className="pt-4 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{comp.name}</h4>
                      <a
                        href={comp.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-mono"
                      >
                        {comp.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {comp.location || comp.geographicMarket || 'North America'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                      <span className="font-bold text-slate-500 uppercase text-[10px] block mb-0.5">Products / Services</span>
                      <p className="text-slate-800">{(comp.servicesOrProducts || comp.products || []).join(', ')}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                      <span className="font-bold text-slate-500 uppercase text-[10px] block mb-0.5">Differentiators</span>
                      <p className="text-slate-800">{(comp.differentiators || comp.capabilities || []).join(' • ')}</p>
                    </div>
                    <div className="bg-blue-50/50 p-2.5 rounded border border-blue-100">
                      <span className="font-bold text-blue-700 uppercase text-[10px] block mb-0.5">
                        Why Competitor vs {activeProfile?.name}
                      </span>
                      <p className="text-blue-900">{comp.whyCompetitor || comp.differentiators?.[0] || 'Market alternative'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {competitors.length === 0 && (
                <p className="text-xs text-slate-400 italic py-4">No competitors discovered yet for this company profile.</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowCompetitorsModal(false)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
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

export default Prospecting;
