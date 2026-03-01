# MCP Full Protocol Compliance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the Web Search MCP Server to full MCP v2025-11-25 compliance with proper architecture, Resources, Prompts, and outputSchema.

**Architecture:** Restructure directories (tools/, core/, resources/, prompts/), add outputSchema to all tools, implement MCP Resources (server config, session status) and MCP Prompts (research templates), add _meta field support.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk v1.27.1, Node.js 18+

---

## Phase 1: Directory Restructuring

### Task 1: Create core/ directory structure

**Files:**
- Create: `src/core/index.ts`

**Step 1: Create core directory**

```bash
mkdir -p src/core
```

**Step 2: Create core/index.ts barrel export**

```typescript
// src/core/index.ts
export * from './browser.js';
export * from './session-manager.js';
export * from './cache.js';
export * from './errors.js';
```

**Step 3: Commit**

```bash
git add src/core/index.ts
git commit -m "feat(core): Create core directory structure"
```

---

### Task 2: Move browser.ts to core/

**Files:**
- Move: `src/browser.ts` → `src/core/browser.ts`
- Modify: `src/tools/extract.ts`, `src/tools/research.ts`, `src/content/extractor.ts`, `src/search.ts`

**Step 1: Move browser.ts**

```bash
mv src/browser.ts src/core/browser.ts
```

**Step 2: Update import in src/tools/extract.ts (line 9)**

Change:
```typescript
import type { BrowserConfig } from '../browser.js';
```
To:
```typescript
import type { BrowserConfig } from '../core/browser.js';
```

**Step 3: Update import in src/tools/research.ts (line 6)**

Change:
```typescript
import type { BrowserConfig } from '../browser.js';
```
To:
```typescript
import type { BrowserConfig } from '../core/browser.js';
```

**Step 4: Update import in src/content/extractor.ts (line 4)**

Change:
```typescript
import type { BrowserConfig } from '../browser.js';
```
To:
```typescript
import type { BrowserConfig } from '../core/browser.js';
```

**Step 5: Update import in src/search.ts (line 1)**

Change:
```typescript
import { runAgentBrowser, ensureAgentBrowser, parseOutput, type BrowserConfig } from './browser.js';
```
To:
```typescript
import { runAgentBrowser, ensureAgentBrowser, parseOutput, type BrowserConfig } from './core/browser.js';
```

**Step 6: Update import in src/index.ts (line 14)**

Change:
```typescript
import { destroySessionManager } from './session-manager.js';
```
To:
```typescript
import { destroySessionManager } from './core/session-manager.js';
```

**Step 7: Update import in src/index.ts (line 15)**

Change:
```typescript
import { destroyCaches } from './cache.js';
```
To:
```typescript
import { destroyCaches } from './core/cache.js';
```

**Step 8: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 9: Commit**

```bash
git add -A
git commit -m "refactor: Move browser.ts to core/"
```

---

### Task 3: Move session-manager.ts to core/

**Files:**
- Move: `src/session-manager.ts` → `src/core/session-manager.ts`
- Modify: `src/search.ts`, `src/tools/extract.ts`, `src/tools/research.ts`

**Step 1: Move session-manager.ts**

```bash
mv src/session-manager.ts src/core/session-manager.ts
```

**Step 2: Update import in src/search.ts (line 10)**

Change:
```typescript
import { getSessionManager, type BrowserSession } from './session-manager.js';
```
To:
```typescript
import { getSessionManager, type BrowserSession } from './core/session-manager.js';
```

**Step 3: Update import in src/tools/extract.ts (line 8)**

Change:
```typescript
import { getSessionManager } from '../session-manager.js';
```
To:
```typescript
import { getSessionManager } from '../core/session-manager.js';
```

**Step 4: Update import in src/tools/research.ts (line 7)**

Change:
```typescript
import { getSessionManager } from '../session-manager.js';
```
To:
```typescript
import { getSessionManager } from '../core/session-manager.js';
```

**Step 5: Update internal import in src/core/session-manager.ts (line 3)**

Change:
```typescript
import { runAgentBrowser, type BrowserConfig } from './browser.js';
```
To:
```typescript
import { runAgentBrowser, type BrowserConfig } from './browser.js';
```
(Note: This stays the same since both files are now in core/)

**Step 6: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: Move session-manager.ts to core/"
```

---

### Task 4: Move cache.ts to core/

**Files:**
- Move: `src/cache.ts` → `src/core/cache.ts`
- Modify: `src/search.ts`, `src/tools/extract.ts`, `src/tools/research.ts`

**Step 1: Move cache.ts**

```bash
mv src/cache.ts src/core/cache.ts
```

**Step 2: Update import in src/search.ts (add line after line 11)**

Add:
```typescript
import { getSearchCache } from './core/cache.js';
```

**Step 3: Update import in src/tools/extract.ts**

Add import for cache if used, or verify no changes needed.

**Step 4: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: Move cache.ts to core/"
```

---

### Task 5: Move errors.ts to core/

**Files:**
- Move: `src/errors.ts` → `src/core/errors.ts`
- Modify: `src/search.ts`, `src/tools/extract.ts`, `src/tools/research.ts`, `src/content/extractor.ts`

**Step 1: Move errors.ts**

```bash
mv src/errors.ts src/core/errors.ts
```

**Step 2: Update import in src/search.ts (line 11)**

Change:
```typescript
import { BrowserError, SearchError, TimeoutError, toWebSearchError } from './errors.js';
```
To:
```typescript
import { BrowserError, SearchError, TimeoutError, toWebSearchError } from './core/errors.js';
```

**Step 3: Update import in src/tools/extract.ts**

Check for errors import and update path to `../core/errors.js`.

**Step 4: Update import in src/tools/research.ts**

Check for errors import and update path to `../core/errors.js`.

**Step 5: Update import in src/content/extractor.ts**

Check for errors import and update path to `../core/errors.js`.

**Step 6: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: Move errors.ts to core/"
```

---

### Task 6: Move search.ts to tools/

**Files:**
- Move: `src/search.ts` → `src/tools/search.ts`
- Modify: `src/index.ts`, `src/tools/search.ts`

**Step 1: Move search.ts**

```bash
mv src/search.ts src/tools/search.ts
```

**Step 2: Update all imports in src/tools/search.ts**

Change:
```typescript
import { runAgentBrowser, ensureAgentBrowser, parseOutput, type BrowserConfig } from './core/browser.js';
import { getSessionManager, type BrowserSession } from './core/session-manager.js';
import { BrowserError, SearchError, TimeoutError, toWebSearchError } from './core/errors.js';
```
To:
```typescript
import { runAgentBrowser, ensureAgentBrowser, parseOutput, type BrowserConfig } from '../core/browser.js';
import { getSessionManager, type BrowserSession } from '../core/session-manager.js';
import { BrowserError, SearchError, TimeoutError, toWebSearchError } from '../core/errors.js';
```

Also update:
```typescript
import { searchWithTavily } from './tavily.js';
```
To:
```typescript
import { searchWithTavily } } from '../tavily.js';
```

And:
```typescript
import { validateInput, ... } from './utils.js';
```
To:
```typescript
import { validateInput, ... } from '../utils.js';
```

**Step 3: Update import in src/index.ts (line 11)**

Change:
```typescript
import { performEnhancedSearch } from './search.js';
```
To:
```typescript
import { performEnhancedSearch } from './tools/search.js';
```

**Step 4: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: Move search.ts to tools/"
```

---

## Phase 2: Resources Implementation

### Task 7: Create resources directory and index.ts

**Files:**
- Create: `src/resources/index.ts`

**Step 1: Create resources directory**

```bash
mkdir -p src/resources
```

**Step 2: Create src/resources/index.ts**

```typescript
// src/resources/index.ts
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Resource,
} from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getServerConfigResource, readServerConfig } from './server-config.js';
import { getSessionStatusResource, readSessionStatus } from './session-status.js';

export const RESOURCES: Resource[] = [
  getServerConfigResource(),
  getSessionStatusResource(),
];

export function setupResourceHandlers(server: Server): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  // Read specific resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === 'config://server') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(readServerConfig(), null, 2),
          },
        ],
      };
    }

    if (uri === 'session://status') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await readSessionStatus(), null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });
}

export { getServerConfigResource, readServerConfig } from './server-config.js';
export { getSessionStatusResource, readSessionStatus } from './session-status.js';
```

**Step 3: Commit**

```bash
git add src/resources/index.ts
git commit -m "feat(resources): Create resources index with handlers"
```

---

### Task 8: Create server-config.ts resource

**Files:**
- Create: `src/resources/server-config.ts`

**Step 1: Create src/resources/server-config.ts**

```typescript
// src/resources/server-config.ts
import type { Resource } from '@modelcontextprotocol/sdk/types.js';

export interface ServerConfig {
  name: string;
  version: string;
  mcpSpecVersion: string;
  sdkVersion: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
  tools: Array<{
    name: string;
    title: string;
    description: string;
    readOnly: boolean;
  }>;
}

export function getServerConfigResource(): Resource {
  return {
    uri: 'config://server',
    name: 'Server Configuration',
    description: 'Server capabilities, version info, and available tools',
    mimeType: 'application/json',
  };
}

export function readServerConfig(): ServerConfig {
  return {
    name: 'web-search',
    version: '0.3.0',
    mcpSpecVersion: '2025-11-25',
    sdkVersion: '1.27.1',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    tools: [
      {
        name: 'search',
        title: 'Web Search',
        description: 'Search the web using Google (no API key required)',
        readOnly: true,
      },
      {
        name: 'extract',
        title: 'Content Extraction',
        description: 'Extract structured content from web pages with multiple output formats',
        readOnly: true,
      },
      {
        name: 'research',
        title: 'Automated Research',
        description: 'Search, auto-browse relevant results, and return structured findings',
        readOnly: true,
      },
    ],
  };
}
```

**Step 2: Commit**

```bash
git add src/resources/server-config.ts
git commit -m "feat(resources): Add server config resource"
```

---

### Task 9: Create session-status.ts resource

**Files:**
- Create: `src/resources/session-status.ts`

**Step 1: Create src/resources/session-status.ts**

```typescript
// src/resources/session-status.ts
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { getSessionManager } from '../core/session-manager.js';

export interface SessionStatus {
  activeSessionCount: number;
  sessions: Array<{
    id: string;  // Truncated for privacy
    ageSeconds: number;
    device?: string;
    isActive: boolean;
  }>;
}

export function getSessionStatusResource(): Resource {
  return {
    uri: 'session://status',
    name: 'Active Sessions',
    description: 'Information about active browser sessions',
    mimeType: 'application/json',
  };
}

export async function readSessionStatus(): Promise<SessionStatus> {
  const sessionManager = getSessionManager();
  const stats = sessionManager.getStats();

  return {
    activeSessionCount: stats.activeCount,
    sessions: stats.sessions.map(s => ({
      id: s.id.substring(0, 8) + '...',  // Truncated for privacy
      ageSeconds: Math.floor((Date.now() - s.createdAt) / 1000),
      device: s.device,
      isActive: s.isActive,
    })),
  };
}
```

**Step 2: Add getStats method to SessionManager (src/core/session-manager.ts)**

Add this method to the `BrowserSessionManager` class:

```typescript
getStats(): { activeCount: number; sessions: Array<{ id: string; createdAt: number; device?: string; isActive: boolean }> } {
  const now = Date.now();
  const sessions = Array.from(this.sessions.entries())
    .filter(([_, session]) => now - session.lastUsed < this.sessionTimeoutMs)
    .map(([id, session]) => ({
      id,
      createdAt: session.createdAt,
      device: session.device,
      isActive: session.isActive,
    }));

  return {
    activeCount: sessions.length,
    sessions,
  };
}
```

**Step 3: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 4: Commit**

```bash
git add src/resources/session-status.ts src/core/session-manager.ts
git commit -m "feat(resources): Add session status resource"
```

---

## Phase 3: Prompts Implementation

### Task 10: Create prompts directory and index.ts

**Files:**
- Create: `src/prompts/index.ts`

**Step 1: Create prompts directory**

```bash
mkdir -p src/prompts
```

**Step 2: Create src/prompts/index.ts**

```typescript
// src/prompts/index.ts
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Prompt,
  type PromptArgument,
} from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  RESEARCH_PROMPTS,
  getPromptContent,
} from './research-templates.js';

export const PROMPTS: Prompt[] = RESEARCH_PROMPTS.map(p => ({
  name: p.name,
  description: p.description,
  arguments: p.arguments,
}));

export function setupPromptHandlers(server: Server): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  // Get specific prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const args = request.params.arguments || {};

    const content = getPromptContent(promptName, args);

    if (!content) {
      throw new Error(`Unknown prompt: ${promptName}`);
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content,
          },
        },
      ],
    };
  });
}

export { RESEARCH_PROMPTS, getPromptContent } from './research-templates.js';
```

**Step 3: Commit**

```bash
git add src/prompts/index.ts
git commit -m "feat(prompts): Create prompts index with handlers"
```

---

### Task 11: Create research-templates.ts prompts

**Files:**
- Create: `src/prompts/research-templates.ts`

**Step 1: Create src/prompts/research-templates.ts**

```typescript
// src/prompts/research-templates.ts
import type { PromptArgument } from '@modelcontextprotocol/sdk/types.js';

export interface ResearchPrompt {
  name: string;
  description: string;
  arguments: PromptArgument[];
  template: (args: Record<string, string>) => string;
}

export const RESEARCH_PROMPTS: ResearchPrompt[] = [
  {
    name: 'deep-research',
    description: 'Conduct deep research on a topic with multiple sources and comprehensive analysis',
    arguments: [
      { name: 'topic', description: 'The topic to research', required: true },
      { name: 'depth', description: 'Research depth level (1=basic, 2=standard, 3=comprehensive)', required: false },
    ],
    template: (args) => {
      const topic = args.topic;
      const depth = args.depth || '2';
      const maxPages = depth === '3' ? 20 : depth === '2' ? 10 : 5;

      return `Conduct a depth-${depth} research on: "${topic}"

Instructions:
1. Use the research tool with the following parameters:
   - query: "${topic}"
   - focus_topics: ["${topic}", "overview", "latest developments", "analysis"]
   - max_pages: ${maxPages}
   - extract_facts: true
   - follow_links: ${depth !== '1'}

2. After gathering results, synthesize the findings into:
   - Executive summary
   - Key findings with citations
   - Different perspectives if available
   - Conclusions and recommendations

3. If the topic requires more depth, use additional searches with refined queries.`;
    },
  },
  {
    name: 'compare-sources',
    description: 'Compare information across multiple sources to identify consensus and disagreements',
    arguments: [
      { name: 'query', description: 'The search query to compare sources for', required: true },
      { name: 'sources', description: 'Number of sources to compare (default: 5)', required: false },
    ],
    template: (args) => {
      const query = args.query;
      const sources = args.sources || '5';

      return `Compare sources on: "${query}"

Instructions:
1. Use the search tool to find ${sources} different sources:
   - query: "${query}"
   - limit: ${sources}

2. Use the extract tool on each unique domain to get full content

3. Create a comparison matrix including:
   - Source name and credibility indicators
   - Main claims made
   - Supporting evidence
   - Areas of agreement
   - Areas of disagreement
   - Notable omissions

4. Provide an analysis of:
   - Which claims have consensus
   - Which claims are disputed
   - What might explain differences
   - Recommended next steps for verification`;
    },
  },
  {
    name: 'fact-check',
    description: 'Verify a claim by searching for supporting and contradicting evidence',
    arguments: [
      { name: 'claim', description: 'The claim to verify', required: true },
      { name: 'context', description: 'Additional context about the claim', required: false },
    ],
    template: (args) => {
      const claim = args.claim;
      const context = args.context ? `Context: ${args.context}\n\n` : '';

      return `${context}Fact-check this claim: "${claim}"

Instructions:
1. Use the research tool with:
   - query: "${claim}"
   - focus_topics: ["evidence", "source", "verification", "debunk"]
   - max_pages: 10
   - extract_facts: true

2. Search for both supporting AND contradicting evidence

3. Evaluate findings based on:
   - Source credibility (primary vs secondary, expertise, bias)
   - Recency of information
   - Corroboration across independent sources
   - Methodology if research-based

4. Provide a verdict:
   - VERIFIED: Strong supporting evidence, no credible contradictions
   - PARTIALLY TRUE: Some support but with important caveats
   - DISPUTED: Significant contradictory evidence exists
   - UNVERIFIABLE: Insufficient reliable sources
   - FALSE: Strong contradicting evidence

5. Include citations for all evidence used.`;
    },
  },
];

export function getPromptContent(name: string, args: Record<string, string>): string | null {
  const prompt = RESEARCH_PROMPTS.find(p => p.name === name);
  if (!prompt) {
    return null;
  }
  return prompt.template(args);
}
```

**Step 2: Commit**

```bash
git add src/prompts/research-templates.ts
git commit -m "feat(prompts): Add deep-research, compare-sources, fact-check prompts"
```

---

## Phase 4: Update Main Server Entry

### Task 12: Update index.ts with Resources and Prompts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add imports for resources and prompts**

Add after line 15:
```typescript
import { setupResourceHandlers } from './resources/index.js';
import { setupPromptHandlers } from './prompts/index.js';
```

**Step 2: Update capabilities in constructor**

Change:
```typescript
capabilities: {
  tools: {},
},
```
To:
```typescript
capabilities: {
  tools: {},
  resources: {},
  prompts: {},
},
```

**Step 3: Add handler setup in constructor**

After `this.setupToolHandlers();`, add:
```typescript
setupResourceHandlers(this.server);
setupPromptHandlers(this.server);
```

**Step 4: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: Register resources and prompts in main server"
```

---

## Phase 5: Add outputSchema to Tools

### Task 13: Add outputSchema to search tool

**Files:**
- Modify: `src/index.ts`

**Step 1: Add outputSchema to search tool definition**

Add after the `annotations` block (around line 107):
```typescript
outputSchema: {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    source: { type: 'string', enum: ['google', 'duckduckgo', 'tavily'] },
    query: { type: 'string' },
    session_id: { type: 'string' },
    session_active: { type: 'boolean' },
    search_time_ms: { type: 'number' },
    captcha_encountered: { type: 'boolean' },
    fallback_used: { type: 'boolean' },
  },
},
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: Add outputSchema to search tool"
```

---

### Task 14: Add outputSchema to extract tool

**Files:**
- Modify: `src/index.ts`

**Step 1: Add outputSchema to extract tool definition**

Add after the `annotations` block:
```typescript
outputSchema: {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['success', 'error', 'timeout'] },
          formats: {
            type: 'object',
            properties: {
              markdown: { type: 'string' },
              html: { type: 'string' },
              article_markdown: { type: 'string' },
              screenshot_base64: { type: 'string' },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              author: { type: 'string' },
              publish_date: { type: 'string' },
              word_count: { type: 'number' },
              reading_time_minutes: { type: 'number' },
            },
          },
          extraction_time_ms: { type: 'number' },
        },
      },
    },
    session_id: { type: 'string' },
    total_time_ms: { type: 'number' },
    successful_count: { type: 'number' },
    failed_count: { type: 'number' },
  },
},
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: Add outputSchema to extract tool"
```

---

### Task 15: Add outputSchema to research tool

**Files:**
- Modify: `src/index.ts`

**Step 1: Add outputSchema to research tool definition**

Add after the `annotations` block:
```typescript
outputSchema: {
  type: 'object',
  properties: {
    query: { type: 'string' },
    focus_topics: {
      type: 'array',
      items: { type: 'string' },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          relevance_score: { type: 'number' },
          relevance_reasoning: { type: 'string' },
          key_facts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['statistic', 'date', 'quote', 'definition'] },
                fact: { type: 'string' },
                context: { type: 'string' },
                confidence: { type: 'number' },
              },
            },
          },
          summary: { type: 'string' },
          markdown: { type: 'string' },
        },
      },
    },
    analysis_summary: {
      type: 'object',
      properties: {
        total_pages_analyzed: { type: 'number' },
        pages_skipped: { type: 'number' },
        avg_relevance_score: { type: 'number' },
        top_topics_found: {
          type: 'array',
          items: { type: 'string' },
        },
        research_time_ms: { type: 'number' },
      },
    },
    search_source: { type: 'string', enum: ['google', 'duckduckgo', 'tavily'] },
  },
},
```

**Step 2: Verify build**

```bash
pnpm build
```
Expected: Build successful

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: Add outputSchema to research tool"
```

---

## Phase 6: Final Verification and Documentation

### Task 16: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update README with new features**

Add sections for:
- Resources documentation
- Prompts documentation
- Updated architecture diagram

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: Update README with resources, prompts, and new architecture"
```

---

### Task 17: Final build and verification

**Step 1: Run full build**

```bash
pnpm build
```
Expected: Build successful

**Step 2: Verify server starts**

```bash
node build/index.js &
sleep 2
kill %1
```
Expected: Server starts without errors

**Step 3: Final commit if needed**

```bash
git status
# If any changes:
git add -A
git commit -m "chore: Final cleanup for MCP v2025-11-25 compliance"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-6 | Directory restructuring |
| 2 | 7-9 | Resources implementation |
| 3 | 10-11 | Prompts implementation |
| 4 | 12 | Update main server entry |
| 5 | 13-15 | Add outputSchema to tools |
| 6 | 16-17 | Documentation and verification |

**Total: 17 tasks**
