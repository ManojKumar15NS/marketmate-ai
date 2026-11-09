import {
  AppStats,
  ContentResult,
  Conversation,
  ConversationSummary,
  EmailSequenceResult,
  KnowledgeItem,
  Message,
  ResearchResult,
  SeoAnalysisResult,
  SystemSettings,
  Task,
  UploadedDocument,
  Lead,
  LeadStats,
  ProspectingCriteria,
  PersonalizedEmailData,
  Competitor,
  CampaignKeywordGroup,
  ResearchSession,
  DiscoveredContact,
  EmailSearchRun,
  HunterSettings,
  BackgroundJob
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

/**
 * Reusable, robust HTTP client utility:
 * - Checks HTTP status.
 * - Reads response text safely.
 * - Handles empty response bodies (204 No Content, empty string).
 * - Parses JSON safely without throwing "Unexpected end of JSON input".
 * - Displays meaningful errors for non-JSON or error payloads.
 * - Never crashes the application.
 */
async function safeRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('marketmate_auth_token') : null;
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const mergedOptions: RequestInit = {
    ...options,
    headers
  };
  let res: Response;
  try {
    res = await fetch(url, mergedOptions);
  } catch (err: any) {
    throw new Error(err?.message || 'Network error: Unable to connect to server.');
  }

  // Read response as text first to avoid "Unexpected end of JSON input" on empty bodies
  const rawText = await res.text();
  const trimmed = rawText.trim();

  let parsed: any = null;
  if (trimmed.length > 0) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Non-JSON response (e.g. plain text or HTML error page from proxy/gateway)
      if (!res.ok) {
        const cleanMsg = trimmed.replace(/<[^>]*>/g, '').slice(0, 160) || res.statusText;
        throw new Error(`Server Error (${res.status}): ${cleanMsg}`);
      }
      return trimmed as unknown as T;
    }
  }

  if (!res.ok) {
    const errorMsg =
      parsed?.error?.message ||
      parsed?.error ||
      parsed?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  // Handle empty successful responses (e.g. 204 No Content or empty 200)
  if (!parsed && trimmed.length === 0) {
    return {} as T;
  }

  return parsed as T;
}

export const api = {
  // --- HEALTH & SETTINGS ---
  async getHealth(): Promise<{ status: string; geminiConfigured: boolean; activeModel: string }> {
    return safeRequest(`${API_BASE}/health`);
  },

  async getSettings(): Promise<SystemSettings> {
    return safeRequest(`${API_BASE}/settings`);
  },

  async verifyKey(apiKey: string): Promise<{ success: boolean; message?: string; availableModels?: string[] }> {
    return safeRequest(`${API_BASE}/settings/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, saveToSession: true })
    });
  },

  // --- HUNTER API CONFIGURATION ---
  async getHunterSettings(): Promise<HunterSettings> {
    return safeRequest(`${API_BASE}/settings/hunter`);
  },

  async saveHunterKey(apiKey: string, enableEmailDiscovery: boolean = true): Promise<{ success: boolean; message: string; settings: HunterSettings }> {
    return safeRequest(`${API_BASE}/settings/hunter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, enableEmailDiscovery })
    });
  },

  async testHunterKey(apiKey?: string): Promise<{
    success: boolean;
    creditsExhausted?: boolean;
    planName?: string;
    remainingCredits?: number;
    remainingSearches?: number;
    remainingVerifications?: number;
    message: string;
  }> {
    return safeRequest(`${API_BASE}/settings/hunter/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
  },

  async clearHunterKey(): Promise<{ success: boolean; message: string; settings: HunterSettings }> {
    return safeRequest(`${API_BASE}/settings/hunter`, {
      method: 'DELETE'
    });
  },

  async toggleHunterEnabled(enabled: boolean): Promise<{ success: boolean; settings: HunterSettings }> {
    return safeRequest(`${API_BASE}/settings/hunter/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  },

  // --- CONVERSATIONS ---
  async getConversations(): Promise<ConversationSummary[]> {
    return safeRequest(`${API_BASE}/conversations`);
  },

  async getConversation(id: string): Promise<Conversation> {
    return safeRequest(`${API_BASE}/conversations/${id}`);
  },

  async createConversation(title?: string, category?: string): Promise<Conversation> {
    return safeRequest(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category })
    });
  },

  async deleteConversation(id: string): Promise<void> {
    await safeRequest(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
  },

  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    return safeRequest(`${API_BASE}/tasks`);
  },

  async getStats(): Promise<AppStats> {
    return safeRequest(`${API_BASE}/tasks/stats`);
  },

  async createTask(instruction: string, category?: string): Promise<Task> {
    return safeRequest(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, category })
    });
  },

  async retryLastMessage(conversationId: string, model?: string): Promise<{ conversationId: string; message: Message }> {
    return safeRequest(`${API_BASE}/chat/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, model })
    });
  },

  // --- AI STREAMING CHAT ---
  async streamChatMessage(
    params: { conversationId?: string; message: string; model?: string },
    callbacks: {
      onStart?: (meta: { conversationId: string; title: string; assistantMessageId: string }) => void;
      onChunk: (chunk: string) => void;
      onComplete?: (data: { messageId: string; fullText: string; conversationId: string }) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch (err: any) {
      throw new Error(err?.message || 'Network error: Failed to connect to stream.');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = 'Failed to connect to AI stream';
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error?.message || parsed.error || parsed.message || errMsg;
      } catch {
        if (errText) errMsg = errText.slice(0, 160);
      }
      throw new Error(errMsg);
    }

    if (!res.body) throw new Error('Readable stream not supported');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'start') callbacks.onStart?.(data);
            else if (data.type === 'chunk') callbacks.onChunk(data.chunk);
            else if (data.type === 'done') callbacks.onComplete?.(data);
            else if (data.type === 'error') callbacks.onError?.(data.error);
          } catch {
            // ignore non-json
          }
        }
      }
    }
  },

  // --- MULTI-TOOL AGENT ORCHESTRATOR ---
  async executeAgentWorkflow(
    params: { instruction: string; conversationId?: string; model?: string },
    callbacks: {
      onStart?: (meta: any) => void;
      onPlan?: (planData: { taskId: string; plan: string[]; category: string }) => void;
      onToolCall?: (callData: { stepId: string; tool: string; args: any; message: string }) => void;
      onToolResult?: (resultData: { stepId: string; tool: string; success: boolean; result: any }) => void;
      onComplete?: (data: { taskId: string; result: string; steps: any[] }) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/agent/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch (err: any) {
      throw new Error(err?.message || 'Network error: Failed to launch agent workflow.');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = 'Failed to launch agent workflow';
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error?.message || parsed.error || parsed.message || errMsg;
      } catch {
        if (errText) errMsg = errText.slice(0, 160);
      }
      throw new Error(errMsg);
    }

    if (!res.body) throw new Error('Readable stream not supported');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const ev = JSON.parse(trimmed.slice(6));
            if (ev.type === 'start') callbacks.onStart?.(ev);
            else if (ev.type === 'plan') callbacks.onPlan?.(ev.data);
            else if (ev.type === 'tool_call') callbacks.onToolCall?.(ev.data);
            else if (ev.type === 'tool_result') callbacks.onToolResult?.(ev.data);
            else if (ev.type === 'complete') callbacks.onComplete?.(ev.data);
            else if (ev.type === 'error') callbacks.onError?.(ev.data?.error || ev.error);
          } catch {
            // ignore non-json
          }
        }
      }
    }
  },

  // --- SPECIALIST: RESEARCH AGENT ---
  async conductResearch(topic: string, industry?: string, targetRegion?: string): Promise<ResearchResult> {
    return safeRequest(`${API_BASE}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, industry, targetRegion })
    });
  },

  // --- SPECIALIST: SEO AGENT ---
  async analyzeSeo(url: string): Promise<SeoAnalysisResult> {
    return safeRequest(`${API_BASE}/seo/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  },

  async generateSeoMeta(pageContent: string, targetKeywords?: string, brandName?: string): Promise<{ result: string }> {
    return safeRequest(`${API_BASE}/seo/generate-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageContent, targetKeywords, brandName })
    });
  },

  // --- SPECIALIST: EMAIL AGENT ---
  async generateEmail(params: {
    campaignType: string;
    targetAudience: string;
    productService: string;
    tone: string;
    touchpoints: number;
    callToAction?: string;
  }): Promise<EmailSequenceResult> {
    return safeRequest(`${API_BASE}/email/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  // --- SPECIALIST: CONTENT AGENT ---
  async generateContent(params: {
    contentType: string;
    topic: string;
    targetAudience: string;
    tone: string;
    keyTakeaways?: string;
  }): Promise<ContentResult> {
    return safeRequest(`${API_BASE}/content/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  // --- SPECIALIST: DOCUMENT INTELLIGENCE ---
  async uploadDocument(file: File): Promise<UploadedDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return safeRequest(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData
    });
  },

  async getDocuments(): Promise<UploadedDocument[]> {
    return safeRequest(`${API_BASE}/documents`);
  },

  async queryDocument(id: string, query: string): Promise<{ documentId: string; filename: string; query: string; answer: string }> {
    return safeRequest(`${API_BASE}/documents/${id}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
  },

  async deleteDocument(id: string): Promise<void> {
    await safeRequest(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
  },

  // --- KNOWLEDGE BASE ---
  async getKnowledge(): Promise<KnowledgeItem[]> {
    return safeRequest(`${API_BASE}/knowledge`);
  },

  async saveKnowledge(item: {
    category: KnowledgeItem['category'];
    title: string;
    content: string;
    tags?: string[];
  }): Promise<KnowledgeItem> {
    return safeRequest(`${API_BASE}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  },

  async deleteKnowledge(id: string): Promise<void> {
    await safeRequest(`${API_BASE}/knowledge/${id}`, { method: 'DELETE' });
  },

  // --- B2B RESEARCH SESSIONS & 6-STEP AGENT ---
  async getResearchSessions(): Promise<ResearchSession[]> {
    return safeRequest(`${API_BASE}/leads/sessions`);
  },

  async getResearchSession(id: string): Promise<ResearchSession> {
    return safeRequest(`${API_BASE}/leads/sessions/${id}`);
  },

  async createResearchSession(url: string, autoRun = false, location?: any): Promise<{ success: boolean; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, autoRun, location })
    });
  },

  async executeSessionStep1(sessionId: string): Promise<{ success: boolean; profile: any; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/step1`, { method: 'POST' });
  },

  async executeSessionStep2(sessionId: string): Promise<{ success: boolean; competitors: Competitor[]; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/step2`, { method: 'POST' });
  },

  async executeSessionStep3(sessionId: string): Promise<{ success: boolean; campaigns: CampaignKeywordGroup[]; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/step3`, { method: 'POST' });
  },

  async updateSessionCampaigns(sessionId: string, campaigns: CampaignKeywordGroup[]): Promise<{ success: boolean; campaigns: CampaignKeywordGroup[] }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/campaigns`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaigns })
    });
  },

  async updateSessionCompany(sessionId: string, profile: any): Promise<{ success: boolean; profile: any }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/company`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile })
    });
  },

  async executeSessionStep4(sessionId: string, options?: { campaignId?: string; location?: any; limit?: number }): Promise<{ success: boolean; leads: Lead[]; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/step4`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });
  },

  async executeSessionStep5(sessionId: string): Promise<{ success: boolean; leads: Lead[]; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/step5`, { method: 'POST' });
  },

  async executeSessionStep6(sessionId: string): Promise<{ success: boolean; leads: Lead[]; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/step6`, { method: 'POST' });
  },

  async runAllSessionSteps(sessionId: string): Promise<{ success: boolean; session: ResearchSession }> {
    return safeRequest(`${API_BASE}/leads/sessions/${sessionId}/run-all`, { method: 'POST' });
  },

  // --- B2B PROSPECTING & LEADS ---
  async researchCompany(url: string): Promise<{
    success: boolean;
    profile: any;
    competitors: Competitor[];
    campaigns: CampaignKeywordGroup[];
    leads: Lead[];
    stats: LeadStats;
  }> {
    return safeRequest(`${API_BASE}/leads/research-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  },

  async getCompanies(): Promise<any[]> {
    return safeRequest(`${API_BASE}/leads/companies`);
  },

  async getCompanyDetails(id: string): Promise<{
    profile: any;
    competitors: Competitor[];
    campaigns: CampaignKeywordGroup[];
    leads: Lead[];
    stats: LeadStats;
  }> {
    return safeRequest(`${API_BASE}/leads/company/${id}`);
  },

  async getLeads(params?: {
    companyId?: string;
    status?: string;
    search?: string;
    minScore?: number;
    emailStatus?: string;
    role?: string;
  }): Promise<Lead[]> {
    const query = new URLSearchParams();
    if (params?.companyId) query.set('companyId', params.companyId);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.minScore !== undefined) query.set('minScore', String(params.minScore));
    if (params?.emailStatus) query.set('emailStatus', params.emailStatus);
    if (params?.role) query.set('role', params.role);

    return safeRequest(`${API_BASE}/leads?${query.toString()}`);
  },

  async getLeadStats(companyId?: string): Promise<LeadStats> {
    const url = companyId ? `${API_BASE}/leads/stats?companyId=${encodeURIComponent(companyId)}` : `${API_BASE}/leads/stats`;
    return safeRequest(url);
  },

  async getCompetitors(companyId?: string): Promise<Competitor[]> {
    const url = companyId ? `${API_BASE}/leads/competitors?companyId=${encodeURIComponent(companyId)}` : `${API_BASE}/leads/competitors`;
    return safeRequest(url);
  },

  async getCampaigns(companyId?: string): Promise<CampaignKeywordGroup[]> {
    const url = companyId ? `${API_BASE}/leads/campaigns?companyId=${encodeURIComponent(companyId)}` : `${API_BASE}/leads/campaigns`;
    return safeRequest(url);
  },

  async mapDiscover(params: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    radiusMiles?: number;
    industry?: string;
    limit?: number;
  }): Promise<{ success: boolean; center: { lat: number; lng: number }; radiusMiles: number; count: number; places: any[] }> {
    return safeRequest(`${API_BASE}/leads/map-discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async getLead(id: string): Promise<Lead> {
    return safeRequest(`${API_BASE}/leads/${id}`);
  },

  async prospectLeads(criteria: ProspectingCriteria & { companyId?: string }): Promise<{ success: boolean; count: number; leads: Lead[] }> {
    return safeRequest(`${API_BASE}/leads/prospect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criteria)
    });
  },

  async verifyEmail(email: string): Promise<any> {
    return safeRequest(`${API_BASE}/leads/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  },

  async enrichEmail(leadId: string): Promise<{ success: boolean; lead: Lead; emailResult: any }> {
    return safeRequest(`${API_BASE}/leads/${leadId}/enrich-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async personalizeEmail(leadId: string, valueProp?: string, companyId?: string): Promise<{ success: boolean; leadId: string; personalizedEmail: PersonalizedEmailData }> {
    return safeRequest(`${API_BASE}/leads/${leadId}/personalize-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueProp, companyId })
    });
  },

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    return safeRequest(`${API_BASE}/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  },

  async deleteLead(id: string): Promise<void> {
    await safeRequest(`${API_BASE}/leads/${id}`, { method: 'DELETE' });
  },

  getExportLeadsUrl(companyId?: string): string {
    return companyId ? `${API_BASE}/leads/export?companyId=${encodeURIComponent(companyId)}` : `${API_BASE}/leads/export`;
  },

  getExportExcelUrl(companyId?: string): string {
    return companyId ? `${API_BASE}/leads/export.xlsx?companyId=${encodeURIComponent(companyId)}` : `${API_BASE}/leads/export.xlsx`;
  },

  // --- EMAIL FINDER MODULE ---
  async searchEmails(params: {
    mode: 'single_company' | 'keyword_discovery';
    website?: string;
    keywords: string[];
    targetIndustry?: string;
    targetLocation?: string;
    targetRoles?: string[];
    limit?: number;
  }): Promise<{ success: boolean; run: EmailSearchRun }> {
    return safeRequest(`${API_BASE}/email-finder/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async getEmailSearches(): Promise<EmailSearchRun[]> {
    return safeRequest(`${API_BASE}/email-finder/searches`);
  },

  async getEmailSearch(id: string): Promise<EmailSearchRun> {
    return safeRequest(`${API_BASE}/email-finder/searches/${id}`);
  },

  async deleteEmailSearch(id: string): Promise<void> {
    await safeRequest(`${API_BASE}/email-finder/searches/${id}`, { method: 'DELETE' });
  },

  async importContactsToLeads(contacts: DiscoveredContact[], companyId?: string): Promise<{ success: boolean; importedCount: number; leads: Lead[] }> {
    return safeRequest(`${API_BASE}/email-finder/import-to-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts, companyId })
    });
  },

  async enrichContacts(searchId: string, contactIds: string[]): Promise<{
    success: boolean;
    searchRun: EmailSearchRun;
    enrichedCount: number;
    notFoundCount: number;
    creditsExhausted?: boolean;
    message: string;
  }> {
    return safeRequest(`${API_BASE}/email-finder/enrich-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchId, contactIds })
    });
  },

  async enrichSingleContact(searchId: string, contactId: string): Promise<{
    success: boolean;
    searchRun: EmailSearchRun;
    enrichedCount: number;
    notFoundCount: number;
    creditsExhausted?: boolean;
    message: string;
  }> {
    return safeRequest(`${API_BASE}/email-finder/enrich-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchId, contactId })
    });
  },

  getEmailFinderExportCsvUrl(searchId?: string): string {
    return searchId ? `${API_BASE}/email-finder/export.csv?searchId=${encodeURIComponent(searchId)}` : `${API_BASE}/email-finder/export.csv`;
  },

  getEmailFinderExportExcelUrl(searchId?: string): string {
    return searchId ? `${API_BASE}/email-finder/export.xlsx?searchId=${encodeURIComponent(searchId)}` : `${API_BASE}/email-finder/export.xlsx`;
  },

  // --- BACKGROUND JOBS ENGINE ---
  async startJob(agentId: BackgroundJob['agentId'], input: any, options?: { companyId?: string; researchId?: string }): Promise<{ success: boolean; data: BackgroundJob }> {
    return safeRequest(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        input,
        companyId: options?.companyId,
        researchId: options?.researchId
      })
    });
  },

  async getJob(jobId: string): Promise<{ success: boolean; data: BackgroundJob }> {
    return safeRequest(`${API_BASE}/jobs/${jobId}`);
  },

  async listJobs(filter?: { agentId?: string; companyId?: string; status?: string }): Promise<{ success: boolean; data: BackgroundJob[] }> {
    const params = new URLSearchParams();
    if (filter?.agentId) params.set('agentId', filter.agentId);
    if (filter?.companyId) params.set('companyId', filter.companyId);
    if (filter?.status) params.set('status', filter.status);
    const qs = params.toString();
    return safeRequest(`${API_BASE}/jobs${qs ? `?${qs}` : ''}`);
  },

  async cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return safeRequest(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
  },

  async retryJob(jobId: string): Promise<{ success: boolean; data: BackgroundJob; message: string }> {
    return safeRequest(`${API_BASE}/jobs/${jobId}/retry`, { method: 'POST' });
  },

  getJobStreamUrl(jobId: string): string {
    return `${API_BASE}/jobs/${jobId}/stream`;
  },

  getAllJobsStreamUrl(): string {
    return `/jobs/stream/all`;
  },

  // ============================================================================
  // AGENT 3 - CONTENT CREATOR API
  // ============================================================================

  async createContent(params: any): Promise<{ success: boolean; data?: any; jobId?: string; status?: string }> {
    return safeRequest(`${API_BASE}/content/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async refineContent(params: { body: string; action: 'shorter' | 'longer' | 'change_tone' | 'regenerate'; targetTone?: string; currentTitle?: string }): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/content/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async getContentItems(): Promise<{ success: boolean; data: any[] }> {
    return safeRequest(`${API_BASE}/content/items`);
  },

  async getContentItem(id: string): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/content/items/${id}`);
  },

  async saveContentVersion(id: string, versionData: { title: string; body: string; changeSummary?: string }): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/content/items/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(versionData)
    });
  },

  async deleteContentItem(id: string): Promise<{ success: boolean; message: string }> {
    return safeRequest(`${API_BASE}/content/items/${id}`, { method: 'DELETE' });
  },

  getContentExportUrl(id: string, format: 'md' | 'docx' | 'txt'): string {
    return `${API_BASE}/content/items/${id}/export/${format}`;
  },

  // ============================================================================
  // AGENT 4 - SEO CONTENT EDITOR API
  // ============================================================================

  async getEditorDocuments(): Promise<{ success: boolean; data: any[] }> {
    return safeRequest(`${API_BASE}/editor/documents`);
  },

  async getEditorDocument(id: string): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/editor/documents/${id}`);
  },

  async saveEditorDocument(docData: any): Promise<{ success: boolean; data: any; analysis?: any }> {
    return safeRequest(`${API_BASE}/editor/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
  },

  async updateEditorDocument(id: string, docData: any): Promise<{ success: boolean; data: any; analysis?: any }> {
    return safeRequest(`${API_BASE}/editor/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
  },

  async deleteEditorDocument(id: string): Promise<{ success: boolean; message: string }> {
    return safeRequest(`${API_BASE}/editor/documents/${id}`, { method: 'DELETE' });
  },

  async restoreEditorDocumentVersion(docId: string, versionId: string): Promise<{ success: boolean; data: any; message: string }> {
    return safeRequest(`${API_BASE}/editor/documents/${docId}/restore/${versionId}`, {
      method: 'POST'
    });
  },

  async analyzeEditorContent(params: { content: string; targetKeyword?: string; title?: string; metaDescription?: string }): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/editor/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async getEditorSuggestions(params: { content: string; targetKeyword?: string; title?: string; metaDescription?: string }): Promise<{ success: boolean; data: any[] }> {
    return safeRequest(`${API_BASE}/editor/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async extractLivePage(url: string): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/editor/live-page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  },

  async generateGeoSchemas(params: { content: string; title?: string; targetKeyword?: string; organizationName?: string }): Promise<{ success: boolean; data: any }> {
    return safeRequest(`${API_BASE}/editor/geo-schemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  getEditorExportUrl(id: string, format: 'html' | 'md' | 'docx'): string {
    return `${API_BASE}/editor/documents/${id}/export/${format}`;
  },

};

export default api;
