import type { KeyFact } from '../utils.js';

/**
 * Extract key facts from markdown content
 *
 * Looks for:
 * - Dates (YYYY-MM-DD, Month DD, YYYY, etc.)
 * - Statistics (X%, $X, X billion/million)
 * - Quotes with attribution
 * - Definitions ("X is Y", "X means Y")
 */
export function extractKeyFacts(markdown: string): KeyFact[] {
  const facts: KeyFact[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Skip empty lines and headers
    if (!line.trim() || line.startsWith('#')) continue;

    // Extract dates
    const dateFacts = extractDates(line);
    facts.push(...dateFacts);

    // Extract statistics
    const statFacts = extractStatistics(line);
    facts.push(...statFacts);

    // Extract quotes
    const quoteFacts = extractQuotes(line);
    facts.push(...quoteFacts);

    // Extract definitions
    const defFacts = extractDefinitions(line);
    facts.push(...defFacts);
  }

  // Sort by confidence and return top 10
  return facts
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

/**
 * Extract dates from text
 */
function extractDates(text: string): KeyFact[] {
  const facts: KeyFact[] = [];

  // YYYY-MM-DD
  const isoDateRegex = /\b(\d{4}-\d{2}-\d{2})\b/g;
  let match = isoDateRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'date',
      fact: match[1],
      context: getContext(text, match.index),
      confidence: 0.9,
    });
    match = isoDateRegex.exec(text);
  }

  // Month DD, YYYY (e.g., "January 15, 2024")
  const monthDateRegex = /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;
  match = monthDateRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'date',
      fact: match[1],
      context: getContext(text, match.index),
      confidence: 0.85,
    });
    match = monthDateRegex.exec(text);
  }

  // DD Month YYYY (e.g., "15 January 2024")
  const dayMonthRegex = /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
  match = dayMonthRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'date',
      fact: match[1],
      context: getContext(text, match.index),
      confidence: 0.85,
    });
    match = dayMonthRegex.exec(text);
  }

  // Year ranges (e.g., "2023-2024")
  const yearRangeRegex = /\b(\d{4}\s*[-–]\s*\d{4})\b/g;
  match = yearRangeRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'date',
      fact: match[1],
      context: getContext(text, match.index),
      confidence: 0.7,
    });
    match = yearRangeRegex.exec(text);
  }

  return facts;
}

/**
 * Extract statistics from text
 */
function extractStatistics(text: string): KeyFact[] {
  const facts: KeyFact[] = [];

  // Percentages (e.g., "45%", "45.5%")
  const percentRegex = /\b(\d+(?:\.\d+)?%)\b/g;
  let match = percentRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'statistic',
      fact: match[1],
      context: getContext(text, match.index),
      confidence: 0.8,
    });
    match = percentRegex.exec(text);
  }

  // Currency amounts (e.g., "$1.5 billion", "$500 million", "$1,234")
  const currencyRegex = /\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|trillion|thousand|k|m|b)?\b/gi;
  match = currencyRegex.exec(text);
  while (match !== null) {
    const amount = match[2]
      ? `$${match[1]} ${match[2]}`
      : `$${match[1]}`;
    facts.push({
      type: 'statistic',
      fact: amount,
      context: getContext(text, match.index),
      confidence: 0.85,
    });
    match = currencyRegex.exec(text);
  }

  // Large numbers with units (e.g., "1.5 billion", "500 million")
  const numberUnitRegex = /\b(\d+(?:\.\d+)?)\s*(billion|million|trillion|thousand)\b/gi;
  match = numberUnitRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'statistic',
      fact: `${match[1]} ${match[2]}`,
      context: getContext(text, match.index),
      confidence: 0.75,
    });
    match = numberUnitRegex.exec(text);
  }

  // Ratios (e.g., "3 out of 5", "2:1")
  const ratioRegex = /\b(\d+\s+out\s+of\s+\d+)\b|\b(\d+:\d+)\b/gi;
  match = ratioRegex.exec(text);
  while (match !== null) {
    facts.push({
      type: 'statistic',
      fact: match[1] || match[2],
      context: getContext(text, match.index),
      confidence: 0.7,
    });
    match = ratioRegex.exec(text);
  }

  return facts;
}

/**
 * Extract quotes with attribution
 */
function extractQuotes(text: string): KeyFact[] {
  const facts: KeyFact[] = [];

  // Quoted text with potential attribution
  // Matches: "quote" or "quote" - Author or "quote," said Author
  const quoteRegex = /"([^"]{10,200})"(?:\s*[,—–-]\s*([A-Z][a-zA-Z\s]+))?(?:\s+(?:said|says|stated|wrote|noted))?\s*([A-Z][a-zA-Z\s]+)?/g;
  let match = quoteRegex.exec(text);
  while (match !== null) {
    const quote = match[1];
    const attribution = match[2] || match[3];

    if (quote && quote.split(' ').length >= 3) { // At least 3 words
      facts.push({
        type: 'quote',
        fact: attribution ? `"${quote}" — ${attribution.trim()}` : `"${quote}"`,
        context: getContext(text, match.index),
        confidence: attribution ? 0.9 : 0.7,
      });
    }
    match = quoteRegex.exec(text);
  }

  return facts;
}

/**
 * Extract definitions
 */
function extractDefinitions(text: string): KeyFact[] {
  const facts: KeyFact[] = [];

  // "X is Y" or "X are Y" patterns
  const isRegex = /\b([A-Z][a-zA-Z\s]{2,30})\s+(?:is|are)\s+([^.]{10,100})/g;
  let match = isRegex.exec(text);
  while (match !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();

    // Skip if term looks like a sentence start
    if (!term.includes(' ') && term.length < 30) {
      facts.push({
        type: 'definition',
        fact: `${term} is ${definition}`,
        context: getContext(text, match.index),
        confidence: 0.75,
      });
    }
    match = isRegex.exec(text);
  }

  // "X means Y" pattern
  const meansRegex = /\b([A-Z][a-zA-Z\s]{2,30})\s+means\s+([^.]{10,100})/gi;
  match = meansRegex.exec(text);
  while (match !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();

    facts.push({
      type: 'definition',
      fact: `${term} means ${definition}`,
      context: getContext(text, match.index),
      confidence: 0.8,
    });
    match = meansRegex.exec(text);
  }

  // "X refers to Y" pattern
  const refersRegex = /\b([A-Z][a-zA-Z\s]{2,30})\s+refers\s+to\s+([^.]{10,100})/gi;
  match = refersRegex.exec(text);
  while (match !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();

    facts.push({
      type: 'definition',
      fact: `${term} refers to ${definition}`,
      context: getContext(text, match.index),
      confidence: 0.75,
    });
    match = refersRegex.exec(text);
  }

  return facts;
}

/**
 * Get context around a match (50 chars before and after)
 */
function getContext(text: string, index: number): string {
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + 50);
  let context = text.slice(start, end);

  // Add ellipsis if truncated
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.trim();
}

/**
 * Generate a summary from facts
 */
export function summarizeFacts(facts: KeyFact[]): string {
  if (facts.length === 0) {
    return 'No key facts extracted';
  }

  const byType: Record<string, string[]> = {
    date: [],
    statistic: [],
    quote: [],
    definition: [],
  };

  for (const fact of facts) {
    byType[fact.type].push(fact.fact);
  }

  const parts: string[] = [];

  if (byType.date.length > 0) {
    parts.push(`Dates: ${byType.date.slice(0, 3).join(', ')}`);
  }
  if (byType.statistic.length > 0) {
    parts.push(`Stats: ${byType.statistic.slice(0, 3).join(', ')}`);
  }
  if (byType.quote.length > 0) {
    parts.push(`Quotes: ${byType.quote.length} found`);
  }
  if (byType.definition.length > 0) {
    parts.push(`Definitions: ${byType.definition.length} found`);
  }

  return parts.join(' | ');
}
