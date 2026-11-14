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

export type LineType = 'mobile' | 'landline' | 'toll_free' | 'unknown';
export type UsageType = 'business_reception' | 'direct_decision_maker' | 'department' | 'unknown';
export type WhatsAppStatus =
  | 'mobile_confirmed'
  | 'whatsapp_verified'
  | 'mobile_status_unknown'
  | 'landline'
  | 'invalid_or_disconnected'
  | 'unverified';

export type EmploymentVerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'rejected';

export type RoleCategory =
  | 'founder'
  | 'c_level'
  | 'director'
  | 'head_of_dept'
  | 'manager'
  | 'medical_director'
  | 'other';

export interface ScoreBreakdown {
  score: number; // 0 - 100
  reasons: string[];
}

export interface ContactPhone {
  id: string;
  originalNumber: string;
  e164Number: string; // e.g. +91 95918 06061
  digitsOnly: string; // e.g. 919591806061
  countryCode: string;
  lineType: LineType;
  usageType: UsageType;
  whatsappStatus: WhatsAppStatus;
  whatsappUrl?: string; // e.g. https://wa.me/919591806061?text=...
  associatedPersonId?: string;
  associatedPersonName?: string;
  sourceUrl?: string;
  verificationMethod: string;
  lastVerifiedDate: string;
}

export interface B2BDecisionMaker {
  id: string;
  name: string;
  designation: string;
  roleCategory: RoleCategory;
  companyName: string;
  companyId: string;
  branchLocation?: string;
  linkedinUrl?: string;
  email?: string;
  emailVerificationStatus?: 'Verified' | 'Publicly listed' | 'Unverified' | 'Not found';
  phone?: string;
  phoneE164?: string;
  phoneLineType?: LineType;
  whatsappStatus?: WhatsAppStatus;
  whatsappUrl?: string;
  employmentStatus: EmploymentVerificationStatus;
  confidenceScore: number; // 0 - 100
  sourceUrls: string[];
  sourceEvidence: string;
  discoveredAt: string;
}

export interface BranchInfo {
  isBranch: boolean;
  parentBrand: string;
  branchName: string;
  headquartersCity?: string;
}

export interface CompanyLead {
  id: string;
  businessName: string;
  brandName: string;
  branchInfo?: BranchInfo;
  industry: string;
  category: string;
  address: string;
  locality: string;
  city: string;
  state?: string;
  country: string;
  website?: string;
  googleProfileUrl?: string;
  linkedinUrl?: string;
  rating?: string;
  reviewCount?: number;
  operatingHours?: string;
  phones: ContactPhone[];
  decisionMakers: B2BDecisionMaker[];
  companyFitScore: ScoreBreakdown;
  contactQualityScore: ScoreBreakdown;
  totalScore: number; // 0 - 100
  sourceType: 'google_business' | 'official_website' | 'linkedin' | 'directory_listing' | 'live_web';
  sourceUrls: string[];
  sourceEvidence?: string;
  verificationStatus: 'verified' | 'partially_verified' | 'unverified';
  discoveredAt: string;
}

export interface WhatsAppLead {
  id: string;
  businessName: string;
  brandName?: string;
  category: string;
  phoneRaw: string;
  phoneInternational: string; // E.164 formatted (e.g. +91 98450 12345)
  phoneDigitsOnly: string; // Clean numeric string (e.g. 919845012345)
  whatsappUrl: string; // Direct https://wa.me/919845012345?text=...
  address: string;
  locality?: string;
  city: string;
  state?: string;
  country: string;
  website?: string;
  googleProfileUrl?: string; // Google Business Profile or Google Maps URL
  linkedinUrl?: string; // LinkedIn Company or Clinic page
  email?: string; // Publicly listed contact email
  rating?: string; // e.g. "4.8 ★ (1,240 reviews)" or "4.5/5"
  operatingHours?: string; // e.g. "Mon-Sat 9 AM - 8 PM" or "Open 24/7"
  sourceEvidence?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceType?: 'google_business' | 'official_website' | 'linkedin' | 'directory_listing' | 'live_web';
  confidence: 'high' | 'medium' | 'low';
  isMobile: boolean;
  notes?: string;
  discoveredAt: string;

  // Enriched B2B Lead Intelligence Fields
  branchInfo?: BranchInfo;
  decisionMakers?: B2BDecisionMaker[];
  phones?: ContactPhone[];
  scores?: {
    companyFitScore: number;
    contactQualityScore: number;
    totalScore: number;
    fitReasons?: string[];
    qualityReasons?: string[];
  };
}

export interface SearchCoverageStats {
  zonesAttempted: string[];
  zonesCompleted: string[];
  sourcesQueried: string[];
  totalDiscovered: number;
  uniqueBusinesses: number;
  duplicatesRemoved: number;
  remainingCoverageNote: string;
}

export interface WhatsAppSearchParams {
  keywords: string;
  industry?: string;
  location: string;
  city?: string;
  state?: string;
  countryCode?: string; // e.g. '+91', '+1', '+971', '+44'
  localities?: string[];
  limit?: number; // Target limit (e.g. 25, 50, 100, 200)
  messageTemplate?: string;
  includeDecisionMakers?: boolean;
  deepEnrichment?: boolean;
}

export interface WhatsAppSearchRun {
  id: string;
  keywords: string;
  industry?: string;
  location: string;
  city?: string;
  countryCode: string;
  requestedLimit: number;
  actualDiscoveredCount: number;
  messageTemplate?: string;
  stats: {
    totalFound: number;
    uniqueCompanies: number;
    duplicatesRemoved: number;
    decisionMakersFound: number;
    mobileVerified: number;
    whatsappConfirmed: number;
    withGoogleProfile: number;
    withLinkedIn: number;
    withWebsite: number;
    professionalEmailsFound: number;
    highConfidence: number;
  };
  coverage?: SearchCoverageStats;
  leads: WhatsAppLead[];
  decisionMakers?: B2BDecisionMaker[];
  companies?: CompanyLead[];
  createdAt: string;
}

