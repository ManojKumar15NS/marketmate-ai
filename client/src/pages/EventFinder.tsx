import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Building2,
  ExternalLink,
  Search,
  Sparkles,
  Download,
  Filter,
  CheckCircle2,
  Share2,
  Tag,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { VerifiedEvent, EventSearchResult } from '../types';

export const EventFinder: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('India');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<EventSearchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initial load with default medical / hospital events
  useEffect(() => {
    loadCategories();
    handleSearch('hospital doctors conference', 'India');
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.getEventCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (e) {
      console.warn('Failed to load categories', e);
    }
  };

  const handleSearch = async (kw = keyword, loc = location, cat = category) => {
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const res = await api.searchEvents({
        keyword: kw,
        location: loc,
        category: cat || undefined,
        limit: 100
      });
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setErrorMsg('No events returned. Please try another keyword or city.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to search events.');
    } finally {
      setIsSearching(false);
    }
  };

  const exportCsv = () => {
    if (!results || results.events.length === 0) return;
    const headers = ['Event Name', 'Organizer', 'Dates', 'Venue', 'City', 'Country', 'Category', 'Source URL'];
    const rows = results.events.map(e => [
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.organizer.replace(/"/g, '""')}"`,
      `"${e.dates.replace(/"/g, '""')}"`,
      `"${e.venue.replace(/"/g, '""')}"`,
      `"${e.city.replace(/"/g, '""')}"`,
      `"${e.country.replace(/"/g, '""')}"`,
      `"${e.category.replace(/"/g, '""')}"`,
      `"${e.sourceUrl.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upcoming-events-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Search & Filter Bar */}
      <header className="p-6 bg-white border-b border-slate-200 shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>Event Intelligence & Conference Tracker</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Discover verified upcoming medical, hospital, organizational, and tech conferences across India with exact dates, organizers, and verified source links.
            </p>
          </div>
          {results && results.events.length > 0 && (
            <button
              onClick={exportCsv}
              className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition self-start md:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Events ({results.totalCount})</span>
            </button>
          )}
        </div>

        {/* Search Input Controls */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3"
        >
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. Doctors, Hospital, Oncology, Surgery, AI, CAHO..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="md:col-span-3 relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Bangalore, Mumbai, Delhi, India..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={category}
              onChange={e => {
                setCategory(e.target.value);
                handleSearch(keyword, location, e.target.value);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        {/* Quick Location Pills */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs text-slate-500 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Popular Hubs:</span>
          {['All India', 'Bengaluru', 'Mumbai', 'New Delhi', 'Hyderabad', 'Chennai'].map(hub => (
            <button
              key={hub}
              type="button"
              onClick={() => {
                const locVal = hub === 'All India' ? 'India' : hub;
                setLocation(locVal);
                handleSearch(keyword, locVal, category);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition shrink-0 ${
                location.toLowerCase() === hub.toLowerCase() || (hub === 'All India' && location.toLowerCase() === 'india')
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {hub}
            </button>
          ))}
        </div>
      </header>

      {/* Main Events Feed */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

        {/* Results Metadata Bar */}
        {results && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{results.totalCount} Verified Upcoming Events Found</span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-500">Location: {results.query.location || 'India'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Verified Official Sources</span>
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
                  {/* Category & Verified Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider truncate">
                      {evt.category}
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

                  {/* Summary */}
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
        ) : (
          !isSearching && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Calendar className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Events Found</h3>
              <p className="text-xs max-w-sm mt-1 text-slate-500">
                Try widening your search keyword (e.g., "medical", "hospital", "doctor", "AI") or selecting "All India".
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default EventFinder;
