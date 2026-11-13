import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FileCode2,
  LayoutDashboard,
  Bot,
  Search,
  Globe2,
  Mail,
  FileText,
  BarChart3,
  ListTodo,
  History,
  BookOpen,
  Settings,
  Plus,
  Sparkles,
  KeyRound,
  UserCheck,
  Users,
  AtSign,
  MessageSquare
} from 'lucide-react';
import { SystemSettings } from '../types';

interface SidebarProps {
  settings: SystemSettings | null;
  onNewChat?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ settings, onNewChat }) => {
  const navigate = useNavigate();

  const handleNewChatClick = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      navigate('/workspace?new=1');
    }
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-violet-50 text-violet-700 font-semibold shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-violet-200">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              MarketMate <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Marketing & Research Agent</p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-3">
        <button
          onClick={handleNewChatClick}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>New AI Task / Chat</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-5 text-xs">
        {/* WORKSPACE */}
        <div>
          <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Workspace
          </p>
          <div className="space-y-0.5">
            <NavLink to="/" end className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-slate-500" />
                <span>Overview</span>
              </div>
            </NavLink>
            <NavLink to="/workspace" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Bot className="w-4 h-4 text-violet-600" />
                <span>AI Agent Workspace</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Core Engine" />
            </NavLink>
          </div>
        </div>

        {/* SPECIALIST AGENTS - All Active, No Coming Soon Labels */}
        <div>
          <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Specialist Agents
          </p>
          <div className="space-y-0.5">
            <NavLink to="/research" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-violet-500" />
                <span>Research Agent</span>
              </div>
            </NavLink>
            <NavLink to="/prospecting" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-blue-500" />
                <span>B2B Prospector</span>
              </div>
            </NavLink>
            <NavLink to="/email-finder" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <AtSign className="w-4 h-4 text-purple-500" />
                <span>Email Finder</span>
              </div>
            </NavLink>
            <NavLink to="/whatsapp" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Finder</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">NEW</span>
            </NavLink>
            <NavLink to="/seo-editor" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <FileCode2 className="w-4 h-4 text-emerald-600" />
                <span>SEO Content Editor</span>
              </div>
            </NavLink>
            <NavLink to="/seo" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Globe2 className="w-4 h-4 text-emerald-500" />
                <span>SEO and GEO Agent</span>
              </div>
            </NavLink>
            <NavLink to="/email" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-indigo-500" />
                <span>Email Marketing</span>
              </div>
            </NavLink>
            <NavLink to="/content" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-pink-500" />
                <span>Content Creator</span>
              </div>
            </NavLink>
            <NavLink to="/reports" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>Report Analyst</span>
              </div>
            </NavLink>
          </div>
        </div>

        {/* MANAGEMENT */}
        <div>
          <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Management
          </p>
          <div className="space-y-0.5">
            <NavLink to="/tasks" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <ListTodo className="w-4 h-4 text-slate-500" />
                <span>Tasks and Workflows</span>
              </div>
            </NavLink>
            <NavLink to="/workspace" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Chat History</span>
              </div>
            </NavLink>
            <NavLink to="/knowledge" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-slate-500" />
                <span>Knowledge Base</span>
              </div>
            </NavLink>
          </div>
        </div>

        {/* SETTINGS */}
        <div>
          <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Settings
          </p>
          <div className="space-y-0.5">
            <NavLink to="/settings" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-slate-500" />
                <span>API and Preferences</span>
              </div>
            </NavLink>
            <NavLink to="/settings#account" className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-slate-500" />
                <span>Account Settings</span>
              </div>
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Bottom Gemini Status Card */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <NavLink
          to="/settings"
          className="block p-2.5 rounded-lg border border-slate-200/80 bg-white hover:border-violet-300 transition text-xs"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  settings?.configured ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                }`}
              />
              {settings?.configured ? 'Gemini Ready' : 'Key Required'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {settings?.activeModel?.replace('gemini-', '') || '2.5-flash'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-slate-400 shrink-0" />
            {settings?.configured ? 'Connected & Verified' : 'Click to configure key'}
          </p>
        </NavLink>
      </div>
    </aside>
  );
};
