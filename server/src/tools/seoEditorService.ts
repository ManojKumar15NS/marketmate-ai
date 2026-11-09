import * as cheerio from 'cheerio';
import { safeFetch, validateSafeUrl } from './webFetcher.js';
import { geminiService } from '../services/gemini.js';
import { logger } from '../utils/logger.js';

export interface SeoBreakdownItem {
  name: string;
  category: 'keyword' | 'structure' | 'readability' | 'meta' | 'media';
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'critical';
  details: string;
  recommendation?: string;
}

export interface SeoAnalysisReport {
  overallScore: number; // 0 to 100
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  fleschReadingEase: number;
  readingGradeLevel: string;
  targetKeyword: string;
  keywordCount: number;
  keywordDensityPercent: number;
  keywordInTitle: boolean;
  keywordInH1: boolean;
  keywordInFirstParagraph: boolean;
  keywordInSubheadingsCount: number;
  titleLength: number;
  titleLengthStatus: 'good' | 'short' | 'long';
  metaDescriptionLength: number;
  metaDescriptionStatus: 'good' | 'short' | 'long' | 'missing';
  headings: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    h4Count: number;
    h1List: string[];
    structureValid: boolean;
  };
  links: {
    total: number;
    internal: number;
    external: number;
  };
  images: {
    total: number;
    withAlt: number;
    missingAlt: number;
    altCoveragePercent: number;
  };
  readability: {
    sentenceCount: number;
    avgWordsPerSentence: number;
    longSentencesCount: number; // >25 words
    paragraphCount: number;
    longParagraphsCount: number; // >150 words
  };
  repeatedPhrases: Array<{ phrase: string; count: number }>;
  breakdown: SeoBreakdownItem[];
}

export interface EditorSuggestion {
  id: string;
  type: 'title' | 'meta' | 'faq' | 'internal_link' | 'rewrite';
  title: string;
  currentValue?: string;
  suggestedValue: string;
  reason: string;
  applied: boolean;
}

export interface GeoSchemasResult {
  faqSection: Array<{ question: string; answer: string }>;
  articleSchema: Record<string, any>;
  faqPageSchema: Record<string, any>;
  organizationSchema: Record<string, any>;
  jsonLdCombined: string;
  disclaimer: string;
}

// Deterministic Syllable Counter for English text
function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean || clean.length <= 3) return 1;
  const match = clean
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return match ? Math.max(1, match.length) : 1;
}

export class SeoEditorService {
  /**
   * Deterministic Code-Calculated SEO & Readability Analysis.
   * LLM NEVER invents or guesses a score.
   */
  public analyzeContent(
    content: string,
    targetKeyword: string = '',
    title: string = '',
    metaDescription: string = ''
  ): SeoAnalysisReport {
    const rawText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanKw = targetKeyword.trim().toLowerCase();

    // Word tokens
    const words = rawText.match(/[\w\u00C0-\u024F\u4E00-\u9FFF\u0900-\u097F\-']+/g) || [];
    const wordCount = words.length;
    const characterCount = rawText.length;
    const readingTimeMinutes = Number((wordCount / 200).toFixed(1));

    // Sentences
    const sentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    const sentenceCount = Math.max(1, sentences.length);
    const avgWordsPerSentence = Number((wordCount / sentenceCount).toFixed(1));
    const longSentencesCount = sentences.filter(s => (s.match(/\S+/g) || []).length > 25).length;

    // Paragraphs
    const paragraphs = content.split(/\n\n+|<p[^>]*>/i).map(p => p.replace(/<[^>]+>/g, '').trim()).filter(p => p.length > 0);
    const paragraphCount = Math.max(1, paragraphs.length);
    const longParagraphsCount = paragraphs.filter(p => (p.match(/\S+/g) || []).length > 150).length;

    // Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
    let totalSyllables = 0;
    for (const w of words) totalSyllables += countSyllables(w);
    const syllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 1;
    let flesch = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * syllablesPerWord;
    flesch = Math.min(100, Math.max(0, Number(flesch.toFixed(1))));

    let readingGradeLevel = '8th & 9th Grade (Plain English)';
    if (flesch >= 90) readingGradeLevel = '5th Grade (Very Easy)';
    else if (flesch >= 80) readingGradeLevel = '6th Grade (Easy)';
    else if (flesch >= 70) readingGradeLevel = '7th Grade (Fairly Easy)';
    else if (flesch >= 60) readingGradeLevel = '8th & 9th Grade (Standard Plain English)';
    else if (flesch >= 50) readingGradeLevel = '10th to 12th Grade (Fairly Difficult)';
    else if (flesch >= 30) readingGradeLevel = 'College (Difficult)';
    else readingGradeLevel = 'College Graduate (Very Confusing / Academic)';

    // Keyword analysis
    let keywordCount = 0;
    let keywordDensityPercent = 0;
    let keywordInTitle = false;
    let keywordInH1 = false;
    let keywordInFirstParagraph = false;
    let keywordInSubheadingsCount = 0;

    if (cleanKw.length > 0) {
      const regex = new RegExp(`\\b${cleanKw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      const matches = rawText.match(regex);
      keywordCount = matches ? matches.length : 0;
      keywordDensityPercent = wordCount > 0 ? Number(((keywordCount / wordCount) * 100).toFixed(2)) : 0;

      if (title.toLowerCase().includes(cleanKw)) keywordInTitle = true;

      const firstPara = paragraphs[0] || '';
      if (firstPara.toLowerCase().includes(cleanKw)) keywordInFirstParagraph = true;
    }

    // HTML / DOM inspection via Cheerio
    const $ = cheerio.load(`<div id="root">${content}</div>`);
    const h1Elements = $('h1').toArray().map(el => $(el).text().trim());
    const h2Elements = $('h2').toArray().map(el => $(el).text().trim());
    const h3Elements = $('h3').toArray().map(el => $(el).text().trim());
    const h4Elements = $('h4').toArray().map(el => $(el).text().trim());

    if (cleanKw.length > 0) {
      if (h1Elements.some(h => h.toLowerCase().includes(cleanKw))) keywordInH1 = true;
      keywordInSubheadingsCount = [...h2Elements, ...h3Elements, ...h4Elements].filter(h =>
        h.toLowerCase().includes(cleanKw)
      ).length;
    }

    const h1Count = h1Elements.length;
    const h2Count = h2Elements.length;
    const h3Count = h3Elements.length;
    const h4Count = h4Elements.length;
    const structureValid = h1Count === 1 && (h2Count >= 1 || wordCount < 300);

    // Links
    const links = $('a').toArray();
    let internalLinks = 0;
    let externalLinks = 0;
    for (const a of links) {
      const href = $(a).attr('href') || '';
      if (href.startsWith('/') || href.startsWith('#') || !/^https?:\/\//i.test(href)) {
        internalLinks++;
      } else {
        externalLinks++;
      }
    }

    // Images
    const imgs = $('img').toArray();
    let withAlt = 0;
    let missingAlt = 0;
    for (const img of imgs) {
      const alt = $(img).attr('alt');
      if (alt && alt.trim().length > 0) withAlt++;
      else missingAlt++;
    }
    const totalImages = imgs.length;
    const altCoveragePercent = totalImages > 0 ? Math.round((withAlt / totalImages) * 100) : 100;

    // Title & Meta targets: Title 50-60, Meta 140-155
    const titleLen = title.trim().length;
    let titleLengthStatus: 'good' | 'short' | 'long' = 'good';
    if (titleLen === 0 || titleLen < 50) titleLengthStatus = 'short';
    else if (titleLen > 60) titleLengthStatus = 'long';

    const metaLen = metaDescription.trim().length;
    let metaDescriptionStatus: 'good' | 'short' | 'long' | 'missing' = 'good';
    if (metaLen === 0) metaDescriptionStatus = 'missing';
    else if (metaLen < 140) metaDescriptionStatus = 'short';
    else if (metaLen > 155) metaDescriptionStatus = 'long';

    // Duplicate phrase detection (3-word n-grams)
    const repeatedPhrases: Array<{ phrase: string; count: number }> = [];
    if (words.length >= 10) {
      const phraseCounts = new Map<string, number>();
      for (let i = 0; i <= words.length - 3; i++) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase();
        if (!/^(the|and|for|that|with|this|from|your|have)\s+/i.test(trigram)) {
          phraseCounts.set(trigram, (phraseCounts.get(trigram) || 0) + 1);
        }
      }
      for (const [phrase, count] of phraseCounts.entries()) {
        if (count >= 3 && phrase.length >= 10) {
          repeatedPhrases.push({ phrase, count });
        }
      }
      repeatedPhrases.sort((a, b) => b.count - a.count);
    }

    // --- TRANSPARENT DETERMINISTIC SCORE COMPUTATION ---
    const breakdown: SeoBreakdownItem[] = [];
    let score = 0;

    // 1. Keyword in Title (15 pts)
    if (cleanKw) {
      if (keywordInTitle) {
        score += 15;
        breakdown.push({
          name: 'Target Keyword in Title',
          category: 'keyword',
          score: 15,
          maxScore: 15,
          status: 'good',
          details: `Target keyword "${cleanKw}" is present in title.`
        });
      } else {
        breakdown.push({
          name: 'Target Keyword in Title',
          category: 'keyword',
          score: 0,
          maxScore: 15,
          status: 'warning',
          details: `Keyword "${cleanKw}" is missing from title.`,
          recommendation: `Include "${cleanKw}" near the beginning of your document title.`
        });
      }
    } else {
      breakdown.push({
        name: 'Target Keyword',
        category: 'keyword',
        score: 0,
        maxScore: 15,
        status: 'warning',
        details: 'No target keyword specified.',
        recommendation: 'Enter a primary target keyword to evaluate placement and density.'
      });
    }

    // 2. Keyword in H1 (15 pts)
    if (cleanKw) {
      if (keywordInH1) {
        score += 15;
        breakdown.push({
          name: 'Target Keyword in H1',
          category: 'keyword',
          score: 15,
          maxScore: 15,
          status: 'good',
          details: `H1 heading includes target keyword "${cleanKw}".`
        });
      } else {
        breakdown.push({
          name: 'Target Keyword in H1',
          category: 'keyword',
          score: 0,
          maxScore: 15,
          status: 'warning',
          details: `H1 heading does not contain "${cleanKw}".`,
          recommendation: `Include target keyword "${cleanKw}" in your main <h1> heading.`
        });
      }
    }

    // 3. Keyword in First Paragraph (10 pts)
    if (cleanKw) {
      if (keywordInFirstParagraph) {
        score += 10;
        breakdown.push({
          name: 'Target Keyword in Intro',
          category: 'keyword',
          score: 10,
          maxScore: 10,
          status: 'good',
          details: 'Target keyword is present in the opening paragraph.'
        });
      } else {
        breakdown.push({
          name: 'Target Keyword in Intro',
          category: 'keyword',
          score: 0,
          maxScore: 10,
          status: 'warning',
          details: 'Keyword is missing from the first paragraph.',
          recommendation: 'Mention the primary keyword within the first 100 words.'
        });
      }
    }

    // 4. Keyword Density (15 pts) - Ideal: 1.0% to 2.5%
    if (cleanKw) {
      if (keywordDensityPercent >= 1.0 && keywordDensityPercent <= 2.5) {
        score += 15;
        breakdown.push({
          name: 'Keyword Density',
          category: 'keyword',
          score: 15,
          maxScore: 15,
          status: 'good',
          details: `Keyword density is optimal at ${keywordDensityPercent}% (${keywordCount} occurrences).`
        });
      } else if ((keywordDensityPercent >= 0.5 && keywordDensityPercent < 1.0) || (keywordDensityPercent > 2.5 && keywordDensityPercent <= 3.5)) {
        score += 8;
        breakdown.push({
          name: 'Keyword Density',
          category: 'keyword',
          score: 8,
          maxScore: 15,
          status: 'warning',
          details: `Keyword density is ${keywordDensityPercent}% (${keywordCount} occurrences). Ideal range is 1.0% - 2.5%.`,
          recommendation: keywordDensityPercent < 1.0 ? 'Add a few more natural mentions.' : 'Slightly reduce frequency to prevent keyword stuffing.'
        });
      } else {
        breakdown.push({
          name: 'Keyword Density',
          category: 'keyword',
          score: 0,
          maxScore: 15,
          status: 'critical',
          details: `Keyword density is ${keywordDensityPercent}% (${keywordCount} occurrences).`,
          recommendation: keywordCount === 0 ? 'Target keyword not found in body text.' : 'Excessive keyword density may trigger search engine penalties.'
        });
      }
    }

    // 5. Headings Structure (10 pts)
    if (h1Count === 1) {
      if (h2Count >= 1 || wordCount < 300) {
        score += 10;
        breakdown.push({
          name: 'Heading Structure',
          category: 'structure',
          score: 10,
          maxScore: 10,
          status: 'good',
          details: `Clean hierarchy: 1 H1 heading and ${h2Count} H2 subheadings.`
        });
      } else {
        score += 5;
        breakdown.push({
          name: 'Heading Structure',
          category: 'structure',
          score: 5,
          maxScore: 10,
          status: 'warning',
          details: 'Single H1 found, but no H2 subheadings to organize longer content.',
          recommendation: 'Break long sections into thematic H2 subheadings.'
        });
      }
    } else if (h1Count === 0) {
      breakdown.push({
        name: 'Heading Structure',
        category: 'structure',
        score: 0,
        maxScore: 10,
        status: 'critical',
        details: 'No <h1> heading detected.',
        recommendation: 'Add exactly one <h1> heading at the top of the document.'
      });
    } else {
      score += 4;
      breakdown.push({
        name: 'Heading Structure',
        category: 'structure',
        score: 4,
        maxScore: 10,
        status: 'warning',
        details: `Multiple H1 headings detected (${h1Count} found).`,
        recommendation: 'Consolidate to a single <h1> heading; convert others to <h2>.'
      });
    }

    // 6. Content Length (10 pts)
    if (wordCount >= 600) {
      score += 10;
      breakdown.push({
        name: 'Content Length',
        category: 'structure',
        score: 10,
        maxScore: 10,
        status: 'good',
        details: `Comprehensive content depth (${wordCount} words).`
      });
    } else if (wordCount >= 300) {
      score += 7;
      breakdown.push({
        name: 'Content Length',
        category: 'structure',
        score: 7,
        maxScore: 10,
        status: 'good',
        details: `Standard content length (${wordCount} words).`
      });
    } else if (wordCount >= 100) {
      score += 4;
      breakdown.push({
        name: 'Content Length',
        category: 'structure',
        score: 4,
        maxScore: 10,
        status: 'warning',
        details: `Short content (${wordCount} words).`,
        recommendation: 'Expand content to at least 300 words for search indexing.'
      });
    } else {
      breakdown.push({
        name: 'Content Length',
        category: 'structure',
        score: 0,
        maxScore: 10,
        status: 'critical',
        details: `Very thin content (${wordCount} words).`,
        recommendation: 'Write more substantive copy.'
      });
    }

    // 7. Readability (10 pts)
    if (flesch >= 60) {
      score += 10;
      breakdown.push({
        name: 'Readability (Flesch Score)',
        category: 'readability',
        score: 10,
        maxScore: 10,
        status: 'good',
        details: `Flesch score is ${flesch} (${readingGradeLevel}). Clear and accessible.`
      });
    } else if (flesch >= 45) {
      score += 6;
      breakdown.push({
        name: 'Readability (Flesch Score)',
        category: 'readability',
        score: 6,
        maxScore: 10,
        status: 'warning',
        details: `Flesch score is ${flesch} (${readingGradeLevel}).`,
        recommendation: 'Simplify complex sentence structures and shorten long words.'
      });
    } else {
      score += 2;
      breakdown.push({
        name: 'Readability (Flesch Score)',
        category: 'readability',
        score: 2,
        maxScore: 10,
        status: 'critical',
        details: `Flesch score is ${flesch} (${readingGradeLevel}). Content is very dense.`,
        recommendation: 'Break down multi-clause sentences and use simpler vocabulary.'
      });
    }

    // 8. Title Length Target (5 pts) - 50 to 60 characters
    if (titleLengthStatus === 'good') {
      score += 5;
      breakdown.push({
        name: 'Title Tag Length',
        category: 'meta',
        score: 5,
        maxScore: 5,
        status: 'good',
        details: `Title length is ${titleLen} characters (within 50-60 target).`
      });
    } else {
      breakdown.push({
        name: 'Title Tag Length',
        category: 'meta',
        score: 2,
        maxScore: 5,
        status: 'warning',
        details: `Title length is ${titleLen} characters (${titleLengthStatus === 'short' ? 'under 50' : 'exceeds 60'}).`,
        recommendation: titleLengthStatus === 'short' ? 'Expand title to 50-60 chars with benefits/brand.' : 'Shorten title to under 60 chars to prevent SERP truncation.'
      });
    }

    // 9. Meta Description Target (5 pts) - 140 to 155 characters
    if (metaDescriptionStatus === 'good') {
      score += 5;
      breakdown.push({
        name: 'Meta Description Length',
        category: 'meta',
        score: 5,
        maxScore: 5,
        status: 'good',
        details: `Meta description is ${metaLen} characters (within 140-155 target).`
      });
    } else if (metaDescriptionStatus === 'missing') {
      breakdown.push({
        name: 'Meta Description Length',
        category: 'meta',
        score: 0,
        maxScore: 5,
        status: 'critical',
        details: 'Meta description is missing.',
        recommendation: 'Add a 140-155 character meta description summarizing the page.'
      });
    } else {
      score += 2;
      breakdown.push({
        name: 'Meta Description Length',
        category: 'meta',
        score: 2,
        maxScore: 5,
        status: 'warning',
        details: `Meta description is ${metaLen} characters (${metaDescriptionStatus === 'short' ? 'under 140' : 'exceeds 155'}).`,
        recommendation: 'Calibrate meta description to 140-155 characters.'
      });
    }

    // 10. Image Alt Text Coverage (5 pts)
    if (totalImages === 0 || altCoveragePercent >= 80) {
      score += 5;
      breakdown.push({
        name: 'Image Alt Text Coverage',
        category: 'media',
        score: 5,
        maxScore: 5,
        status: 'good',
        details: totalImages === 0 ? 'No images present.' : `All ${totalImages} image(s) have descriptive alt tags.`
      });
    } else {
      breakdown.push({
        name: 'Image Alt Text Coverage',
        category: 'media',
        score: 1,
        maxScore: 5,
        status: 'warning',
        details: `${missingAlt} out of ${totalImages} image(s) missing alt text (${altCoveragePercent}% coverage).`,
        recommendation: 'Add descriptive alt text containing target keywords to all images.'
      });
    }

    return {
      overallScore: Math.min(100, Math.max(0, score)),
      wordCount,
      characterCount,
      readingTimeMinutes,
      fleschReadingEase: flesch,
      readingGradeLevel,
      targetKeyword,
      keywordCount,
      keywordDensityPercent,
      keywordInTitle,
      keywordInH1,
      keywordInFirstParagraph,
      keywordInSubheadingsCount,
      titleLength: titleLen,
      titleLengthStatus,
      metaDescriptionLength: metaLen,
      metaDescriptionStatus,
      headings: {
        h1Count,
        h2Count,
        h3Count,
        h4Count,
        h1List: h1Elements,
        structureValid
      },
      links: {
        total: links.length,
        internal: internalLinks,
        external: externalLinks
      },
      images: {
        total: totalImages,
        withAlt,
        missingAlt,
        altCoveragePercent
      },
      readability: {
        sentenceCount,
        avgWordsPerSentence,
        longSentencesCount,
        paragraphCount,
        longParagraphsCount
      },
      repeatedPhrases: repeatedPhrases.slice(0, 5),
      breakdown
    };
  }

  /**
   * Generates grounded AI suggestions strictly based on the user's text.
   */
  public async generateSuggestions(
    content: string,
    targetKeyword: string,
    currentTitle: string = '',
    currentMeta: string = ''
  ): Promise<EditorSuggestion[]> {
    const rawSnippet = content.replace(/<[^>]+>/g, ' ').substring(0, 4000);

    const prompt = `You are an elite SEO & Content Optimization Consultant.
Document Text:
"""
${rawSnippet}
"""
Target Keyword: "${targetKeyword || 'Not specified'}"
Current Title: "${currentTitle}"
Current Meta Description: "${currentMeta}"

Provide 4 grounded, high-impact suggestions strictly grounded in the document text above:
1. Title suggestion (50-60 characters, front-loading keyword)
2. Meta description suggestion (140-155 characters)
3. FAQ question & answer (directly answering a key point in the text)
4. A targeted rewrite recommendation for clarity

Return STRICT raw JSON in this format:
{
  "suggestions": [
    {
      "type": "title",
      "title": "Optimized Title Tag (50-60 chars)",
      "currentValue": "${currentTitle}",
      "suggestedValue": "...",
      "reason": "..."
    },
    {
      "type": "meta",
      "title": "Click-Worthy Meta Description (140-155 chars)",
      "currentValue": "${currentMeta}",
      "suggestedValue": "...",
      "reason": "..."
    },
    {
      "type": "faq",
      "title": "Add Content-Grounded FAQ Item",
      "suggestedValue": "Q: ... \\nA: ...",
      "reason": "..."
    },
    {
      "type": "rewrite",
      "title": "Tighten Opening Hook",
      "suggestedValue": "...",
      "reason": "..."
    }
  ]
}`;

    try {
      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const list: any[] = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

      return list.map((s, idx) => ({
        id: `sug_${Date.now()}_${idx + 1}`,
        type: s.type || 'rewrite',
        title: s.title || 'Optimization Suggestion',
        currentValue: s.currentValue,
        suggestedValue: s.suggestedValue,
        reason: s.reason,
        applied: false
      }));
    } catch (err: any) {
      logger.warn('[SeoEditor] Suggestion generation notice:', err.message);
      return [
        {
          id: `sug_${Date.now()}_1`,
          type: 'title',
          title: 'Include Target Keyword in Title',
          currentValue: currentTitle,
          suggestedValue: targetKeyword ? `${targetKeyword} — Complete Practical Guide` : currentTitle,
          reason: 'Front-loading primary keyword increases click-through rate.',
          applied: false
        }
      ];
    }
  }

  /**
   * SSRF-safe Live Page Extractor for Comparison
   */
  public async extractLivePage(url: string): Promise<{
    url: string;
    title: string;
    metaDescription: string;
    headings: { h1: string[]; h2: string[]; h3: string[] };
    extractedBody: string;
  }> {
    const safeUrl = await validateSafeUrl(url);
    const res = await safeFetch(safeUrl.toString(), {
      headers: { 'User-Agent': 'MarketMate-AI-SEO-Editor/1.0' }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch page: HTTP status ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Strip scripts, styles, navigations
    $('script, style, noscript, nav, footer, header, svg').remove();

    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || '';
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      '';

    const h1 = $('h1').toArray().map(el => $(el).text().trim()).filter(Boolean);
    const h2 = $('h2').toArray().map(el => $(el).text().trim()).filter(Boolean);
    const h3 = $('h3').toArray().map(el => $(el).text().trim()).filter(Boolean);

    // Extract main text
    let body = $('main, article, #content, .content, body').first().text().replace(/\s+/g, ' ').trim();
    if (!body || body.length < 50) body = $('body').text().replace(/\s+/g, ' ').trim();

    return {
      url: safeUrl.toString(),
      title,
      metaDescription,
      headings: { h1, h2, h3 },
      extractedBody: body.substring(0, 10000)
    };
  }

  /**
   * Generates GEO Helpers: FAQ Section and structured JSON-LD schemas
   */
  public async generateGeoSchemas(
    content: string,
    title: string,
    targetKeyword: string,
    organizationName: string = 'MarketMate AI'
  ): Promise<GeoSchemasResult> {
    const rawSnippet = content.replace(/<[^>]+>/g, ' ').substring(0, 3500);

    const prompt = `Based STRICTLY on the following content, extract 3 authentic FAQ questions and answers that represent real search intent for "${targetKeyword || title}".
DO NOT invent facts not present in the content.
Content:
"""
${rawSnippet}
"""

Return strictly raw JSON format:
{
  "faq": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}`;

    let faqs: Array<{ question: string; answer: string }> = [];
    try {
      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.faq)) faqs = parsed.faq;
    } catch {
      faqs = [
        {
          question: `What are the key insights regarding ${targetKeyword || title}?`,
          answer: rawSnippet.substring(0, 200) + '...'
        }
      ];
    }

    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title || 'Marketing Article',
      description: content.substring(0, 150).replace(/<[^>]+>/g, ''),
      author: {
        '@type': 'Organization',
        name: organizationName
      },
      publisher: {
        '@type': 'Organization',
        name: organizationName
      },
      datePublished: new Date().toISOString()
    };

    const faqPageSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer
        }
      }))
    };

    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: organizationName,
      url: 'https://marketmate.ai'
    };

    const combined = JSON.stringify([articleSchema, faqPageSchema, organizationSchema], null, 2);

    return {
      faqSection: faqs,
      articleSchema,
      faqPageSchema,
      organizationSchema,
      jsonLdCombined: combined,
      disclaimer: 'Structured data schemas provide semantic markup for search engines and generative models. MarketMate AI does not guarantee third-party AI search citations.'
    };
  }
}

export const seoEditorService = new SeoEditorService();
