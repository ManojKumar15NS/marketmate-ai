import { contentGeneratorService } from '../tools/contentGenerator.js';
import { seoEditorService } from '../tools/seoEditorService.js';
import { jobService, JobProgressCallback } from '../services/jobService.js';
import { analyzeWebsiteSeo } from '../tools/websiteAnalysis.js';
import { ProspectingEngine } from '../agents/prospector.js';
import { emailFinderService } from '../tools/emailFinderService.js';
import { geminiService } from '../services/gemini.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

export function initBackgroundWorkers(): void {
  logger.info('[Workers] Initializing persistent agent worker pool...');

  // 1. SEO Agent Worker
  jobService.registerAgentHandler('seo', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || typeof input.url !== 'string' || !/^https?:\/\//i.test(input.url.trim())) {
      throw new Error('SEO Agent requires a valid HTTP or HTTPS URL (e.g., https://example.com). Input was invalid.');
    }

    const url = input.url.trim();
    const cacheKey = `seo:global:none:${url}`;

    // Check agent cache
    const cached = await db.getCache(cacheKey);
    if (cached && !input.refresh) {
      updateProgress(100, 'Loaded verified SEO audit from cache.', cached);
      return cached;
    }

    updateProgress(10, `Validating domain & SSRF safety for ${url}...`);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(30, 'Crawling page metadata, headings, and schema...');
    const result = await analyzeWebsiteSeo(url);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(75, 'Computing code-calculated scores and GEO/AEO recommendations...');
    
    // Save to cache (24 hour TTL)
    await db.setCache(cacheKey, 'seo', result, 86400);

    updateProgress(100, 'SEO and GEO Technical Audit completed.', result);
    return result;
  });

  // 2. B2B Prospector Agent Worker
  const prospector = new ProspectingEngine();
  jobService.registerAgentHandler('prospector', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || typeof input.url !== 'string' || !/^https?:\/\//i.test(input.url.trim())) {
      throw new Error('B2B Prospector requires a valid company website URL (e.g., https://example.com).');
    }

    const url = input.url.trim();

    updateProgress(5, `Stage 1/6: Analyzing company profile & target market for ${url}...`);
    const session = await prospector.createSession(url, input.location);
    await prospector.executeStep1(session);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(25, 'Stage 2/6: Mapping verified direct & indirect competitors...');
    await prospector.executeStep2(session);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(45, 'Stage 3/6: Defining target campaigns & buying-intent keyword groups...');
    await prospector.executeStep3(session);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(65, 'Stage 4/6: Discovering potential B2B target accounts...');
    await prospector.executeStep4(session);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(80, 'Stage 5/6: Finding authorized decision-makers with public LinkedIn profiles...');
    await prospector.executeStep5(session);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(95, 'Stage 6/6: Crafting tailored 1:1 cold outreach emails...');
    await prospector.executeStep6(session);
    if (signal.aborted) throw new Error('Job cancelled');

    const result = {
      session,
      profile: session.profile,
      competitors: session.competitors || [],
      campaigns: session.campaigns || [],
      leads: session.leads || [],
      stats: session.stats
    };

    updateProgress(100, `Autonomous research complete for ${session.profile?.name || 'company'}! Discovered ${session.leads?.length || 0} accounts.`, result);
    return result;
  });

  // 3. LinkedIn People & Email Finder Worker
  jobService.registerAgentHandler('email_finder', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || !input.mode || !['single_company', 'keyword_discovery'].includes(input.mode)) {
      throw new Error('Email Finder requires a valid discovery mode: "single_company" or "keyword_discovery".');
    }

    updateProgress(10, 'Initializing public LinkedIn profile discovery...');
    if (signal.aborted) throw new Error('Job cancelled');

    const result = await emailFinderService.discoverPeople({
      mode: input.mode,
      website: input.website,
      keywords: input.keywords,
      targetIndustry: input.targetIndustry,
      targetLocation: input.targetLocation,
      targetRoles: input.targetRoles,
      limit: input.limit || 50
    });

    updateProgress(100, `Discovered ${result.contacts.length} verified professionals with direct LinkedIn profiles.`, result);
    return result;
  });

  // 4. Document Analyzer Worker
  jobService.registerAgentHandler('document', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || !input.documentId || typeof input.documentId !== 'string') {
      throw new Error('Document Analyzer requires an explicitly selected uploaded document file.');
    }
    if (!input.query || typeof input.query !== 'string' || !input.query.trim()) {
      throw new Error('Document Analyzer requires a specific question or query.');
    }

    updateProgress(20, `Locating document ${input.documentId}...`);
    const doc = await db.getDocument(input.documentId);

    if (!doc) {
      throw new Error(`Document with ID "${input.documentId}" was not found. Please upload or select a document.`);
    }

    updateProgress(50, `Analyzing extracted text (${doc.wordCount} words) with Gemini AI...`);
    if (signal.aborted) throw new Error('Job cancelled');

    const prompt = `You are a Document Intelligence and Research Analyst.
Context Document: "${doc.filename}" (${doc.wordCount} words)
Content:
"""
${doc.extractedText.substring(0, 15000)}
"""

User Question: "${input.query}"

Provide an authoritative, structured, and factual answer based strictly on the document text. Cite specific sections, numbers, or quotes where available. If the document does not contain the answer, state that clearly.`;

    const answer = await geminiService.generateText(prompt);

    const result = {
      documentId: doc.id,
      filename: doc.filename,
      query: input.query,
      answer
    };

    updateProgress(100, 'Document analysis complete.', result);
    return result;
  });

  // 5. Research Agent Worker
  jobService.registerAgentHandler('research', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || (!input.topic && !input.url)) {
      throw new Error('Research Agent requires a research topic or target company URL.');
    }

    const query = input.topic || input.url;
    updateProgress(20, `Searching industry intelligence for "${query}"...`);
    if (signal.aborted) throw new Error('Job cancelled');

    const prompt = `You are a Senior Market Intelligence and Competitor Research Analyst.
Topic: "${query}"

Provide an exhaustive, factual intelligence briefing covering:
1. Executive Summary & Market Landscape
2. Direct and Indirect Commercial Competitors
3. Key Differentiators, Pricing, & GTM Positioning
4. Strategic Opportunities and Risks

Format with clear Markdown headings. Never fabricate companies or metrics.`;

    updateProgress(60, 'Synthesizing market research briefing...');
    const report = await geminiService.generateText(prompt);

    const result = {
      query,
      report,
      completedAt: new Date().toISOString()
    };

    updateProgress(100, 'Market research briefing generated.', result);
    return result;
  });

  // 6. Cold Outreach Email Worker
  jobService.registerAgentHandler('email', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || !input.recipientName || !input.companyName) {
      throw new Error('Email Agent requires recipientName and companyName.');
    }

    updateProgress(30, `Drafting personalized outreach for ${input.recipientName} at ${input.companyName}...`);
    if (signal.aborted) throw new Error('Job cancelled');

    const prompt = `You are an elite B2B Cold Outreach Copywriter.
Recipient: ${input.recipientName} (${input.recipientTitle || 'Decision Maker'})
Target Company: ${input.companyName} (${input.companyLocation || 'Global'})
Value Proposition: ${input.valueProp || 'Operational efficiency and commercial growth'}

Generate:
1. Three high-open Subject Line angles (Curiosity, Pain Point, Direct).
2. A bespoke 1-to-1 cold outreach email (under 120 words, conversational, no generic buzzwords, low-friction ask).
3. A follow-up nudge email (under 50 words).`;

    const copy = await geminiService.generateText(prompt);

    const result = {
      recipient: input.recipientName,
      company: input.companyName,
      copy,
      createdAt: new Date().toISOString()
    };

    updateProgress(100, 'Cold outreach email drafted.', result);
    return result;
  });

  logger.info('[Workers] Registered handlers for: seo, prospector, email_finder, content, seo_editor, document, research, email');

  // 7. Content Creator Agent Worker (Agent 3)
  jobService.registerAgentHandler('content', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || typeof input.topic !== 'string' || !input.topic.trim()) {
      throw new Error('Content Creator requires a valid topic or brief. Input was invalid.');
    }

    updateProgress(10, 'Analyzing brief, target audience, and tone requirements...');
    if (signal.aborted) throw new Error('Job cancelled');

    const result = await contentGeneratorService.generateContent(input, (prog, stage) => {
      if (signal.aborted) throw new Error('Job cancelled');
      updateProgress(prog, stage);
    });

    updateProgress(100, `Content creation completed (${result.options.length} options generated).`, result);
    return result;
  });

  // 8. SEO Content Editor Worker (Agent 4)
  jobService.registerAgentHandler('seo_editor', async (input: any, updateProgress: JobProgressCallback, signal: AbortSignal) => {
    if (!input || typeof input.content !== 'string' || !input.content.trim()) {
      throw new Error('SEO Content Editor requires document content to analyze.');
    }

    updateProgress(20, 'Calculating real-time word count, keyword density, and Flesch score...');
    const analysis = seoEditorService.analyzeContent(input.content, input.targetKeyword, input.title, input.metaDescription);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(70, 'Generating grounded suggestions from text...');
    const suggestions = await seoEditorService.generateSuggestions(input.content, input.targetKeyword, input.title, input.metaDescription);
    if (signal.aborted) throw new Error('Job cancelled');

    updateProgress(100, 'SEO document analysis complete.', { analysis, suggestions });
    return { analysis, suggestions };
  });

}
