export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  metadata?: {
    model?: string;
    tokens?: number;
    error?: string;
    agentMode?: any;
    plan?: string[];
    toolCalls?: Array<{
      tool: string;
      args: any;
      result?: any;
      status?: string;
      success?: boolean;
      [key: string]: any;
    }>;
  };
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  category?: string;
  lastMessage?: string;
}

export interface AppStats {
  totalTasks: number;
  completedTasks: number;
  totalConversations: number;
  totalMessages: number;
}

export interface BackgroundJob {
  jobId: string;
  agentId: 'prospector' | 'seo' | 'research' | 'email_finder' | 'document' | 'email' | 'content' | 'seo_editor' | 'whatsapp';
  companyId: string | null;
  researchId: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  progress: number;
  currentStage: string | null;
  input: string;
  result: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SystemSettings {
  configured: boolean;
  activeModel?: string;
  availableModels?: string[];
  firebaseConfigured?: boolean;
  projectId?: string;
  last4?: string | null;
  maskedKey?: string | null;
  hunter?: HunterSettings;
}

export interface ContentResult {
  content: string;
  contentType?: string;
  topic?: string;
  stats?: {
    wordCount?: number;
    readingTimeMinutes?: number;
  };
}

export interface EmailSequenceResult {
  sequence: string;
  campaignType?: string;
  touchpoints?: number;
  targetAudience?: string;
  emails?: Array<{
    subject: string;
    body: string;
    delayDays?: number;
  }>;
}

export interface KnowledgeItem {
  id: string;
  category: 'Company Profile' | 'Brand Guidelines' | 'Product Catalog' | 'Target Personas' | 'Competitor Intel' | 'Custom Playbook';
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  originalName?: string;
  size?: number;
  sizeBytes?: number;
  wordCount?: number;
  fileType?: string;
  mimeType?: string;
  extractedText?: string;
  uploadedAt?: string;
}

export interface ResearchResult {
  topic: string;
  summary: string;
  report?: string;
  keyFindings?: string[];
  marketTrends?: string[];
  competitors?: string[];
  opportunities?: string[];
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

export interface SeoAnalysisResult {
  url: string;
  domain?: string;
  statusCode?: number;
  score: number;
  title: string;
  titleLength?: number;
  description: string;
  descriptionLength?: number;
  canonicalUrl?: string | null;
  robotsDirective?: string | null;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  images?: {
    total: number;
    missingAlt: number;
    samplesMissingAlt?: string[];
    [key: string]: any;
  };
  links?: {
    internal?: number;
    external?: number;
    internalCount?: number;
    externalCount?: number;
    [key: string]: any;
  };
  robotsTxt?: {
    status: number;
    found: boolean;
    sitemaps: string[];
    disallowedPaths: string[];
  };
  sitemap?: {
    status: number;
    found: boolean;
    url: string;
  };
  performance?: {
    score: number | 'Not measured';
    fcpMs?: number | 'Not measured';
    lcpMs?: number | 'Not measured';
    cls?: number | 'Not measured';
    details: string;
  };
  pageData?: {
    url: string;
    statusCode: number;
    title: string;
    titleLength: number;
    description: string;
    descriptionLength: number;
    canonicalUrl: string | null;
    robotsDirective: string | null;
    headings: {
      h1: string[];
      h2: string[];
      h3: string[];
    };
    images: {
      total: number;
      missingAlt: number;
      samplesMissingAlt?: string[];
    };
    links: {
      internalCount: number;
      externalCount: number;
    };
    schemasFound?: string[];
  };
  findings?: Array<{
    url: string;
    category: string;
    title: string;
    actualValue: string;
    evidence: string;
    fix: string;
    priority: 'critical' | 'warning' | 'info' | 'good' | 'not_checked';
  }>;
  issues?: Array<{
    type: 'critical' | 'warning' | 'info';
    message: string;
    category?: string;
    title?: string;
    explanation?: string;
    recommendation?: string;
    [key: string]: any;
  }>;
  recommendations?: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    action: string;
  }>;
  geoAeoRecommendations?: any[];
  aiSearchOptimization?: {
    readabilityScore?: number;
    entityClarity?: string;
    summarySuggestions?: string[];
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata?: {
    category?: string;
    agentMode?: string;
  };
}

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tool?: string;
  output?: string;
}

export interface Task {
  id: string;
  instruction: string;
  category: string;
  status: TaskStatus;
  startTime: string;
  completionTime?: string;
  plan?: string[];
  steps?: TaskStep[];
  result?: string;
  error?: string;
}

export type LeadStatus =
  | 'New'
  | 'Qualified'
  | 'Contacted'
  | 'In Sequence'
  | 'Converted'
  | 'Disqualified';

export type EmailVerificationStatus =
  | 'Verified'
  | 'Publicly listed'
  | 'Found but unverified'
  | 'Invalid'
  | 'Not found';

export interface EmailProviderBadge {
  provider: 'hunter' | 'findymail' | 'leadmagic' | 'apollo' | 'website_scraper' | 'dns_mx';
  name: string;
  status: 'checked' | 'found' | 'not_configured' | 'error';
  details?: string;
  emailFound?: string;
}

/**
 * Traceable evidence proving where data was extracted from
 */
export interface ResearchEvidence {
  title: string;
  url: string;
  sourceType: 'official_website' | 'leadership_page' | 'tavily_search' | 'hunter_api' | 'osm_map' | 'live_web';
  retrievedAt: string;
  extractedSnippet: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface DecisionMaker {
  name: string;
  title: string;
  department?: string;
  linkedinUrl: string | null; // Real profile URL or null. Never fake search URL.
  linkedinStatus: 'found' | 'not_found';
  email: string | null;
  emailConfidence?: 'high' | 'medium' | 'low';
  verificationStatus?: 'verified' | 'unverified' | 'pattern_derived' | 'risky' | 'invalid';
  emailStatus?: EmailVerificationStatus;
  emailSource?: string | null;
  providerBadges?: EmailProviderBadge[];
  verificationDetails?: string;
  contactEvidence?: ResearchEvidence[];
  researchedAt?: string;
}

export interface PersonalizedEmailData {
  subject: string;
  subjectVariations: string[];
  body: string;
  hook: string;
  painPoint: string;
  valueProposition: string;
  cta: string;
  generatedAt: string;
  followUpSequences?: Array<{
    stepNumber: number;
    delayDays: number;
    subject: string;
    body: string;
  }>;
}

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface QualificationBreakdown {
  icpMatch: number; // 0-25
  serviceRelevance: number; // 0-25
  locationMatch: number; // 0-20
  operationalNeedEvidence: number; // 0-30
  totalScore: number; // 0-100
  reasons: string[];
}

export interface CompanyProfile {
  id: string; // e.g. "comp_tekaxis_com"
  url: string; // e.g. "https://tekaxis.com"
  domain: string; // "tekaxis.com"
  name: string; // "TekAxis"
  tagline?: string;
  description: string;
  industry: string;
  businessModel: string;
  productsAndServices: string[];
  targetIndustries: string[];
  customerTypes: string[];
  geographicMarkets: string[];
  technologiesUsedOrOffered: string[];
  problemsSolved: string[];
  uniqueSellingPropositions: string[];
  customerBenefits: string[];
  competitorPositioning: string;
  targetBuyerRoles: string[];
  defaultLocation?: {
    city: string;
    state: string;
    country: string;
  };
  scrapedPages?: string[];
  sources?: ResearchEvidence[];
  analyzedAt: string;
}

export interface Lead {
  id: string;
  companyId?: string; // Links lead to the researched company
  researchId?: string;
  targetCampaignId?: string;
  whyCustomer?: string; // Explicit evidence-backed reason
  companyName: string;
  website: string;
  industry: string;
  location: string;
  employeeCount?: string;
  description?: string;
  relevantOperations?: string;
  relevantServiceNeeded?: string;
  fitScore: number; // 0 to 100
  fitReasons: string[];
  qualificationBreakdown?: QualificationBreakdown;
  decisionMakers: DecisionMaker[];
  emailPattern?: string; // e.g., {first}.{last}@{domain}
  status: LeadStatus;
  notes?: string;
  tags?: string[];
  personalizedEmail?: PersonalizedEmailData;
  sources?: string[];
  evidenceSources?: ResearchEvidence[];
  // Map-based discovery fields
  coordinates?: MapCoordinates;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  distanceMiles?: number;
  businessCategory?: string;
  mapsUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadStats = ExtendedLeadStats;

export interface ProspectingCriteria {
  industry: string;
  location?: string;
  targetRoles?: string[];
  companySize?: string;
  techKeywords?: string[];
  limit?: number;
  campaignId?: string;
  // Map discovery filters
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  radiusMiles?: number;
}

export interface Competitor {
  id: string;
  companyId: string;
  researchId?: string;
  name: string;
  website: string;
  category: 'direct' | 'indirect' | 'adjacent';
  servicesOrProducts: string[];
  industry: string;
  location: string;
  targetCustomers: string[];
  differentiators: string[];
  whyCompetitor: string;
  sources: ResearchEvidence[];
  geographicMarket?: string;
  products?: string[];
  capabilities?: string[];
}

export interface CampaignKeywordGroup {
  id: string;
  companyId: string;
  researchId?: string;
  title: string;
  targetIndustry: string;
  targetCompanyType: string;
  coreServiceKeywords: string[];
  problemKeywords: string[];
  buyingIntentKeywords: string[];
  negativeKeywords: string[];
  relevantServices: string[];
  suggestedRoles: string[];
  targetGeography: {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
    radiusMiles?: number;
  };
  idealCompanySize: string;
  qualificationCriteria: string[];
  actualDiscoveredCount: number; // Actual count, NO fake 2.4k
  approved?: boolean;
  keywords?: string[];
  countEstimate?: number;
}

export interface ExtendedLeadStats {
  totalLeads: number;
  qualified: number;
  contacted: number;
  converted: number;
  avgScore: number;
  companiesDiscovered: number;
  companiesMapped: number;
  decisionMakersIdentified: number;
  emailsFound: number;
  emailsVerified: number;
  emailsNotFound: number;
  personalizedEmailsGenerated: number;
}

export interface ResearchStepActivity {
  stepNumber: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
  logs: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'search' | 'scrape' | 'verify' | 'success' | 'warn';
    url?: string;
  }>;
}

export interface ResearchSession {
  id: string; // Unique research session ID
  companyId: string; // Target company ID (e.g. comp_tekaxis_com)
  targetUrl: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  maxCompletedStep: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  status: 'idle' | 'running' | 'completed' | 'error';
  stepProgress: ResearchStepActivity[];
  profile?: CompanyProfile;
  competitors?: Competitor[];
  campaigns?: CampaignKeywordGroup[];
  leads?: Lead[];
  stats?: ExtendedLeadStats;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Discovered Contact for the standalone Email & LinkedIn Finder module
 */
export interface DiscoveredContact {
  id: string;
  name: string;
  email: string | null;
  title: string;
  department: string;
  company: string;
  domain: string;
  website: string;
  industry?: string;
  location?: string;
  linkedinUrl: string | null;
  discoveryKeyword: string;
  discoverySource: string;
  sourceUrl: string;
  emailStatus: 'Verified' | 'Publicly listed' | 'Found but unverified' | 'Invalid' | 'Risky or unknown' | 'Not found' | 'Unavailable';
  confidence: 'high' | 'medium' | 'low';
  verificationStatus?: 'Verified' | 'Partially verified' | 'Unverified' | 'Rejected';
  companyEvidence?: string;
  linkedinEvidence?: string;
  lastCheckedDate?: string;
  verificationDetails?: string;
  discoveredAt: string;
}

export interface HunterSettings {
  configured: boolean;
  emailDiscoveryEnabled: boolean;
  maskedKey: string | null;
  last4?: string | null;
  status: 'configured' | 'not_configured' | 'invalid_key' | 'credits_exhausted';
  remainingCredits?: number;
  remainingSearches?: number;
  remainingVerifications?: number;
  planName?: string;
  message?: string;
  details?: string;
}

export interface EmailSearchProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentKeyword?: string;
  currentSource?: string;
  pagesScanned: number;
  keywordsProcessed: number;
  totalKeywords: number;
  contactsDiscovered: number;
  duplicatesRemoved: number;
  emailsVerified: number;
  logs: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'search' | 'verify' | 'success' | 'warn';
  }>;
}

export interface EmailSearchRun {
  id: string;
  mode: 'single_company' | 'keyword_discovery';
  targetUrl?: string;
  domain?: string;
  companyName?: string;
  keywords: string[];
  targetIndustry?: string;
  targetLocation?: string;
  targetRoles?: string[];
  requestedLimit: number;
  actualDiscoveredCount: number;
  stats: {
    totalFound: number;
    linkedinProfilesFound: number;
    emailsFound: number;
    verified: number;
    publiclyListed: number;
    unverified: number;
    invalidOrRisky: number;
    duplicatesRemoved: number;
  };
  sourcesUsed: string[];
  contacts: DiscoveredContact[];
  createdAt: string;
}


// ============================================================================
// AGENT 3 - CONTENT CREATOR TYPES
// ============================================================================

export interface ContentTargetAudience {
  role?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  painPoints?: string[];
  notes?: string;
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
  targetAudience: ContentTargetAudience;
  wordCountTarget?: number;
  minWordCount?: number;
  maxWordCount?: number;
  tone: string;
  language: string;
  readingLevel: string;
  options: GeneratedContentOption[];
  createdAt: string;
}

export interface ContentItem {
  id: string;
  title: string;
  contentType: string;
  topic: string;
  targetAudience: ContentTargetAudience;
  wordCountTarget?: number;
  actualWordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  tone?: string;
  language: string;
  readingLevel?: string;
  keywords: string[];
  cta?: string;
  brandVoice?: string;
  thingsToAvoid?: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  versions?: ContentVersion[];
}

export interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;
  title: string;
  body: string;
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  changeSummary?: string;
  createdAt: string;
}

// ============================================================================
// AGENT 4 - SEO CONTENT EDITOR TYPES
// ============================================================================

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
    longSentencesCount: number;
    paragraphCount: number;
    longParagraphsCount: number;
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

export interface EditorDocument {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  targetKeyword: string;
  metaDescription: string;
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  fleschScore: number;
  seoScore: number;
  analysisBreakdown: SeoBreakdownItem[];
  faqSections: any[];
  jsonLdSchemas: any;
  createdAt: string;
  updatedAt: string;
  versions?: EditorDocumentVersion[];
}

export interface EditorDocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  content: string;
  htmlContent?: string;
  seoScore: number;
  savedAt: string;
}

export interface GeoSchemasResult {
  faqSection: Array<{ question: string; answer: string }>;
  articleSchema: Record<string, any>;
  faqPageSchema: Record<string, any>;
  organizationSchema: Record<string, any>;
  jsonLdCombined: string;
  disclaimer: string;
}

export interface WhatsAppLead {
  id: string;
  businessName: string;
  category: string;
  phoneRaw: string;
  phoneInternational: string; // E.164 formatted (e.g. +91 98450 12345)
  phoneDigitsOnly: string; // Clean numeric string (e.g. 919845012345)
  whatsappUrl: string; // Direct https://wa.me/919845012345?text=...
  address: string;
  city: string;
  state?: string;
  country: string;
  website?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'low';
  isMobile: boolean;
  notes?: string;
  discoveredAt: string;
}

export interface WhatsAppSearchParams {
  keywords: string;
  location: string;
  countryCode?: string; // e.g. '+91', '+1', '+971', '+44'
  limit?: number;
  messageTemplate?: string;
}

export interface WhatsAppSearchRun {
  id: string;
  keywords: string;
  location: string;
  countryCode: string;
  requestedLimit: number;
  actualDiscoveredCount: number;
  messageTemplate?: string;
  stats: {
    totalFound: number;
    mobileVerified: number;
    highConfidence: number;
    withWebsite: number;
  };
  leads: WhatsAppLead[];
  createdAt: string;
}

