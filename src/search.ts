import { runAgentBrowser, ensureAgentBrowser, parseOutput } from './browser.js';
import { type SearchResult, type SearchResponse } from './utils.js';
import { searchWithTavily } from './tavily.js';

let browserReady = false;

// Time to wait for user to complete CAPTCHA (in ms)
const CAPTCHA_WAIT_MS = 30000; // 30 seconds

// Check for Tavily API key in environment
function getTavilyApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildGoogleSearchUrl(query: string, limit: number): string {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('num', limit.toString());
  return url.toString();
}

function buildDuckDuckGoSearchUrl(query: string): string {
  const url = new URL('https://duckduckgo.com/');
  url.searchParams.set('q', query);
  url.searchParams.set('ia', 'web');
  return url.toString();
}

interface ParsedResult {
  title: string;
  url: string;
  description: string;
}

function parseSnapshotText(snapshotText: string, limit: number): ParsedResult[] {
  const results: ParsedResult[] = [];
  const lines = snapshotText.split('\n');

  let currentTitle = '';
  let currentUrl = '';
  let pendingDescription = '';

  // URLs to filter out (search engine internal links)
  const blockedPatterns = [
    'duckduckgo.com',
    'google.com/search',
    'google.com/webhp',
    'google.com/imgres',
    'googleadservices.com',
    'support.google.com',
    'accounts.google.com',
    'twitter.com/',
    'x.com/',
  ];

  function isBlockedUrl(url: string): boolean {
    return blockedPatterns.some(pattern => url.includes(pattern));
  }

  for (let i = 0; i < lines.length && results.length < limit; i++) {
    const line = lines[i];

    // Look for link with URL pattern: link "title" [ref=eX]:
    const linkMatch = line.match(/link "([^"]+)" \[ref=e\d+\]:/);
    if (linkMatch) {
      // Check next line for URL
      const nextLine = lines[i + 1] || '';
      const urlMatch = nextLine.match(/\/url: (https?:\/\/[^\s]+)/);

      if (urlMatch) {
        const url = urlMatch[1];

        // Filter out internal search engine links
        if (!isBlockedUrl(url)) {

          // If we have a pending result, save it
          if (currentTitle && currentUrl) {
            results.push({
              title: currentTitle,
              url: currentUrl,
              description: pendingDescription.trim(),
            });
          }

          currentTitle = linkMatch[1];
          currentUrl = url;
          pendingDescription = '';
        }
      }
    }

    // Look for text content that could be descriptions
    const textMatch = line.match(/^(\s*)- text: (.+)$/);
    if (textMatch && currentTitle && currentUrl) {
      const text = textMatch[2];
      // Descriptions are usually longer and not UI text
      if (text.length > 40 && !text.includes('Upgrade to') && !text.includes('Try the')) {
        pendingDescription += (pendingDescription ? ' ' : '') + text;
      }
    }
  }

  // Don't forget the last result
  if (currentTitle && currentUrl && results.length < limit) {
    results.push({
      title: currentTitle,
      url: currentUrl,
      description: pendingDescription.trim(),
    });
  }

  return results;
}

async function tryBrowserSearch(searchUrl: string, limit: number, waitForCaptcha: boolean = false): Promise<SearchResult[]> {
  try {
    await runAgentBrowser(['open', searchUrl]);

    // If this is Google, wait for potential CAPTCHA completion
    if (waitForCaptcha) {
      console.error('[web-search] Google may show CAPTCHA - waiting for completion...');
      await sleep(CAPTCHA_WAIT_MS);
    }

    const snapshotJson = await runAgentBrowser(['snapshot', '--json']);
    const snapshot = parseOutput(snapshotJson);

    if (typeof snapshot === 'object' && snapshot !== null) {
      const data = snapshot as { data?: { snapshot?: string } };
      if (data.data?.snapshot) {
        return parseSnapshotText(data.data.snapshot, limit);
      }
    }
    return [];
  } finally {
    try {
      await runAgentBrowser(['close']);
    } catch {
      // Ignore close errors
    }
  }
}

export async function performSearch(query: string, limit: number): Promise<SearchResponse> {
  // Check/install agent-browser if needed
  if (!browserReady) {
    const ensureResult = await ensureAgentBrowser();
    if (!ensureResult.ready) {
      // Browser not available - go straight to Tavily if available
      const tavilyKey = getTavilyApiKey();
      if (tavilyKey) {
        return searchWithTavily(query, limit, tavilyKey);
      }
      throw new Error(ensureResult.instructions);
    }
    browserReady = true;
  }

  let results: SearchResult[] = [];
  let source = 'google';

  // Tier 1: Try Google (with CAPTCHA wait time)
  try {
    const googleUrl = buildGoogleSearchUrl(query, limit);
    results = await tryBrowserSearch(googleUrl, limit, true); // Wait for CAPTCHA

    // Check if we got blocked (Google sorry page has no real results)
    if (results.length === 0) {
      results = []; // Will trigger fallback
    }
  } catch {
    results = [];
  }

  // Tier 2: Try DuckDuckGo if Google failed
  if (results.length === 0) {
    source = 'duckduckgo';
    try {
      const ddgUrl = buildDuckDuckGoSearchUrl(query);
      results = await tryBrowserSearch(ddgUrl, limit);
    } catch {
      results = [];
    }
  }

  // Tier 3: Fallback to Tavily API if browser search failed
  if (results.length === 0) {
    const tavilyKey = getTavilyApiKey();
    if (tavilyKey) {
      return searchWithTavily(query, limit, tavilyKey);
    }
  }

  return {
    results,
    source,
    query,
  };
}
