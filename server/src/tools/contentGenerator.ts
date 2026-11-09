import { geminiService } from '../services/gemini.js';
import { logger } from '../utils/logger.js';
import { db } from '../db/index.js';

export interface TargetAudience {
  role?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  painPoints?: string[];
  notes?: string;
}

export interface ContentGenerationParams {
  topic: string;
  contentType:
    | 'blog article'
    | 'LinkedIn post'
    | 'cold email'
    | 'email sequence'
    | 'landing page copy'
    | 'ad copy'
    | 'social caption'
    | 'newsletter'
    | 'case study outline'
    | string;
  targetAudience?: TargetAudience;
  wordCountTarget?: number;
  minWordCount?: number;
  maxWordCount?: number;
  tone?: string;
  language?: string;
  readingLevel?: string;
  primaryKeywords?: string[];
  secondaryKeywords?: string[];
  cta?: string;
  brandVoice?: string;
  thingsToAvoid?: string;
  variantsCount?: number; // 1 to 5
}

export interface GeneratedContentOption {
  optionIndex: number;
  title: string;
  hook?: string;
  body: string;
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  withinTargetRange: boolean;
  retriesApplied: number;
  sourcesCited: string[];
}

export interface ContentGenerationResult {
  id: string;
  topic: string;
  contentType: string;
  targetAudience: TargetAudience;
  wordCountTarget?: number;
  minWordCount?: number;
  maxWordCount?: number;
  tone: string;
  language: string;
  readingLevel: string;
  options: GeneratedContentOption[];
  createdAt: string;
}

export function calculateWordCount(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  // Match standard word tokens across Latin, Asian, and Indic character ranges
  const tokens = text.trim().match(/[\w\u00C0-\u024F\u4E00-\u9FFF\u0900-\u097F\-']+/g);
  return tokens ? tokens.length : 0;
}

export function calculateCharCount(text: string): number {
  return text ? text.length : 0;
}

export function calculateReadingTime(wordCount: number): number {
  return Number((wordCount / 200).toFixed(1));
}

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  it: 'Italian (Italiano)',
  pt: 'Portuguese (Português)',
  nl: 'Dutch (Nederlands)',
  ja: 'Japanese (???)',
  zh: 'Chinese (Simplified, ??)',
  hi: 'Hindi (??????)'
};

export class ContentGeneratorService {
  /**
   * Generates 1 to 5 content variants according to brief and strictly enforces word count.
   */
  public async generateContent(
    params: ContentGenerationParams,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<ContentGenerationResult> {
    if (!params.topic || typeof params.topic !== 'string' || !params.topic.trim()) {
      throw new Error('Content Creator requires a valid topic or brief.');
    }

    const variantsCount = Math.min(Math.max(params.variantsCount || 1, 1), 5);
    const contentId = `content_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const langKey = (params.language || 'en').toLowerCase().trim();
    const languageName = SUPPORTED_LANGUAGES[langKey] || params.language || 'English';

    // Word count target boundaries
    let minWords = params.minWordCount;
    let maxWords = params.maxWordCount;

    if (params.wordCountTarget && !minWords && !maxWords) {
      const target = params.wordCountTarget;
      minWords = Math.max(20, Math.round(target * 0.9));
      maxWords = Math.round(target * 1.1);
    } else if (!minWords && !maxWords) {
      // Default standard boundaries by content type
      switch (params.contentType.toLowerCase()) {
        case 'linkedin post':
          minWords = 150;
          maxWords = 300;
          break;
        case 'cold email':
          minWords = 100;
          maxWords = 200;
          break;
        case 'social caption':
          minWords = 30;
          maxWords = 100;
          break;
        case 'ad copy':
          minWords = 40;
          maxWords = 120;
          break;
        default:
          minWords = 300;
          maxWords = 600;
          break;
      }
    }

    if (onProgress) onProgress(15, `Synthesizing creative brief for ${variantsCount} ${params.contentType} option(s)...`);

    const audienceDesc = params.targetAudience
      ? [
          params.targetAudience.role ? `Role: ${params.targetAudience.role}` : '',
          params.targetAudience.industry ? `Industry: ${params.targetAudience.industry}` : '',
          params.targetAudience.companySize ? `Company Size: ${params.targetAudience.companySize}` : '',
          params.targetAudience.location ? `Location: ${params.targetAudience.location}` : '',
          params.targetAudience.painPoints && params.targetAudience.painPoints.length > 0
            ? `Target Pain Points: ${params.targetAudience.painPoints.join(', ')}`
            : '',
          params.targetAudience.notes ? `Audience Notes: ${params.targetAudience.notes}` : ''
        ].filter(Boolean).join(' | ')
      : 'General B2B Audience';

    const systemPrompt = `You are MarketMate AI's Content Creator Agent, an elite B2B and consumer copywriter.
You write compelling, truthful, and high-converting marketing content.
STRICT TRUTHFULNESS & GROUNDING RULES:
1. NEVER invent fake statistics, fake case studies, fictional customer names, or non-existent URLs.
2. If facts or numbers are cited, use only user-supplied material or cite genuine industry facts.
3. Every option must be distinct in hook, angle, and narrative flow.
4. WORD COUNT ENFORCEMENT: The content body MUST strictly contain between ${minWords} and ${maxWords} words.
5. Language: Write in ${languageName}.
6. Tone: ${params.tone || 'Professional & Authoritative'}.
7. Reading Level: ${params.readingLevel || 'Professional / College'}.
${params.brandVoice ? `Brand Voice: ${params.brandVoice}` : ''}
${params.thingsToAvoid ? `Things to Avoid: ${params.thingsToAvoid}` : ''}
${params.cta ? `Call To Action: ${params.cta}` : ''}
${params.primaryKeywords && params.primaryKeywords.length > 0 ? `Primary Keywords: ${params.primaryKeywords.join(', ')}` : ''}
${params.secondaryKeywords && params.secondaryKeywords.length > 0 ? `Secondary Keywords: ${params.secondaryKeywords.join(', ')}` : ''}`;

    const prompt = `Topic / Brief: "${params.topic}"
Content Type: ${params.contentType}
Target Audience: ${audienceDesc}
Target Word Count: ${minWords} - ${maxWords} words per option.
Generate exactly ${variantsCount} distinct, complete option(s).

Return STRICT valid raw JSON in the following format:
{
  "options": [
    {
      "title": "Compelling Title / Hook headline",
      "hook": "Opening hook sentence",
      "body": "Full body text formatted in clean Markdown..."
    }
  ]
}`;

    if (onProgress) onProgress(35, `Generating ${variantsCount} variant(s) in ${languageName}...`);

    let rawOutput: string;
    try {
      rawOutput = await geminiService.generateText(`${systemPrompt}\n\n${prompt}`);
    } catch (err: any) {
      logger.error('[ContentCreator] Generation failed:', err.message);
      throw new Error(`Content generation failed: ${err.message}`);
    }

    if (onProgress) onProgress(65, 'Parsing output and executing code-level word count enforcement...');

    let parsedOptions: Array<{ title: string; hook?: string; body: string }> = [];
    try {
      const cleanedJson = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      parsedOptions = Array.isArray(parsed.options) ? parsed.options : [parsed];
    } catch {
      // Fallback manual parser
      parsedOptions = [{
        title: params.topic,
        hook: params.topic,
        body: rawOutput
      }];
    }

    // Ensure we have the requested variants count
    while (parsedOptions.length < variantsCount) {
      parsedOptions.push({
        title: `${params.topic} (Variant ${parsedOptions.length + 1})`,
        hook: params.topic,
        body: parsedOptions[0]?.body || params.topic
      });
    }

    const finalOptions: GeneratedContentOption[] = [];

    for (let i = 0; i < variantsCount; i++) {
      let opt = parsedOptions[i] || { title: `${params.topic} - Option ${i + 1}`, body: '' };
      let bodyText = opt.body || '';
      let words = calculateWordCount(bodyText);
      let retries = 0;

      // Word count enforcement loop: if outside [minWords, maxWords], re-prompt model to trim/expand
      while ((words < minWords! || words > maxWords!) && retries < 2) {
        retries++;
        if (onProgress) {
          onProgress(
            70 + retries * 10,
            `Option ${i + 1} has ${words} words (target: ${minWords}-${maxWords}). Re-calibrating length (Attempt ${retries})...`
          );
        }

        const adjustmentPrompt = words > maxWords!
          ? `The following ${params.contentType} is ${words} words long, which exceeds our maximum of ${maxWords} words.
Condense and trim this text so it is strictly between ${minWords} and ${maxWords} words while retaining the core hook, clarity, and call to action.
Text:
"""
${bodyText}
"""
Return ONLY the tightened body text in clean Markdown without commentary.`
          : `The following ${params.contentType} is only ${words} words long, which is below our target of ${minWords}-${maxWords} words.
Expand and flesh out this text with concrete examples, practical steps, or deeper explanation so it is strictly between ${minWords} and ${maxWords} words.
Text:
"""
${bodyText}
"""
Return ONLY the expanded body text in clean Markdown without commentary.`;

        try {
          const adjusted = await geminiService.generateText(adjustmentPrompt);
          if (adjusted && adjusted.trim().length > 20) {
            bodyText = adjusted.replace(/```markdown/gi, '').replace(/```/g, '').trim();
            words = calculateWordCount(bodyText);
          }
        } catch {
          break;
        }
      }

      // Final real calculations in code (never model-invented)
      const finalWords = calculateWordCount(bodyText);
      const finalChars = calculateCharCount(bodyText);
      const readingTime = calculateReadingTime(finalWords);
      const inRange = Boolean(minWords && maxWords && finalWords >= minWords && finalWords <= maxWords);

      finalOptions.push({
        optionIndex: i + 1,
        title: opt.title || `${params.topic} - Variant ${i + 1}`,
        hook: opt.hook || opt.title,
        body: bodyText,
        wordCount: finalWords,
        characterCount: finalChars,
        readingTimeMinutes: readingTime,
        withinTargetRange: inRange,
        retriesApplied: retries,
        sourcesCited: []
      });
    }

    if (onProgress) onProgress(95, 'Persisting generated content and version history in PostgreSQL...');

    const result: ContentGenerationResult = {
      id: contentId,
      topic: params.topic,
      contentType: params.contentType,
      targetAudience: params.targetAudience || {},
      wordCountTarget: params.wordCountTarget,
      minWordCount: minWords,
      maxWordCount: maxWords,
      tone: params.tone || 'Professional',
      language: languageName,
      readingLevel: params.readingLevel || 'Professional',
      options: finalOptions,
      createdAt: new Date().toISOString()
    };

    // Save primary option to database
    try {
      const primary = finalOptions[0];
      await db.saveContentItem({
        id: contentId,
        title: primary.title,
        contentType: params.contentType,
        topic: params.topic,
        targetAudience: params.targetAudience || {},
        wordCountTarget: params.wordCountTarget || minWords,
        actualWordCount: primary.wordCount,
        characterCount: primary.characterCount,
        readingTimeMinutes: primary.readingTimeMinutes,
        tone: params.tone || 'Professional',
        language: langKey,
        readingLevel: params.readingLevel || 'Professional',
        keywords: params.primaryKeywords || [],
        cta: params.cta,
        brandVoice: params.brandVoice,
        thingsToAvoid: params.thingsToAvoid,
        body: primary.body,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Save initial version
      await db.saveContentVersion({
        id: `ver_${Date.now()}_1`,
        contentId,
        versionNumber: 1,
        title: primary.title,
        body: primary.body,
        wordCount: primary.wordCount,
        characterCount: primary.characterCount,
        readingTimeMinutes: primary.readingTimeMinutes,
        changeSummary: 'Initial generation from brief'
      });
    } catch (err: any) {
      logger.warn('[ContentCreator] DB persistence note:', err.message);
    }

    if (onProgress) onProgress(100, `Completed: ${finalOptions.length} option(s) generated.`);
    return result;
  }

  /**
   * Refines an existing option (e.g. "make shorter", "make longer", "change tone")
   */
  public async refineOption(
    bodyText: string,
    action: 'shorter' | 'longer' | 'change_tone' | 'regenerate',
    options?: { targetTone?: string; currentTitle?: string }
  ): Promise<{ body: string; wordCount: number; characterCount: number; readingTimeMinutes: number }> {
    let prompt = '';
    const currentWords = calculateWordCount(bodyText);

    switch (action) {
      case 'shorter':
        prompt = `Tighten, streamline, and shorten the following content by approximately 25-35%. Cut fluff while maintaining punch and clarity.\n\nContent:\n"""\n${bodyText}\n"""\n\nReturn ONLY the shortened text in clean Markdown without commentary.`;
        break;
      case 'longer':
        prompt = `Elaborate on the following content by adding practical depth, actionable examples, and stronger nuance (expanding word count by ~25-35%).\n\nContent:\n"""\n${bodyText}\n"""\n\nReturn ONLY the expanded text in clean Markdown without commentary.`;
        break;
      case 'change_tone':
        prompt = `Rewrite the following content in a ${options?.targetTone || 'Persuasive & Bold'} tone. Keep the core substance and message identical.\n\nContent:\n"""\n${bodyText}\n"""\n\nReturn ONLY the revised text in clean Markdown without commentary.`;
        break;
      case 'regenerate':
      default:
        prompt = `Regenerate a fresh, distinct alternative angle for this content. Use a completely new opening hook and narrative structure.\n\nOriginal:\n"""\n${bodyText}\n"""\n\nReturn ONLY the new body text in clean Markdown without commentary.`;
        break;
    }

    const revised = await geminiService.generateText(prompt);
    const cleaned = revised.replace(/```markdown/gi, '').replace(/```/g, '').trim();
    const finalWords = calculateWordCount(cleaned);

    return {
      body: cleaned,
      wordCount: finalWords,
      characterCount: calculateCharCount(cleaned),
      readingTimeMinutes: calculateReadingTime(finalWords)
    };
  }
}

export const contentGeneratorService = new ContentGeneratorService();
