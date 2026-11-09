import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkles, ShieldCheck, Cpu, Layers, Loader2 } from 'lucide-react';
import { SystemSettings } from '../types';
import { useJobs } from '../context/JobContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  settings: SystemSettings | null;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Overview',
  subtitle,
  settings
}) => {
  const { activeCount, togglePanel } = useJobs();

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2.5 text-xs">
        {/* Background Activity Trigger Pill */}
        <button
          onClick={togglePanel}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition shadow-2xs ${
            activeCount > 0
              ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 animate-pulse'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Open persistent background activity panel"
        >
          {activeCount > 0 ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : (
            <Layers className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>{activeCount > 0 ? `${activeCount} Jobs Running` : 'Activity'}</span>
        </button>

        {/* Model Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/60 text-slate-600 font-medium text-[11px]">
          <Cpu className="w-3.5 h-3.5 text-violet-600" />
          <span>{settings?.activeModel || 'gemini-2.5-flash'}</span>
        </div>

        {/* Gemini Status Pill */}
        <NavLink
          to="/settings"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
            settings?.configured
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
        >
          {settings?.configured ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gemini Active</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Setup API Key</span>
            </>
          )}
        </NavLink>
      </div>
    </header>
  );
};
