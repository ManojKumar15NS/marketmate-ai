import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { AgentWorkspace } from './pages/AgentWorkspace';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { Research } from './pages/Research';
import { SEO } from './pages/SEO';
import { SeoEditor } from './pages/SeoEditor';
import { Email } from './pages/Email';
import { Content } from './pages/Content';
import { Reports } from './pages/Reports';
import { Knowledge } from './pages/Knowledge';
import { Prospecting } from './pages/Prospecting';
import { EmailFinder } from './pages/EmailFinder';
import { JobProvider } from './context/JobContext';
import { BackgroundActivityPanel } from './components/BackgroundActivityPanel';
import { api } from './services/api';
import { SystemSettings } from './types';

function AppLayout() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const getPageTitle = (pathname: string): { title: string; subtitle?: string } => {
    switch (pathname) {
      case '/':
        return { title: 'Workspace Overview', subtitle: 'Real-time marketing KPI summary & recent tasks' };
      case '/workspace':
        return { title: 'AI Agent Workspace', subtitle: 'Multi-turn conversational marketing assistant' };
      case '/tasks':
        return { title: 'Tasks & Workflows', subtitle: 'Persistent task registry & execution queue' };
      case '/research':
        return { title: 'Research Agent', subtitle: 'Competitor & market intelligence specialist' };
      case '/seo':
        return { title: 'SEO & GEO Agent', subtitle: 'Technical audit & search optimization specialist' };
      case '/email':
        return { title: 'Email Marketing Agent', subtitle: 'Cold outreach & conversion copy specialist' };
      case '/content':
        return { title: 'Content Creator Agent', subtitle: 'Social thought leadership & blog article specialist' };
      case '/reports':
        return { title: 'Report Analyst Agent', subtitle: 'Document intelligence & numerical analysis specialist' };
      case '/prospecting':
        return { title: 'B2B Lead Prospector', subtitle: 'Target account discovery, DNS MX verification & 1:1 personalized outreach' };
      case '/email-finder':
        return { title: 'Email Finder', subtitle: 'Discover verified professional emails across companies and keyword networks' };
      case '/knowledge':
        return { title: 'Knowledge Base', subtitle: 'Company profile & persistent business memory' };
      case '/settings':
        return { title: 'System Settings', subtitle: 'Gemini API key management & runtime diagnostics' };
      default:
        return { title: 'MarketMate AI' };
    }
  };

  const { title, subtitle } = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        settings={settings}
        onNewChat={() => navigate('/workspace?new=1')}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          settings={settings}
        />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard settings={settings} />} />
            <Route path="/workspace" element={<AgentWorkspace settings={settings} />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/research" element={<Research />} />
            <Route path="/seo" element={<SEO />} />
            <Route path="/seo-editor" element={<SeoEditor />} />
            <Route path="/email" element={<Email />} />
            <Route path="/content" element={<Content />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/prospecting" element={<Prospecting />} />
            <Route path="/email-finder" element={<EmailFinder />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route
              path="/settings"
              element={
                <Settings
                  settings={settings}
                  onRefreshSettings={fetchSettings}
                />
              }
            />
          </Routes>
        </main>
      </div>

      {/* Global Background Activity Slide-Over Panel */}
      <BackgroundActivityPanel />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <JobProvider>
        <AppLayout />
      </JobProvider>
    </BrowserRouter>
  );
}

export default App;
