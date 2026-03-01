import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { calculateReadingTime } from '../utils.js';

export interface ArticleMetadata {
  author?: string;
  publish_date?: string;
  word_count: number;
  reading_time_minutes: number;
}

export interface ArticleResult {
  title: string;
  content: string;      // Clean HTML
  textContent: string;  // Plain text
  markdown: string;     // Markdown conversion
  metadata: ArticleMetadata;
}

/**
 * Extract main article content from HTML using Readability
 */
export function extractArticle(html: string, url: string): ArticleResult {
  // Create a JSDOM instance
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Apply Readability
  const reader = new Readability(doc, {
    debug: false,
    maxElemsToParse: 0, // No limit
    nbTopCandidates: 5,
    charThreshold: 500,
  });

  const article = reader.parse();

  if (!article) {
    throw new Error('Failed to extract article content. Page may not be an article.');
  }

  // Extract text content
  const textContent = article.textContent || '';

  // Convert HTML content to markdown
  const markdown = htmlToMarkdown(article.content || '');

  // Calculate word count
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  // Extract metadata
  const metadata: ArticleMetadata = {
    author: article.byline || undefined,
    publish_date: article.publishedTime || undefined,
    word_count: wordCount,
    reading_time_minutes: calculateReadingTime(wordCount),
  };

  return {
    title: article.title || '',
    content: article.content || '',
    textContent,
    markdown,
    metadata,
  };
}

/**
 * Simple HTML to Markdown converter
 * Handles common HTML elements for article content
 */
function htmlToMarkdown(html: string): string {
  let markdown = html;

  // Remove script and style tags
  markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Headers
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');

  // Paragraphs
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');

  // Links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Bold
  markdown = markdown.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$1**');

  // Italic
  markdown = markdown.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$1*');

  // Code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match: string, content: string) => {
    const lines = content.trim().split('\n');
    return lines.map((line: string) => `> ${line}`).join('\n') + '\n\n';
  });

  // Lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
  markdown = markdown.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n\n');

  // Images
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Divs and spans - just extract content
  markdown = markdown.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');
  markdown = markdown.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = decodeHtmlEntities(markdown);

  // Clean up whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.replace(/[ \t]+/g, ' ');
  markdown = markdown.trim();

  return markdown;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }

  // Decode numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return result;
}
