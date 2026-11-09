import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  Search,
  Globe2,
  Mail,
  FileText,
  BarChart3,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Cpu,
  BookOpen,
  Users
} from 'lucide-react';
import { api } from '../services/api';
import { AppStats, ConversationSummary, SystemSettings } from '../types';

interface DashboardProps {
  settings: SystemSettings | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ settings }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AppStats>({
    totalTasks: 0,
    completedTasks: 0,
    totalConversations: 0,
    totalMessages: 0
  });
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);
  const [quickInput, setQuickInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsData, convsData] = await Promise.all([
          api.getStats().catch(() => ({ totalTasks: 0, completedTasks: 0, totalConversations: 0, totalMessages: 0 })),
          api.getConversations().catch(() => [])
        ]);
        setStats(statsData);
        setRecentConversations(convsData.slice(0, 5));
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    navigate(`/workspace?prompt=${encodeURIComponent(quickInput.trim())}`);
  };

  const specialists = [
    {
      title: 'Research Agent',
      desc: 'Competitor mapping, ICP profiling & live web research',
      icon: Search,
      path: '/research',
      tag: 'Search Grounded'
    },
    {
      title: 'B2B Lead Prospector',
      desc: 'Account discovery, DNS MX verification & 1:1 outreach',
      icon: Users,
      path: '/prospecting',
      tag: 'DNS MX & Leads'
    },
    {
      title: 'SEO & GEO Agent',
      desc: 'Technical audit, meta generation & AI search readiness',
      icon: Globe2,
      path: '/seo',
      tag: 'Live Crawler'
    },
    {
      title: 'Email Marketing',
      desc: 'High-converting cold sequences & follow-up cadences',
      icon: Mail,
      path: '/email',
      tag: 'Copy Studio'
    },
    {
      title: 'Content Creator',
      desc: 'Viral LinkedIn posts, social calendars & SEO articles',
      icon: FileText,
      path: '/content',
      tag: 'Multi-Platform'
    },
    {
      title: 'Report Analyst',
      desc: 'Document intelligence, CSV calculations & PDF reports',
      icon: BarChart3,
      path: '/reports',
      tag: 'Data & PDF'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                MarketMate AI Autonomous Suite
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                All 7 Phases Active
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome to your Marketing & Research Assistant
            </h1>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              An AI-powered workspace that researches live companies, audits website SEO, writes high-converting copy, processes uploaded documents, and executes multi-tool marketing workflows.
            </p>
          </div>

          {/* Status Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 shrink-0 text-xs space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between text-slate-500">
              <span>Agent Status:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Autonomous Engine Ready
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Active Model:</span>
              <span className="font-mono text-slate-700 font-medium">{settings?.activeModel || 'gemini-2.5-flash'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>API Key:</span>
              <span className={settings?.configured ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                {settings?.configured ? 'Connected & Verified' : 'Needs Key'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Task Input Bar */}
        <form onSubmit={handleQuickSubmit} className="mt-6 pt-6 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Give MarketMate AI a Task
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-xl p-1.5 focus-within:border-violet-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100 transition">
            <Bot className="w-4 h-4 text-violet-600 ml-2.5 shrink-0" />
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="e.g. Research 10 cloud migration companies in India, compare their services, and prepare a competitor report..."
              className="w-full bg-transparent border-0 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 py-1.5"
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
            >
              <span>Execute Task</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Real KPI Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Tasks</span>
            <ListTodo className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalTasks}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Tracked in persistent store</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.completedTasks}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Finished workflows</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Conversations</span>
            <MessageSquare className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalConversations}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Active chat threads</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Messages</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalMessages}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Prompt & AI turns</p>
        </div>
      </div>

      {/* Specialist Agents Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Specialist Agents</h2>
            <p className="text-xs text-slate-500">Dedicated domain modules with direct execution engines</p>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">All 5 Specialists Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {specialists.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                className="bg-white rounded-xl border border-slate-200/80 p-4 hover:border-violet-400 hover:shadow-md transition text-left flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-violet-50 group-hover:text-violet-600 group-hover:border-violet-100 transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-slate-800 group-hover:text-violet-700 transition">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-violet-600 font-medium">
                  <span>Open Agent</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity / Chats Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Conversations</h2>
          <button
            onClick={() => navigate('/workspace')}
            className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition"
          >
            Open All in Workspace &rarr;
          </button>
        </div>

        {recentConversations.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            <p>No conversations recorded yet.</p>
            <button
              onClick={() => navigate('/workspace?new=1')}
              className="mt-2 text-violet-600 font-medium hover:underline"
            >
              Start your first conversation with MarketMate AI
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => navigate(`/workspace?id=${conv.id}`)}
                className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">{conv.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate max-w-md">{conv.lastMessage || 'No messages yet'}</p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400 shrink-0">
                  <div>{conv.messageCount} messages</div>
                  <div className="text-[10px]">{new Date(conv.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
