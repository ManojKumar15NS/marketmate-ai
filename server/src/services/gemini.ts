import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { Message } from '../types/index.js';
import { searchLiveWeb } from '../tools/webFetcher.js';

const SYSTEM_INSTRUCTION = `You are MarketMate AI, an elite AI Marketing & Research Assistant.
You specialize in:
1. Deep market research, competitor analysis, ICP mapping, and industry intelligence using real verified web sources.
2. Technical & On-page SEO, keyword strategies, meta generation, and GEO/AEO optimization for AI search engines.
3. High-converting email marketing sequences, subject lines, follow-ups, and cold outreach.
4. Social content creation (LinkedIn, X, Instagram), long-form blog articles, and content calendars.
5. Strategic report generation, data interpretation, and actionable marketing recommendations.

Guidelines:
- Provide actionable, professional, well-structured responses using clean Markdown.
- Use headers, bold text, bullet points, and tables where appropriate to maximize clarity.
- When providing code, marketing copy, or templates, use fenced code blocks with language indicators.
- Be concise, direct, strategic, and data-driven. Do not hallucinate URLs, stats, or companies. When citing facts, include actual links and sources.`;

// Real verified Google Gemini models with automatic quota cascade
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.5-pro'
];

export class GeminiService {
  private client: GoogleGenAI | null = null;
  private currentKey: string = '';

  constructor() {
    this.refreshClient();
  }

  public refreshClient(customKey?: string): GoogleGenAI | null {
    const key = customKey || env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      this.client = null;
      this.currentKey = '';
      return null;
    }

    if (key !== this.currentKey || !this.client) {
      this.client = new GoogleGenAI({ apiKey: key, apiVersion: 'v1beta' });
      this.currentKey = key;
    }
    return this.client;
  }

  public isConfigured(): boolean {
    return Boolean(this.client && this.currentKey.trim() !== '');
  }

  public getModelName(): string {
    return env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  }

  /**
   * Resilient executor with timeout & fallback on quota/rate limits/deprecated models
   */
  private async executeWithFallback<T>(
    fn: (modelName: string) => Promise<T>,
    preferredModel?: string,
    timeoutMs: number = 45000
  ): Promise<T> {
    const primary = preferredModel || this.getModelName();
    const candidateModels = [primary, ...FALLBACK_MODELS.filter(m => m !== primary)];

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`TIMEOUT_MODEL_${model}`)), timeoutMs)
        );
        return await Promise.race([fn(model), timeoutPromise]);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '') + ' ' + JSON.stringify(err);
        const isTemporary =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('high demand') ||
          msg.includes('404') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('TIMEOUT') ||
          msg.includes('Quota exceeded') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate limit');

        if (isTemporary) {
          console.warn(`[GeminiService] Model ${model} cascade trigger (${err.message?.slice(0, 80)}). Cascading to next model...`);
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        throw new Error(this.normalizeError(err));
      }
    }

    throw new Error(this.normalizeError(lastError));
  }

  public async verifyKey(apiKey: string): Promise<{ success: boolean; availableModels: string[]; message?: string }> {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, availableModels: [], message: 'API key is required' };
    }

    try {
      const testAi = new GoogleGenAI({ apiKey: apiKey.trim(), apiVersion: 'v1beta' });
      const modelPager = await testAi.models.list();
      const modelNames: string[] = [];

      for await (const m of modelPager) {
        if (m.name) {
          modelNames.push(m.name.replace(/^models\//, ''));
        }
      }

      return {
        success: true,
        availableModels: modelNames
      };
    } catch (error: any) {
      return {
        success: false,
        availableModels: [],
        message: this.normalizeError(error)
      };
    }
  }

  public async *streamChat(
    messages: Message[],
    modelOverride?: string
  ): AsyncGenerator<string, void, unknown> {
    const ai = this.refreshClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured.');
    }

    const contents = this.formatConversationHistory(messages);
    const model = modelOverride || this.getModelName();

    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error: any) {
      throw new Error(this.normalizeError(error));
    }
  }

  public async generateText(
    prompt: string,
    systemInstructionOrModel?: string,
    modelOverride?: string
  ): Promise<string> {
    const ai = this.refreshClient();
    if (!ai) throw new Error('Gemini API key is not configured.');

    let systemInstruction = SYSTEM_INSTRUCTION;
    let model = modelOverride;

    if (systemInstructionOrModel) {
      if (systemInstructionOrModel.startsWith('gemini') || systemInstructionOrModel.startsWith('models/')) {
        model = systemInstructionOrModel;
      } else {
        systemInstruction = systemInstructionOrModel;
      }
    }

    return this.executeWithFallback(async (activeModel) => {
      const response = await ai.models.generateContent({
        model: activeModel,
        contents: prompt,
        config: { systemInstruction }
      });
      return response.text || '';
    }, model);
  }

  public async generateChat(
    messages: Message[],
    modelOverride?: string
  ): Promise<string> {
    const ai = this.refreshClient();
    if (!ai) throw new Error('Gemini API key is not configured.');

    const contents = this.formatConversationHistory(messages);
    return this.executeWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });
      return response.text || '';
    }, modelOverride);
  }

  public async searchWithGrounding(query: string): Promise<{
    summary: string;
    sources: Array<{ title: string; url: string; snippet?: string }>;
  }> {
    // 1. Prioritize live web search via Tavily Search API with DuckDuckGo fallback
    try {
      const liveResults = await searchLiveWeb(query, 8);
      if (liveResults && liveResults.length > 0) {
        const sources = liveResults.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet
        }));

        const contextSnippet = liveResults.map((r, i) =>
          `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSummary: ${r.snippet}`
        ).join('\n\n');

        const synthesisPrompt = `You are a professional market research analyst.
Based on the following verified live web search results for the user query "${query}":

${contextSnippet}

Please provide a detailed, well-structured research analysis covering:
1. Executive Summary & Market Landscape
2. Identified Companies & Services Offered
3. Target Audience & Positioning
4. Actionable Market Opportunities

Be factual, objective, and cite the actual sources provided above with markdown links.`;

        const summary = await this.generateText(synthesisPrompt);
        return {
          summary: summary || 'Research completed based on verified live web results.',
          sources
        };
      }
    } catch (err: any) {
      console.warn('[searchWithGrounding] Live web search notice:', err.message);
    }

    // 2. Gemini fallback with search grounding
    const ai = this.refreshClient();
    if (!ai) throw new Error('Gemini API key is not configured.');

    return this.executeWithFallback(async (model) => {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: `Search the live web and provide factual information with sources for: "${query}". Include specific company names, services, and evidence.`,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });

        const summary = response.text || '';
        const sources: Array<{ title: string; url: string; snippet?: string }> = [];

        const metadata = response.candidates?.[0]?.groundingMetadata;
        if (metadata?.groundingChunks) {
          for (const chunk of metadata.groundingChunks) {
            if (chunk.web?.uri) {
              sources.push({
                title: chunk.web.title || 'Source Link',
                url: chunk.web.uri
              });
            }
          }
        }

        if (sources.length > 0 && summary.trim().length > 0) {
          return { summary, sources };
        }
      } catch (groundingErr: any) {
        console.warn('[searchWithGrounding] Grounding error:', groundingErr.message);
      }

      const direct = await ai.models.generateContent({
        model,
        contents: `Provide a detailed market research summary with real company names for: "${query}".`
      });

      return {
        summary: direct.text || 'Research completed.',
        sources: []
      };
    });
  }

  public async generateWithTools(
    contents: any,
    toolDeclarations: any[],
    modelOverride?: string
  ): Promise<any> {
    const ai = this.refreshClient();
    if (!ai) throw new Error('Gemini API key is not configured.');

    return this.executeWithFallback(async (model) => {
      if (!model.startsWith('gemma') && toolDeclarations.length > 0) {
        try {
          return await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              tools: [{ functionDeclarations: toolDeclarations }]
            }
          });
        } catch (err: any) {
          const msg = err.message || '';
          if (msg.includes('Quota exceeded') || msg.includes('429') || msg.includes('503') || msg.includes('UNAVAILABLE')) {
            throw err; // Let executeWithFallback retry next model
          }
        }
      }

      // Safe fallback for models without functionDeclarations support (e.g. Gemma) or when tool calls fail
      const toolDescriptions = toolDeclarations.map(t => `- ${t.name}: ${t.description}`).join('\n');
      const textPrompt = toolDeclarations.length > 0 
        ? `\n\n[Instruction: Provide the comprehensive marketing response with verified analysis. Available tools: ${toolDescriptions}]`
        : '';

      let payload = contents;
      if (Array.isArray(contents)) {
        payload = contents.map(c => {
          if (c.parts && Array.isArray(c.parts)) {
            const textParts = c.parts.map((p: any) => p.text || JSON.stringify(p.functionResponse || p.functionCall || '')).join('\n');
            return { role: c.role === 'assistant' ? 'model' : 'user', parts: [{ text: textParts + textPrompt }] };
          }
          return c;
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: payload
      });

      return {
        text: response.text || '',
        functionCalls: []
      };
    }, modelOverride);
  }

  private formatConversationHistory(messages: Message[]) {
    const validMessages = messages.filter(
      m => m.role === 'user' || m.role === 'assistant'
    );

    if (validMessages.length === 0) {
      throw new Error('No valid messages provided in conversation.');
    }

    return validMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  public normalizeError(error: any): string {
    const message = error?.message || String(error);

    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
      return 'The provided Gemini API key is invalid or expired. Please verify your key in Google AI Studio.';
    }
    if (message.includes('QUOTA_EXCEEDED') || message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      return 'Gemini API rate limit or quota exceeded. Please wait a moment before trying again or check your Google AI Studio plan.';
    }
    if (message.includes('503') || message.includes('UNAVAILABLE') || message.includes('high demand')) {
      return 'The Gemini models are currently experiencing high global demand. Please try again in a few moments.';
    }
    if (message.includes('NOT_FOUND') || message.includes('404')) {
      return `The requested Gemini model (${this.getModelName()}) is currently unavailable on your API key.`;
    }
    if (message.includes('SAFETY')) {
      return 'The request was flagged by Gemini content safety filters. Please refine your prompt.';
    }

    return `Gemini API Error: ${message.replace(/([a-zA-Z0-9_\-]{30,})/g, '***KEY_REDACTED***')}`;
  }
}

export const geminiService = new GeminiService();
