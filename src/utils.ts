import { spawn } from 'child_process';

export const MAX_QUERY_LENGTH = 500;
export const BROWSER_TIMEOUT_MS = 30000;
export const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
export const MIN_TIMEOUT_MS = 5000;
export const MAX_TIMEOUT_MS = 300000; // 5 minutes

// ============================================================================
// Search Tool Types
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export interface SearchResponse {
  results: SearchResult[];
  source: 'google' | 'duckduckgo' | 'tavily';
  query: string;
  session_id?: string;
  session_active?: boolean;
  search_time_ms?: number;
  captcha_encountered?: boolean;
  fallback_used?: boolean;
}

export interface SearchInput {
  query: string;
  limit?: number;
  timeout_ms?: number;
  device?: 'desktop' | 'mobile' | 'iphone' | 'android';
  proxy?: string;
  session_id?: string;
  source_preference?: 'auto' | 'google' | 'duckduckgo' | 'tavily';
}

// ============================================================================
// Extract Tool Types (Phase 2)
// ============================================================================

export interface ExtractFormat {
  markdown?: string;
  article_markdown?: string;
  html?: string;
  screenshot_base64?: string;
  pdf_base64?: string;
}

export interface ExtractMetadata {
  author?: string;
  publish_date?: string;
  word_count?: number;
  reading_time_minutes?: number;
}

export interface ExtractResult {
  url: string;
  title: string;
  status: 'success' | 'error' | 'timeout';
  formats: ExtractFormat;
  metadata?: ExtractMetadata;
  key_facts?: KeyFact[];
  error?: string;
  extraction_time_ms: number;
}

export interface ExtractInput {
  urls: string[];
  formats?: ('markdown' | 'html' | 'article' | 'screenshot' | 'pdf')[];
  extract_article?: boolean;
  timeout_ms?: number;
  wait_for_selector?: string;
  wait_for_timeout?: number;
  session_id?: string;
  screenshot_options?: {
    full_page?: boolean;
    width?: number;
    height?: number;
  };
  include_metadata?: boolean;
}

export interface ExtractResponse {
  results: ExtractResult[];
  session_id: string;
  total_time_ms: number;
  successful_count: number;
  failed_count: number;
}

// ============================================================================
// Research Tool Types (Phase 3)
// ============================================================================

export interface KeyFact {
  type: 'statistic' | 'date' | 'quote' | 'definition';
  fact: string;
  context: string;
  confidence: number;
}

export interface ResearchFinding {
  url: string;
  title: string;
  relevance_score: number;
  relevance_reasoning: string;
  key_facts: KeyFact[];
  summary: string;
  markdown: string;
}

export interface ResearchAnalysisSummary {
  total_pages_analyzed: number;
  pages_skipped: number;
  avg_relevance_score: number;
  top_topics_found: string[];
  research_time_ms: number;
}

export interface ResearchInput {
  query: string;
  focus_topics: string[];
  max_pages?: number;
  search_limit?: number;
  timeout_ms?: number;
  device?: 'desktop' | 'mobile' | 'iphone' | 'android';
  relevance_threshold?: number;
  extract_facts?: boolean;
  follow_links?: boolean;
  max_depth?: number;
  session_id?: string;
}

export interface ResearchResponse {
  query: string;
  focus_topics: string[];
  findings: ResearchFinding[];
  analysis_summary: ResearchAnalysisSummary;
  search_source: 'google' | 'duckduckgo' | 'tavily';
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationResult =
  | { valid: true; query: string; limit: number }
  | { valid: false; error: string };

export type EnsureResult =
  | { ready: true }
  | { ready: false; instructions: string };

// ============================================================================
// Validation Functions
// ============================================================================

export function validateInput(query: unknown, limit: unknown): ValidationResult {
  if (typeof query !== 'string' || query.length === 0) {
    return { valid: false, error: 'Query must be a non-empty string' };
  }
  // Sanitize control characters
  const sanitized = query.replace(/[\x00-\x1F\x7F]/g, '');
  if (sanitized.length === 0) {
    return { valid: false, error: 'Query contains only control characters' };
  }
  if (sanitized.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: `Query too long (max ${MAX_QUERY_LENGTH} chars)` };
  }
  const limitNum = typeof limit === 'number' ? Math.min(Math.max(1, limit), 10) : 5;
  return { valid: true, query: sanitized, limit: limitNum };
}

export function validateTimeout(timeout: unknown): number {
  if (typeof timeout !== 'number') {
    return BROWSER_TIMEOUT_MS;
  }
  return Math.min(Math.max(MIN_TIMEOUT_MS, timeout), MAX_TIMEOUT_MS);
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProxy(proxy: string): boolean {
  try {
    const parsed = new URL(proxy);
    // Only allow http and https proxies
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function buildSearchUrl(query: string, _limit: number): string {
  // Use DuckDuckGo - more friendly to automation
  const url = new URL('https://duckduckgo.com/');
  url.searchParams.set('q', query);
  url.searchParams.set('ia', 'web'); // Web results
  return url.toString();
}

export async function runCommand(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn(cmd, args);

    const cleanup = () => {
      clearTimeout(timer);
      proc.removeAllListeners();
    };

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      cleanup();
      reject(new Error(`Command timeout after ${timeout}ms`));
    }, timeout);

    proc.stdout.on('data', (data) => {
      if (!killed) stdout += data;
    });

    proc.stderr.on('data', (data) => {
      if (!killed) stderr += data;
    });

    proc.on('close', (code) => {
      if (killed) return;
      cleanup();
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed: ${stderr || `exit code ${code}`}`));
      }
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (killed) return;
      cleanup();
      if (err.code === 'ENOENT') {
        reject(new Error(`Command not found: ${cmd}. Please ensure it is installed.`));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Calculate reading time in minutes based on word count
 */
export function calculateReadingTime(wordCount: number): number {
  const wordsPerMinute = 200;
  return Math.ceil(wordCount / wordsPerMinute);
}
