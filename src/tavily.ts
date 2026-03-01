import type { SearchResult, SearchResponse } from './utils.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  query: string;
}

export async function searchWithTavily(query: string, limit: number, apiKey: string): Promise<SearchResponse> {
  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: Math.min(limit, 10),
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as TavilyResponse;

  return {
    results: data.results.slice(0, limit).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.content,
    })),
    source: 'tavily',
    query,
  };
}
