import React from 'react';
import { Search, Mail, Globe2, FileText, Sparkles, ArrowUpRight } from 'lucide-react';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  {
    icon: Search,
    title: 'Market & Competitor Analysis',
    prompt: 'Find 5 leading companies in India offering cloud migration services. Analyze their services, target audience, and positioning differentiators.',
    badge: 'Research'
  },
  {
    icon: Globe2,
    title: 'Website SEO Strategy',
    prompt: 'Provide an actionable SEO audit checklist and meta tag recommendations for an enterprise B2B SaaS website launching an AI analytics product.',
    badge: 'SEO'
  },
  {
    icon: Mail,
    title: 'Cold Outreach Sequence',
    prompt: 'Draft a 3-part cold email sequence targeted at CTOs and VP Engineering for our cybersecurity audit services. Make the tone persuasive and professional.',
    badge: 'Email'
  },
  {
    icon: FileText,
    title: 'LinkedIn Thought Leadership',
    prompt: 'Write 2 high-impact LinkedIn posts about the shift from basic chatbots to multi-tool agentic workflows in B2B marketing. Include strong hooks and CTAs.',
    badge: 'Content'
  }
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center">
      {/* Icon & Welcome */}
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-violet-200">
        <Sparkles className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 tracking-tight">
        MarketMate AI Workspace
      </h2>
      <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
        Your personal marketing and research assistant powered by Google Gemini. Ask any question, draft campaigns, or launch strategic research.
      </p>

      {/* Suggested Starters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 text-left">
        {STARTER_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(item.prompt)}
              className="group p-4 rounded-xl border border-slate-200/90 bg-white hover:border-violet-400 hover:shadow-md transition text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 group-hover:bg-violet-100 group-hover:text-violet-700 transition">
                    {item.badge}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-600 transition" />
                </div>
                <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-violet-600" />
                  {item.title}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {item.prompt}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
