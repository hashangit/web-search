import { runAgentBrowser, parseOutput, type BrowserConfig } from '../browser.js';
import {
  type ExtractResult,
  type ExtractFormat,
  type ExtractMetadata,
  validateUrl,
  validateTimeout,
  calculateReadingTime,
} from '../utils.js';
import { extractArticle, type ArticleResult } from './article.js';

export interface ExtractorOptions {
  url: string;
  formats: ('markdown' | 'html' | 'article' | 'screenshot' | 'pdf')[];
  extractArticle: boolean;
  timeoutMs: number;
  waitForSelector?: string;
  waitForTimeout?: number;
  screenshotOptions?: {
    fullPage?: boolean;
    width?: number;
    height?: number;
  };
  includeMetadata: boolean;
  config: BrowserConfig;
}

/**
 * Fetch page content and extract in multiple formats
 */
export async function extractFromUrl(options: ExtractorOptions): Promise<ExtractResult> {
  const startTime = Date.now();
  const {
    url,
    formats,
    extractArticle: shouldExtractArticle,
    timeoutMs,
    waitForSelector,
    waitForTimeout,
    screenshotOptions,
    includeMetadata,
    config,
  } = options;

  // Validate URL
  if (!validateUrl(url)) {
    return {
      url,
      title: '',
      status: 'error',
      formats: {},
      error: 'Invalid URL. Only http:// and https:// are allowed.',
      extraction_time_ms: Date.now() - startTime,
    };
  }

  try {
    // Navigate to URL
    await runAgentBrowser(['open', url], timeoutMs, config);

    // Wait for selector if specified
    if (waitForSelector) {
    await runAgentBrowser(['wait', waitForSelector], timeoutMs, config);
  } else if (waitForTimeout) {
    await runAgentBrowser(['wait', waitForTimeout.toString()], timeoutMs, config);
  }

    // Collect results
    const result: ExtractResult = {
      url,
      title: '',
      status: 'success',
      formats: {},
      extraction_time_ms: 0,
    };

    let articleResult: ArticleResult | null = null;

    // Get HTML content first (needed for article extraction)
    let htmlContent = '';
    if (formats.includes('html') || (shouldExtractArticle && formats.includes('article'))) {
      try {
        const evalResult = await runAgentBrowser(
          ['eval', 'document.documentElement.outerHTML'],
          timeoutMs,
          config
        );
        htmlContent = evalResult.trim();
        // Remove quotes if wrapped
        if (htmlContent.startsWith('"') && htmlContent.endsWith('"')) {
          htmlContent = JSON.parse(htmlContent);
        }
      } catch {
        // HTML extraction failed
      }
    }

    // Get page title
    try {
      const titleResult = await runAgentBrowser(
        ['eval', 'document.title'],
        timeoutMs,
        config
      );
      result.title = titleResult.trim().replace(/^"|"$/g, '');
    } catch {
      result.title = url;
    }

    // Extract HTML format
    if (formats.includes('html')) {
      result.formats.html = htmlContent;
    }

    // Extract article (readability)
    if (shouldExtractArticle && formats.includes('article') && htmlContent) {
      try {
        articleResult = extractArticle(htmlContent, url);
        result.formats.article_markdown = articleResult.markdown;
        result.title = articleResult.title || result.title;

        if (includeMetadata && articleResult.metadata) {
          result.metadata = {
            author: articleResult.metadata.author,
            publish_date: articleResult.metadata.publish_date,
            word_count: articleResult.metadata.word_count,
            reading_time_minutes: articleResult.metadata.reading_time_minutes,
          };
        }
      } catch {
        // Article extraction failed
      }
    }

    // Extract markdown (using snapshot)
    if (formats.includes('markdown')) {
      try {
        const snapshotJson = await runAgentBrowser(['snapshot', '--json'], timeoutMs, config);
        const snapshot = parseOutput(snapshotJson);

        if (typeof snapshot === 'object' && snapshot !== null) {
          const data = snapshot as { data?: { snapshot?: string } };
          if (data.data?.snapshot) {
            result.formats.markdown = snapshotToMarkdown(data.data.snapshot);
          }
        }
      } catch {
        // Markdown extraction failed
      }
    }

    // Take screenshot
    if (formats.includes('screenshot')) {
      try {
        const screenshotArgs = ['screenshot'];
        if (screenshotOptions?.fullPage) {
          screenshotArgs.push('--full');
        }

        const screenshotOutput = await runAgentBrowser(screenshotArgs, timeoutMs, config);
        // Output is base64 encoded image
        result.formats.screenshot_base64 = screenshotOutput.trim();
      } catch {
        // Screenshot failed
      }
    }

    // Generate PDF
    if (formats.includes('pdf')) {
      try {
        // Use eval to get PDF as base64
        // Note: agent-browser pdf command saves to file, so we use a different approach
        // For now, we'll skip PDF in the initial implementation
        // PDF can be added later using playwright's page.pdf() via eval
      } catch {
        // PDF generation failed
      }
    }

    result.extraction_time_ms = Date.now() - startTime;
    return result;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('timeout');

    return {
      url,
      title: '',
      status: isTimeout ? 'timeout' : 'error',
      formats: {},
      error: message,
      extraction_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Convert accessibility snapshot to markdown
 */
function snapshotToMarkdown(snapshot: string): string {
  const lines = snapshot.split('\n');
  const markdownLines: string[] = [];

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Convert tree structure to readable markdown
    // The snapshot format is like: "tree" or "button" or "link" etc.
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const level = Math.floor(indent / 2) + 1;

    // Extract text content
    const textMatch = line.match(/- text: (.+)$/);
    if (textMatch) {
      markdownLines.push(textMatch[1]);
      continue;
    }

    // Extract links
    const linkMatch = line.match(/link "([^"]+)"/);
    if (linkMatch) {
      markdownLines.push(`[${linkMatch[1]}]`);
      continue;
    }

    // Extract headings
    const headingMatch = line.match(/heading.*?"([^"]+)".*?\[level=(\d)\]/);
    if (headingMatch) {
      const levelNum = parseInt(headingMatch[2], 10);
      const prefix = '#'.repeat(Math.min(levelNum, 6));
      markdownLines.push(`${prefix} ${headingMatch[1]}`);
      continue;
    }

    // Extract buttons
    const buttonMatch = line.match(/button.*?"([^"]+)"/);
    if (buttonMatch) {
      markdownLines.push(`[Button: ${buttonMatch[1]}]`);
      continue;
    }
  }

  return markdownLines.join('\n');
}

/**
 * Extract content from multiple URLs in parallel
 */
export async function extractFromUrls(
  urls: string[],
  options: Omit<ExtractorOptions, 'url'>
): Promise<ExtractResult[]> {
  // Process URLs in parallel with Promise.all
  const results = await Promise.all(
    urls.map(url => extractFromUrl({ ...options, url }))
  );

  return results;
}
