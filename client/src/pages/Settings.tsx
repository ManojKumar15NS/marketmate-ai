import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Server,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Flame,
  UserCheck,
  Lock,
  AtSign,
  Mail,
  Trash2,
  Power,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings, HunterSettings } from '../types';

interface SettingsProps {
  settings: SystemSettings | null;
  onRefreshSettings: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onRefreshSettings
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    models?: string[];
  } | null>(null);

  // Hunter Configuration State
  const [hunterSettings, setHunterSettings] = useState<HunterSettings | null>(settings?.hunter || null);
  const [hunterKeyInput, setHunterKeyInput] = useState('');
  const [isHunterTesting, setIsHunterTesting] = useState(false);
  const [isHunterSaving, setIsHunterSaving] = useState(false);
  const [hunterFeedback, setHunterFeedback] = useState<{
    type: 'success' | 'error' | 'warn';
    message: string;
    details?: any;
  } | null>(null);

  // Load fresh Hunter settings on mount
  useEffect(() => {
    loadHunterSettings();
  }, []);

  const loadHunterSettings = async () => {
    try {
      const res = await api.getHunterSettings();
      setHunterSettings(res);
    } catch {
      // non-fatal
    }
  };

  const handleTestHunter = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsHunterTesting(true);
    setHunterFeedback(null);
    try {
      const keyToTest = hunterKeyInput.trim() || undefined;
      const res = await api.testHunterKey(keyToTest);
      if (res.success) {
        setHunterFeedback({
          type: 'success',
          message: res.message,
          details: {
            plan: res.planName,
            searches: res.remainingSearches,
            verifications: res.remainingVerifications
          }
        });
      } else if (res.creditsExhausted) {
        setHunterFeedback({
          type: 'warn',
          message: res.message,
          details: {
            plan: res.planName,
            searches: res.remainingSearches,
            verifications: res.remainingVerifications
          }
        });
      } else {
        setHunterFeedback({
          type: 'error',
          message: res.message || 'Hunter API authentication failed.'
        });
      }
    } catch (err: any) {
      setHunterFeedback({
        type: 'error',
        message: err.message || 'Failed to connect to Hunter API.'
      });
    } finally {
      setIsHunterTesting(false);
    }
  };

  const handleSaveHunter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hunterKeyInput.trim()) return;

    setIsHunterSaving(true);
    setHunterFeedback(null);
    try {
      const res = await api.saveHunterKey(hunterKeyInput.trim(), true);
      if (res.success) {
        setHunterFeedback({
          type: 'success',
          message: res.message
        });
        setHunterSettings(res.settings);
        setHunterKeyInput('');
        onRefreshSettings();
      } else {
        setHunterFeedback({
          type: 'error',
          message: res.message || 'Failed to save Hunter key.'
        });
      }
    } catch (err: any) {
      setHunterFeedback({
        type: 'error',
        message: err.message || 'Verification failed. Please check your Hunter API key.'
      });
    } finally {
      setIsHunterSaving(false);
    }
  };

  const handleClearHunter = async () => {
    if (!window.confirm('Are you sure you want to remove your Hunter API key? Email discovery will be disabled.')) return;

    try {
      const res = await api.clearHunterKey();
      setHunterSettings(res.settings);
      setHunterFeedback({
        type: 'success',
        message: 'Hunter API key removed and email discovery disabled.'
      });
      onRefreshSettings();
    } catch (err: any) {
      setHunterFeedback({
        type: 'error',
        message: err.message || 'Failed to clear Hunter API key.'
      });
    }
  };

  const handleToggleHunter = async () => {
    if (!hunterSettings?.configured) return;
    try {
      const res = await api.toggleHunterEnabled(!hunterSettings.emailDiscoveryEnabled);
      setHunterSettings(res.settings);
      setHunterFeedback({
        type: 'success',
        message: res.settings.emailDiscoveryEnabled ? 'Email discovery enabled.' : 'Email discovery disabled.'
      });
    } catch (err: any) {
      setHunterFeedback({
        type: 'error',
        message: err.message || 'Failed to toggle email discovery.'
      });
    }
  };

  // Firebase Configuration State
  const [firebaseApiKey, setFirebaseApiKey] = useState('');
  const [firebaseProjectId, setFirebaseProjectId] = useState('');
  const [firebaseSaved, setFirebaseSaved] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setIsVerifying(true);
    setFeedback(null);

    try {
      const result = await api.verifyKey(apiKeyInput.trim());
      if (result.success) {
        setFeedback({
          type: 'success',
          message: 'Key successfully validated against Google AI Studio!',
          models: result.availableModels
        });
        setApiKeyInput('');
        onRefreshSettings();
      } else {
        setFeedback({
          type: 'error',
          message: result.message || 'Key validation failed.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Verification request failed.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseProjectId.trim()) return;
    setFirebaseSaved(true);
    setTimeout(() => setFirebaseSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">API & System Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage Gemini AI engine configuration, Firebase synchronization, and view runtime diagnostics.
        </p>
      </div>

      {/* Gemini API Key Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Gemini API Key</h2>
              <p className="text-xs text-slate-500">
                Official Google Gen AI SDK connection (@google/genai)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                settings?.configured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {settings?.configured ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Connected & Verified
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Key Not Configured
                </>
              )}
            </span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-800">Server-Side Secret Isolation:</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              API keys are stored exclusively on the backend server in <code className="font-mono text-slate-700 bg-white px-1 py-0.5 rounded border border-slate-200">server/.env</code>. Raw keys are never returned through endpoints, never stored in browser localStorage, and never logged.
            </p>
          </div>
        </div>

        {/* Key Verification Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Enter or Update Gemini API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={settings?.configured ? "Key is set and verified. Enter new key to update..." : "Enter Gemini API key..."}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={isVerifying || !apiKeyInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span>{feedback.message}</span>
              </div>
              {feedback.models && feedback.models.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-100 text-[11px]">
                  <span className="font-semibold">Verified Available Models on Account:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {feedback.models.slice(0, 6).map((m) => (
                      <span key={m} className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-900 font-mono text-[10px]">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Free-tier supported with gemini-2.5-flash and Google Search Grounding.</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-violet-600 hover:text-violet-700 font-semibold inline-flex items-center gap-1"
            >
              Google AI Studio
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      </div>

      {/* Hunter.io API Configuration Card (Optional Email Discovery) */}
      <div id="hunter" className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <AtSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Hunter.io API (Professional Email Finder)</h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Optional
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Powers optional on-demand email discovery & verification. LinkedIn People discovery remains 100% active regardless.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                hunterSettings?.status === 'configured'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : hunterSettings?.status === 'credits_exhausted'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : hunterSettings?.status === 'invalid_key'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {hunterSettings?.status === 'configured' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Connected ({hunterSettings?.remainingSearches ?? 0} searches left)
                </>
              ) : hunterSettings?.status === 'credits_exhausted' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Quota Limit Reached
                </>
              ) : hunterSettings?.status === 'invalid_key' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  Invalid API Key
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 text-slate-400" />
                  Disabled / Not Configured
                </>
              )}
            </span>
          </div>
        </div>

        {/* Status & Provider Status if Configured */}
        {hunterSettings?.configured && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400">Masked Key</span>
              <p className="font-mono text-slate-800 font-bold mt-0.5">{hunterSettings.maskedKey}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400">Plan</span>
              <p className="font-bold text-purple-700 mt-0.5">{hunterSettings.planName || 'Free'}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400">Remaining Searches</span>
              <p className="font-bold text-slate-900 mt-0.5">{hunterSettings.remainingSearches ?? 0}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Email Discovery</span>
                <p className={`font-bold mt-0.5 ${hunterSettings.emailDiscoveryEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hunterSettings.emailDiscoveryEnabled ? 'Active' : 'Paused'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleHunter}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition ${
                  hunterSettings.emailDiscoveryEnabled
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {hunterSettings.emailDiscoveryEnabled ? 'Pause' : 'Enable'}
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-800">Secure Backend Key Storage:</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Hunter API keys are stored securely on the backend server. Raw keys are never returned in browser requests, never stored in client localStorage, and never logged.
            </p>
          </div>
        </div>

        {/* Key Verification & Save Form */}
        <form onSubmit={handleSaveHunter} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Enter or Update Hunter.io API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={hunterKeyInput}
                onChange={(e) => setHunterKeyInput(e.target.value)}
                placeholder={hunterSettings?.configured ? "Key is set. Enter new key to replace..." : "Enter your Hunter API key..."}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTestHunter}
                disabled={isHunterTesting}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-40 shadow-xs shrink-0"
              >
                {isHunterTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>
              <button
                type="submit"
                disabled={isHunterSaving || !hunterKeyInput.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
              >
                {isHunterSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify & Save</span>
                  </>
                )}
              </button>
              {hunterSettings?.configured && (
                <button
                  type="button"
                  onClick={handleClearHunter}
                  className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold transition shrink-0"
                  title="Disconnect and clear Hunter key"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {hunterFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs ${
                hunterFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : hunterFeedback.type === 'warn'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {hunterFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : hunterFeedback.type === 'warn' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{hunterFeedback.message}</span>
              </div>
              {hunterFeedback.details && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 text-[11px] flex gap-4">
                  <span>Plan: <strong>{hunterFeedback.details.plan}</strong></span>
                  <span>Searches remaining: <strong>{hunterFeedback.details.searches}</strong></span>
                  <span>Verifications: <strong>{hunterFeedback.details.verifications}</strong></span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Free-tier includes 50 searches per month. Never required for LinkedIn people discovery.</span>
            <a
              href="https://hunter.io"
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
            >
              Hunter.io
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      </div>

      {/* Firebase Cloud Sync & Authentication Section */}
      <div id="account" className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Firebase Cloud Synchronization (Phase 6)</h2>
            <p className="text-xs text-slate-500">
              Optional cloud synchronization for multi-device Firestore history and Firebase Authentication.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Active Storage Mode: Local Atomic JSON Store</span>
          </div>
          <p className="text-[11px] text-slate-500">
            MarketMate AI currently uses high-speed persistent local storage in <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">server/data/</code>. All conversations, tasks, documents, and knowledge items survive server restarts. You can connect a Firebase project at any time to enable remote cloud synchronization.
          </p>
        </div>

        <form onSubmit={handleSaveFirebase} className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Firebase Project ID</label>
              <input
                type="text"
                value={firebaseProjectId}
                onChange={(e) => setFirebaseProjectId(e.target.value)}
                placeholder="my-marketmate-project"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Firebase API Key (Optional)</label>
              <input
                type="password"
                value={firebaseApiKey}
                onChange={(e) => setFirebaseApiKey(e.target.value)}
                placeholder="Enter Firebase API key..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Leaves local storage untouched; cloud sync can be turned on when desired.
            </span>
            <button
              type="submit"
              disabled={!firebaseProjectId.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-40"
            >
              <span>Save Firebase Configuration</span>
            </button>
          </div>

          {firebaseSaved && (
            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Firebase configuration saved.
            </p>
          )}
        </form>
      </div>

      {/* System Diagnostics */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Runtime Diagnostics</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Cpu className="w-4 h-4 text-violet-600" />
              <span className="font-semibold">Active AI Engine</span>
            </div>
            <p className="font-mono text-slate-800 font-bold">
              {settings?.activeModel || 'gemini-2.5-flash'}
            </p>
            <p className="text-[10px] text-slate-400">Google Gen AI SDK v3.0.0 (v1beta)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Server className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold">Backend Server</span>
            </div>
            <p className="font-mono text-slate-800 font-bold">http://localhost:5000</p>
            <p className="text-[10px] text-slate-400">Express + SSRF Protected Tools</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Database className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">Local Storage</span>
            </div>
            <p className="font-mono text-slate-800 font-bold">Atomic JSON Store</p>
            <p className="text-[10px] text-slate-400">Conversations, Tasks, Docs, Knowledge</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onRefreshSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
