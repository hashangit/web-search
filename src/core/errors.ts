/**
 * Custom error types for the Web Search MCP Server
 */

/**
 * Base error class for all web-search errors
 */
export class WebSearchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = 'WebSearchError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      suggestion: this.suggestion,
    };
  }
}

/**
 * Error thrown when a timeout occurs
 */
export class TimeoutError extends WebSearchError {
  constructor(
    operation: string,
    timeoutMs: number,
    suggestion: string = 'Try increasing the timeout_ms parameter'
  ) {
    super(
      `${operation} timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      true,
      suggestion
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when browser operations fail
 */
export class BrowserError extends WebSearchError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    suggestion: string = 'Ensure agent-browser is installed: npx agent-browser@latest install'
  ) {
    super(message, 'BROWSER_ERROR', true, suggestion);
    this.name = 'BrowserError';
  }
}

/**
 * Error thrown when content extraction fails
 */
export class ExtractionError extends WebSearchError {
  constructor(
    url: string,
    reason: string,
    suggestion: string = 'The page may require JavaScript or be behind authentication'
  ) {
    super(
      `Failed to extract content from ${url}: ${reason}`,
      'EXTRACTION_ERROR',
      true,
      suggestion
    );
    this.name = 'ExtractionError';
  }
}

/**
 * Error thrown when search fails
 */
export class SearchError extends WebSearchError {
  constructor(
    query: string,
    reason: string,
    suggestion: string = 'Try a different search query or use source_preference to change the search engine'
  ) {
    super(
      `Search failed for "${query}": ${reason}`,
      'SEARCH_ERROR',
      true,
      suggestion
    );
    this.name = 'SearchError';
  }
}

/**
 * Error thrown when URL validation fails
 */
export class ValidationError extends WebSearchError {
  constructor(
    field: string,
    value: unknown,
    reason: string,
    suggestion?: string
  ) {
    super(
      `Invalid ${field}: ${reason}`,
      'VALIDATION_ERROR',
      true,
      suggestion
    );
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when session operations fail
 */
export class SessionError extends WebSearchError {
  constructor(
    sessionId: string,
    operation: string,
    reason: string,
    suggestion: string = 'Try creating a new session'
  ) {
    super(
      `Session ${operation} failed for ${sessionId}: ${reason}`,
      'SESSION_ERROR',
      true,
      suggestion
    );
    this.name = 'SessionError';
  }
}

/**
 * Error thrown when rate limiting is encountered
 */
export class RateLimitError extends WebSearchError {
  constructor(
    source: string,
    retryAfter?: number,
    suggestion?: string
  ) {
    super(
      `Rate limited by ${source}${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT',
      true,
      suggestion || 'Wait a moment and try again, or use a different source'
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Check if an error is a WebSearchError
 */
export function isWebSearchError(error: unknown): error is WebSearchError {
  return error instanceof WebSearchError;
}

/**
 * Convert any error to a WebSearchError
 */
export function toWebSearchError(error: unknown, context?: string): WebSearchError {
  if (isWebSearchError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return new TimeoutError(context || 'Operation', 30000);
    }

    if (message.includes('browser') || message.includes('chromium') || message.includes('playwright')) {
      return new BrowserError(error.message, error);
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('dns')) {
      return new WebSearchError(
        `Network error: ${error.message}`,
        'NETWORK_ERROR',
        true,
        'Check your network connection and try again'
      );
    }

    return new WebSearchError(
      error.message,
      'UNKNOWN_ERROR',
      true,
      context ? `Context: ${context}` : undefined
    );
  }

  return new WebSearchError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    false
  );
}

/**
 * Format error for MCP response
 */
export function formatErrorForMcp(error: unknown): { error: string; details?: Record<string, unknown> } {
  const wsError = toWebSearchError(error);

  const result: { error: string; details?: Record<string, unknown> } = {
    error: wsError.message,
  };

  if (wsError.suggestion) {
    result.details = {
      code: wsError.code,
      recoverable: wsError.recoverable,
      suggestion: wsError.suggestion,
    };
  }

  return result;
}
