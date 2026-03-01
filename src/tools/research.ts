import { performEnhancedSearch, type EnhancedSearchOptions } from '../search.js';
import { extractFromUrls, type ExtractorOptions } from '../content/extractor.js';
import { calculateRelevanceScore, quickRelevanceCheck } from '../content/relevance.js';
import { extractKeyFacts, summarizeFacts } from '../content/facts.js';
import {
  type ResearchInput,
  type ResearchResponse,
  type ResearchFinding,
  type ResearchAnalysisSummary,
  type KeyFact,
  validateTimeout,
} from '../utils.js';
import { getSessionManager } from '../session-manager.js';
import type { BrowserConfig } from '../core/browser.js';

/**
 * Perform automated research on a topic
 */
export async function performResearch(input: ResearchInput): Promise<ResearchResponse> {
  const startTime = Date.now();
  const {
    query,
    focus_topics,
    max_pages = 10,
    search_limit = 15,
    timeout_ms,
    device,
    relevance_threshold = 0.5,
    extract_facts = true,
    follow_links = true,
    max_depth = 1,
    session_id,
  } = input;

  const timeout = validateTimeout(timeout_ms);

  // Validate focus topics
  if (!focus_topics || focus_topics.length === 0) {
    throw new Error('At least one focus topic is required');
  }

  if (focus_topics.length > 10) {
    throw new Error('Maximum 10 focus topics allowed');
  }

  // Get or create session
  const sessionManager = getSessionManager();
  let sessionId = session_id;
  let session;

  if (sessionId) {
    session = await sessionManager.getSession(sessionId);
    if (!session) {
      sessionId = await sessionManager.createSession({ device });
      session = await sessionManager.getSession(sessionId);
    }
  } else {
    const result = await sessionManager.reuseOrCreate({ device });
    sessionId = result.sessionId;
    session = result.session;
  }

  const browserConfig: BrowserConfig = {
    sessionId,
    device,
  };

  // Step 1: Perform search
  const searchOptions: EnhancedSearchOptions = {
    query,
    limit: search_limit,
    timeout_ms: timeout,
    device,
    session_id: sessionId,
  };

  const searchResponse = await performEnhancedSearch(searchOptions);

  // Step 2: Quick-filter results by relevance
  const candidateUrls: { url: string; title: string; description: string }[] = [];

  for (const result of searchResponse.results) {
    const isRelevant = quickRelevanceCheck(
      result.title,
      result.description,
      focus_topics,
      relevance_threshold * 0.5 // Use lower threshold for initial filtering
    );

    if (isRelevant) {
      candidateUrls.push(result);
    }
  }

  // Step 3: Extract content from relevant URLs
  const findings: ResearchFinding[] = [];
  const urlsToExtract = candidateUrls.slice(0, max_pages).map(u => u.url);

  if (urlsToExtract.length === 0) {
    return {
      query,
      focus_topics,
      findings: [],
      analysis_summary: {
        total_pages_analyzed: 0,
        pages_skipped: searchResponse.results.length,
        avg_relevance_score: 0,
        top_topics_found: [],
        research_time_ms: Date.now() - startTime,
      },
      search_source: searchResponse.source,
    };
  }

  const extractorOptions: Omit<ExtractorOptions, 'url'> = {
    formats: ['article', 'markdown'],
    extractArticle: true,
    timeoutMs: timeout,
    includeMetadata: true,
    config: browserConfig,
  };

  const extractResults = await extractFromUrls(urlsToExtract, extractorOptions);

  // Step 4: Score relevance and extract facts
  for (const result of extractResults) {
    if (result.status !== 'success') {
      continue;
    }

    const content = result.formats.article_markdown || result.formats.markdown || '';
    if (!content) {
      continue;
    }

    // Calculate relevance score
    const relevanceResult = calculateRelevanceScore(content, focus_topics);

    // Skip if below threshold
    if (relevanceResult.score < relevance_threshold) {
      continue;
    }

    // Extract key facts if requested
    let keyFacts: KeyFact[] = [];
    if (extract_facts && content) {
      keyFacts = extractKeyFacts(content);
    }

    // Generate summary
    const summary = generateSummary(content, keyFacts);

    findings.push({
      url: result.url,
      title: result.title,
      relevance_score: relevanceResult.score,
      relevance_reasoning: relevanceResult.reasoning,
      key_facts: keyFacts,
      summary,
      markdown: content,
    });
  }

  // Step 5: Follow links if enabled (simplified - just extracts from linked pages)
  const additionalUrls: string[] = [];
  if (follow_links && max_depth > 0) {
    // Extract links from findings and add to queue
    for (const finding of findings.slice(0, 3)) { // Only follow from top 3 pages
      const links = extractLinks(finding.markdown, finding.url);
      additionalUrls.push(...links.slice(0, 3)); // Max 3 links per page
    }
  }

  // Extract from additional URLs
  if (additionalUrls.length > 0 && findings.length < max_pages) {
    const remainingSlots = max_pages - findings.length;
    const additionalResults = await extractFromUrls(
      additionalUrls.slice(0, remainingSlots),
      extractorOptions
    );

    for (const result of additionalResults) {
      if (result.status !== 'success') continue;

      const content = result.formats.article_markdown || result.formats.markdown || '';
      if (!content) continue;

      const relevanceResult = calculateRelevanceScore(content, focus_topics);
      if (relevanceResult.score < relevance_threshold) continue;

      let keyFacts: KeyFact[] = [];
      if (extract_facts && content) {
        keyFacts = extractKeyFacts(content);
      }

      const summary = generateSummary(content, keyFacts);

      findings.push({
        url: result.url,
        title: result.title,
        relevance_score: relevanceResult.score,
        relevance_reasoning: relevanceResult.reasoning,
        key_facts: keyFacts,
        summary,
        markdown: content,
      });
    }
  }

  // Step 6: Sort findings by relevance and limit
  findings.sort((a, b) => b.relevance_score - a.relevance_score);
  const limitedFindings = findings.slice(0, max_pages);

  // Step 7: Generate analysis summary
  const analysisSummary: ResearchAnalysisSummary = {
    total_pages_analyzed: limitedFindings.length,
    pages_skipped: searchResponse.results.length - limitedFindings.length,
    avg_relevance_score: limitedFindings.length > 0
      ? limitedFindings.reduce((sum, f) => sum + f.relevance_score, 0) / limitedFindings.length
      : 0,
    top_topics_found: extractTopTopics(limitedFindings, focus_topics),
    research_time_ms: Date.now() - startTime,
  };

  return {
    query,
    focus_topics,
    findings: limitedFindings,
    analysis_summary: analysisSummary,
    search_source: searchResponse.source,
  };
}

/**
 * Generate a summary from content and facts
 */
function generateSummary(content: string, facts: KeyFact[]): string {
  // Get first 200 chars of content
  const contentPreview = content.slice(0, 200).trim();

  // Get fact summary
  const factSummary = summarizeFacts(facts);

  if (factSummary !== 'No key facts extracted') {
    return `${contentPreview}...\n\nKey facts: ${factSummary}`;
  }

  return contentPreview + '...';
}

/**
 * Extract links from markdown content
 */
function extractLinks(markdown: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  let match = linkRegex.exec(markdown);
  while (match !== null) {
    const url = match[2];

    // Only include http/https links
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Skip common non-content URLs
      const skipPatterns = [
        'twitter.com',
        'x.com',
        'facebook.com',
        'linkedin.com',
        'instagram.com',
        'youtube.com',
        '.pdf',
        '.zip',
        '.png',
        '.jpg',
        '.gif',
      ];

      const shouldSkip = skipPatterns.some(p => url.toLowerCase().includes(p));
      if (!shouldSkip && url !== baseUrl) {
        links.push(url);
      }
    }

    match = linkRegex.exec(markdown);
  }

  // Dedupe
  return [...new Set(links)];
}

/**
 * Extract top topics from findings
 */
function extractTopTopics(findings: ResearchFinding[], focusTopics: string[]): string[] {
  const topicCounts: Map<string, number> = new Map();

  // Initialize with focus topics
  for (const topic of focusTopics) {
    topicCounts.set(topic.toLowerCase(), 0);
  }

  // Count occurrences in findings
  for (const finding of findings) {
    const content = finding.markdown.toLowerCase();

    for (const topic of focusTopics) {
      const lowerTopic = topic.toLowerCase();
      const regex = new RegExp(lowerTopic, 'g');
      const matches = content.match(regex);
      const count = matches ? matches.length : 0;
      topicCounts.set(lowerTopic, (topicCounts.get(lowerTopic) || 0) + count);
    }
  }

  // Sort by count and return top topics
  return [...topicCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}
