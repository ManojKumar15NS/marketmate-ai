import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, ArrowRight, Sparkles, Clock, CheckCircle2 } from 'lucide-react';

interface SpecialistPlaceholderProps {
  title: string;
  phase: string;
  icon: LucideIcon;
  description: string;
  plannedFeatures: string[];
  suggestedPrompt: string;
}

export const SpecialistPlaceholder: React.FC<SpecialistPlaceholderProps> = ({
  title,
  phase,
  icon: Icon,
  description,
  plannedFeatures,
  suggestedPrompt
}) => {
  const navigate = useNavigate();

  const handleLaunchInChat = () => {
    navigate(`/workspace?prompt=${encodeURIComponent(suggestedPrompt)}`);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-3 h-3" />
                  {phase} (Coming Soon)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Phase Features Planned */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Planned Capabilities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {plannedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-slate-600 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
              >
                <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Callout */}
        <div className="mt-8 p-4 rounded-xl bg-violet-50/70 border border-violet-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-violet-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              Try this topic today in AI Agent Workspace
            </h4>
            <p className="text-[11px] text-violet-700/80 mt-0.5">
              MarketMate AI can already assist with this domain using direct Gemini intelligence.
            </p>
          </div>
          <button
            onClick={handleLaunchInChat}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition shrink-0 shadow-sm"
          >
            <span>Ask in Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
