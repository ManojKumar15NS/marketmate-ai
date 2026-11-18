import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Building2,
  ExternalLink,
  Search,
  Sparkles,
  Download,
  CheckCircle2,
  Clock,
  Layers,
  Eye,
  Activity,
  Heart,
  Briefcase,
  Rocket,
  Cpu,
  Factory
} from 'lucide-react';
import api from '../services/api';
import { VerifiedEvent, EventSearchResult } from '../types';

interface CategoryPill {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const CATEGORY_PILLS: CategoryPill[] = [
  { id: '', label: 'All Categories', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'Eye Care & Optometry', label: 'Eye & Optometric', icon: <Eye className="w-3.5 h-3.5" /> },
  { id: 'Orthopedics & Joint Surgery', label: 'Orthopedic & Surgery', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'Cardiology & Heart Care', label: 'Cardiology & Heart', icon: <Heart className="w-3.5 h-3.5" /> },
  { id: 'Hospital & Healthcare', label: 'Hospital & Doctors', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'Startups & Funding', label: 'Startups & VCs', icon: <Rocket className="w-3.5 h-3.5" /> },
  { id: 'Business & B2B', label: 'Business & B2B', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'Enterprise Tech & AI', label: 'Tech & AI', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'Manufacturing & Trade', label: 'Manufacturing & Trade', icon: <Factory className="w-3.5 h-3.5" /> }
];

export const EventFinder: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<EventSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // No automatic search on mount - user initiates search with their chosen keyword or category

  const handleSearch = async (kw = keyword, loc = location, cat = selectedCategory) => {
    setIsSearching(true);
    setHasSearched(true);
    setErrorMsg(null);
    try {
      const res = await api.searchEvents({
        keyword: kw.trim(),
        location: loc.trim() || 'India',
        category: cat || undefined,
        limit: 100
      });
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setErrorMsg('No events found for this filter. Try a broader keyword or city.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to search events.');
    } finally {
      setIsSearching(false);
    }
  };

  const onSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    handleSearch(keyword, location, catId);
  };

  const exportCsv = () => {
    if (!results || results.events.length === 0) return;
    const headers = ['Event Name', 'Category', 'Organizer', 'Dates', 'Venue', 'City', 'Country', 'Source URL'];
    const rows = results.events.map(e => [
      `"${e.title.replace(/"/g, '""')}"`,
      `"${(e.mainCategory || e.category).replace(/"/g, '""')}"`,
      `"${e.organizer.replace(/"/g, '""')}"`,
      `"${e.dates.replace(/"/g, '""')}"`,
      `"${e.venue.replace(/"/g, '""')}"`,
      `"${e.city.replace(/"/g, '""')}"`,
      `"${e.country.replace(/"/g, '""')}"`,
      `"${e.sourceUrl.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upcoming-events-${(keyword || selectedCategory || 'events').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="p-6 bg-white border-b border-slate-200 shrink-0 space-y-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>Event & Conference Tracker</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter any keyword (e.g. <strong>EYE</strong>, <strong>Optometric</strong>, <strong>Orthopedic</strong>, <strong>Hospital</strong>, <strong>Startups</strong>) to discover upcoming verified events across India.
            </p>
          </div>
          {results && results.events.length > 0 && (
            <button
              onClick={exportCsv}
              className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition self-start md:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({results.totalCount})</span>
            </button>
          )}
        </div>

        {/* Search Inputs */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3"
        >
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Search keyword: EYE, Optometric, Orthopedic, Hospital, Startups, Business..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="md:col-span-4 relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="City/Region: e.g. Bengaluru, Mumbai, Delhi (or leave blank for All India)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSearching}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSearching ? 'Searching...' : 'Find Events'}</span>
            </button>
          </div>
        </form>

        {/* Category Pills */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORY_PILLS.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Hub Cities */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] text-slate-500 pt-0.5">
            <span className="font-semibold text-slate-400 shrink-0">Popular Hubs:</span>
            {['All India', 'Bengaluru', 'Mumbai', 'New Delhi', 'Hyderabad', 'Kolkata'].map(hub => (
              <button
                key={hub}
                type="button"
                onClick={() => {
                  const locVal = hub === 'All India' ? '' : hub;
                  setLocation(locVal);
                  handleSearch(keyword, locVal, selectedCategory);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition shrink-0 ${
                  (location.toLowerCase() === hub.toLowerCase()) || (hub === 'All India' && !location)
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {hub}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

        {/* Summary Meta Bar */}
        {results && hasSearched && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{results.totalCount} Verified Events Found</span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-500">
                {keyword ? `Keyword: "${keyword}"` : selectedCategory || 'All Categories'}
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-500">Location: {results.query.location || 'India'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grounded in Official Medical & Trade Societies</span>
            </div>
          </div>
        )}

        {/* Event Cards Grid */}
        {results && results.events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.events.map(evt => (
              <div
                key={evt.id}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Category Badge & Verified Stamp */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider truncate">
                      {evt.mainCategory || evt.category}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                    {evt.title}
                  </h3>

                  {/* Organizer */}
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{evt.organizer}</span>
                  </div>

                  {/* Date & Venue */}
                  <div className="space-y-1.5 pt-1 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-slate-800">{evt.dates}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{evt.venue}, {evt.city}</span>
                    </div>
                  </div>

                  {/* Description */}
                  {evt.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-1 border-t border-slate-100">
                      {evt.description}
                    </p>
                  )}
                </div>

                {/* Footer Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={evt.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1.5 group-hover:underline"
                  >
                    <span>View Official Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {evt.registrationUrl && (
                    <a
                      href={evt.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-lg transition"
                    >
                      Register
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched && !isSearching ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <Calendar className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No Events Found</h3>
            <p className="text-xs max-w-sm mt-1 text-slate-500">
              Try switching categories or searching for keywords like "eye", "optometric", "orthopedic", "hospital", or "startups".
            </p>
          </div>
        ) : (
          /* Clean Initial State when user first opens the page */
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Event & Conference Intelligence</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Search across all major conferences and summits in India. Select any category above or enter a specialty keyword like <strong>EYE</strong>, <strong>Optometric</strong>, <strong>Orthopedic</strong>, <strong>Hospital</strong>, <strong>Startups</strong>, or <strong>B2B</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full pt-2">
              <button
                onClick={() => {
                  setKeyword('EYE');
                  handleSearch('EYE', location, 'Eye Care & Optometry');
                }}
                className="p-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-xs space-y-1 transition group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Eye & Optometric</span>
                </div>
                <div className="text-[10px] text-slate-400">AIOC, DOS, KOSCON, Cataract</div>
              </button>

              <button
                onClick={() => {
                  setKeyword('orthopedic');
                  handleSearch('orthopedic', location, 'Orthopedics & Joint Surgery');
                }}
                className="p-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-xs space-y-1 transition group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Orthopedic & Joints</span>
                </div>
                <div className="text-[10px] text-slate-400">IOACON, WIROC, KOACON</div>
              </button>

              <button
                onClick={() => {
                  setKeyword('hospital');
                  handleSearch('hospital', location, 'Hospital & Healthcare');
                }}
                className="p-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-xs space-y-1 transition group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Hospital & CAHO</span>
                </div>
                <div className="text-[10px] text-slate-400">Medical Fair, PULSE, HEAL</div>
              </button>

              <button
                onClick={() => {
                  setKeyword('startups');
                  handleSearch('startups', location, 'Startups & Funding');
                }}
                className="p-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-xs space-y-1 transition group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5 text-purple-500" />
                  <span>Startups & VCs</span>
                </div>
                <div className="text-[10px] text-slate-400">TechSparks, TiE, NASSCOM</div>
              </button>

              <button
                onClick={() => {
                  setKeyword('business');
                  handleSearch('business', location, 'Business & B2B');
                }}
                className="p-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-xs space-y-1 transition group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                  <span>Business & B2B</span>
                </div>
                <div className="text-[10px] text-slate-400">CII, FICCI, ASSOCHAM</div>
              </button>

              <button
                onClick={() => {
                  setKeyword('cardiology');
                  handleSearch('cardiology', location, 'Cardiology & Heart Care');
                }}
                className="p-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-xs space-y-1 transition group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Cardiology & Heart</span>
                </div>
                <div className="text-[10px] text-slate-400">CSI, India Live Conclave</div>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EventFinder;
