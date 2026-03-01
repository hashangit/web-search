/**
 * Relevance Scoring Algorithm
 *
 * Uses a weighted combination of:
 * - 30% exact phrase matching
 * - 40% keyword frequency
 * - 30% TF-IDF cosine similarity
 */

export interface RelevanceResult {
  score: number;        // 0-1
  reasoning: string;
  matchedPhrases: string[];
  matchedKeywords: string[];
}

/**
 * Calculate relevance score between page content and focus topics
 */
export function calculateRelevanceScore(
  pageContent: string,
  focusTopics: string[]
): RelevanceResult {
  if (!pageContent || focusTopics.length === 0) {
    return {
      score: 0,
      reasoning: 'No content or topics to compare',
      matchedPhrases: [],
      matchedKeywords: [],
    };
  }

  const normalizedContent = pageContent.toLowerCase();
  const normalizedTopics = focusTopics.map(t => t.toLowerCase());

  // 1. Exact phrase matching (30% weight)
  const phraseResult = calculatePhraseMatching(normalizedContent, normalizedTopics);

  // 2. Keyword frequency (40% weight)
  const keywordResult = calculateKeywordFrequency(normalizedContent, normalizedTopics);

  // 3. TF-IDF cosine similarity (30% weight)
  const tfidfScore = calculateTFIDFSimilarity(normalizedContent, normalizedTopics);

  // Combine scores with weights
  const score = Math.min(
    (phraseResult.score * 0.3) + (keywordResult.score * 0.4) + (tfidfScore * 0.3),
    1.0
  );

  // Generate reasoning
  const reasoning = generateReasoning(
    phraseResult,
    keywordResult,
    tfidfScore,
    focusTopics.length
  );

  return {
    score,
    reasoning,
    matchedPhrases: phraseResult.matched,
    matchedKeywords: keywordResult.matched,
  };
}

/**
 * Calculate exact phrase matching score
 */
function calculatePhraseMatching(
  content: string,
  topics: string[]
): { score: number; matched: string[] } {
  const matched: string[] = [];

  for (const topic of topics) {
    if (content.includes(topic)) {
      matched.push(topic);
    }
  }

  return {
    score: topics.length > 0 ? matched.length / topics.length : 0,
    matched,
  };
}

/**
 * Calculate keyword frequency score
 */
function calculateKeywordFrequency(
  content: string,
  topics: string[]
): { score: number; matched: string[] } {
  // Extract keywords from topics (split by spaces, filter short words)
  const keywords = topics
    .flatMap(t => t.split(/\s+/))
    .filter(kw => kw.length > 2);

  if (keywords.length === 0) {
    return { score: 0, matched: [] };
  }

  const matched: string[] = [];
  const contentWords = content.split(/\s+/);

  for (const keyword of keywords) {
    const count = contentWords.filter(w => w.includes(keyword)).length;
    if (count > 0) {
      matched.push(keyword);
    }
  }

  return {
    score: matched.length / keywords.length,
    matched: [...new Set(matched)], // Dedupe
  };
}

/**
 * Calculate TF-IDF cosine similarity
 */
function calculateTFIDFSimilarity(content: string, topics: string[]): number {
  // Build document from topics
  const topicDoc = topics.join(' ');

  // Tokenize
  const contentTokens = tokenize(content);
  const topicTokens = tokenize(topicDoc);

  // Get all unique terms
  const allTerms = new Set([...contentTokens, ...topicTokens]);

  // Calculate TF vectors
  const contentTf = calculateTF(contentTokens);
  const topicTf = calculateTF(topicTokens);

  // Calculate IDF (simplified - just based on these two documents)
  const idf: Map<string, number> = new Map();
  for (const term of allTerms) {
    const docCount = (contentTf.has(term) ? 1 : 0) + (topicTf.has(term) ? 1 : 0);
    idf.set(term, Math.log(2 / docCount + 1));
  }

  // Calculate TF-IDF vectors
  const contentVector: number[] = [];
  const topicVector: number[] = [];

  for (const term of allTerms) {
    const tfidf = (tf: Map<string, number>) => (tf.get(term) || 0) * (idf.get(term) || 0);
    contentVector.push(tfidf(contentTf));
    topicVector.push(tfidf(topicTf));
  }

  // Calculate cosine similarity
  return cosineSimilarity(contentVector, topicVector);
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/**
 * Calculate term frequency
 */
function calculateTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const total = tokens.length;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize by total tokens
  for (const [term, count] of tf) {
    tf.set(term, count / total);
  }

  return tf;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Generate human-readable reasoning for the score
 */
function generateReasoning(
  phraseResult: { score: number; matched: string[] },
  keywordResult: { score: number; matched: string[] },
  tfidfScore: number,
  totalTopics: number
): string {
  const parts: string[] = [];

  if (phraseResult.matched.length > 0) {
    parts.push(`matched ${phraseResult.matched.length}/${totalTopics} topics exactly`);
  }

  if (keywordResult.matched.length > 0) {
    const sample = keywordResult.matched.slice(0, 3).join(', ');
    const more = keywordResult.matched.length > 3 ? ` and ${keywordResult.matched.length - 3} more` : '';
    parts.push(`found keywords: ${sample}${more}`);
  }

  if (tfidfScore > 0.5) {
    parts.push('high semantic similarity');
  } else if (tfidfScore > 0.2) {
    parts.push('moderate semantic similarity');
  }

  if (parts.length === 0) {
    return 'low relevance to focus topics';
  }

  return parts.join('; ');
}

/**
 * Quick relevance check using just title and first N characters
 * Used for filtering search results before full extraction
 */
export function quickRelevanceCheck(
  title: string,
  snippet: string,
  focusTopics: string[],
  threshold: number = 0.3
): boolean {
  const content = `${title} ${snippet}`.toLowerCase();
  const topics = focusTopics.map(t => t.toLowerCase());

  // Simple check: does content contain any topic or significant keywords?
  let matchCount = 0;

  for (const topic of topics) {
    if (content.includes(topic)) {
      matchCount += 2; // Exact match is strong signal
    } else {
      // Check for partial keyword matches
      const keywords = topic.split(/\s+/).filter(k => k.length > 3);
      for (const kw of keywords) {
        if (content.includes(kw)) {
          matchCount += 0.5;
        }
      }
    }
  }

  return matchCount >= threshold * 2;
}
