import {
  runCommand,
  BROWSER_TIMEOUT_MS,
  MAX_OUTPUT_SIZE,
  type EnsureResult,
} from '../utils.js';

export const AGENT_BROWSER_VERSION = 'latest';
export const INSTALL_TIMEOUT_MS = 60000;
export const CHROMIUM_INSTALL_TIMEOUT_MS = 120000;

// Device emulation profiles mapping to agent-browser device names
export const DEVICE_PROFILES: Record<string, string> = {
  desktop: '', // Default, no special device
  mobile: 'Pixel 5',
  iphone: 'iPhone 13',
  android: 'Pixel 5',
};

// Device type for reuse across the codebase
export type DeviceType = 'desktop' | 'mobile' | 'iphone' | 'android';

// Browser configuration options
export interface BrowserConfig {
  sessionId?: string;
  device?: 'desktop' | 'mobile' | 'iphone' | 'android';
  proxy?: string;
}

// Stealth settings to avoid bot detection
const STEALTH_FLAGS = [
  '--headed',
  '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

/**
 * Build CLI args from BrowserConfig
 */
export function buildBrowserArgs(config: BrowserConfig = {}): string[] {
  const args: string[] = [];

  // Session persistence
  if (config.sessionId) {
    args.push('--session-name', config.sessionId);
  }

  // Device emulation
  if (config.device && config.device !== 'desktop') {
    const deviceProfile = DEVICE_PROFILES[config.device];
    if (deviceProfile) {
      args.push('--device', deviceProfile);
    }
  }

  // Proxy support
  if (config.proxy) {
    args.push('--proxy', config.proxy);
  }

  return args;
}

/**
 * Run agent-browser CLI with optional configuration
 */
export async function runAgentBrowser(
  args: string[],
  timeout: number = BROWSER_TIMEOUT_MS,
  config: BrowserConfig = {}
): Promise<string> {
  // Build config args
  const configArgs = buildBrowserArgs(config);

  // Inject stealth flags for browser-affecting commands
  const needsStealth = ['open', 'goto', 'navigate'].includes(args[0]);
  const stealthArgs = needsStealth ? STEALTH_FLAGS : [];

  const finalArgs = [...args, ...configArgs, ...stealthArgs];
  return runCommand('npx', ['agent-browser@latest', ...finalArgs], timeout);
}

/**
 * Run a sequence of browser commands in the same session
 */
export async function runBrowserSequence(
  commands: string[][],
  config: BrowserConfig = {},
  timeout: number = BROWSER_TIMEOUT_MS
): Promise<string[]> {
  const results: string[] = [];

  for (const args of commands) {
    const result = await runAgentBrowser(args, timeout, config);
    results.push(result);
  }

  return results;
}

export async function ensureAgentBrowser(): Promise<EnsureResult> {
  // First, try an actual browser operation to verify Chromium is installed
  // Using 'close' is safe - it succeeds if browser isn't running, fails only if browser can't start
  try {
    console.error('Verifying browser setup...');
    await runCommand('npx', ['agent-browser@latest', 'close'], 15000);
    console.error('Browser verified (no stale session).');
    return { ready: true };
  } catch (error) {
    // Browser operation failed - likely Chromium not installed
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Browser verification failed:', errorMsg);
    console.error('Attempting to install Chromium...');

    // Try to install chromium
    try {
      await runCommand('npx', ['agent-browser@latest', 'install'], CHROMIUM_INSTALL_TIMEOUT_MS);
      console.error('Chromium installed successfully.');

      // Verify again after install
      try {
        await runCommand('npx', ['agent-browser@latest', 'close'], 15000);
        return { ready: true };
      } catch {
        return {
          ready: false,
          instructions: 'Browser installed but verification failed. Run manually:\n' +
            '  npx agent-browser@latest install\n' +
            'Then restart the MCP server.',
        };
      }
    } catch (installError) {
      const installMsg = installError instanceof Error ? installError.message : String(installError);
      return {
        ready: false,
        instructions: 'Chromium installation failed: ' + installMsg + '\n' +
          'Run manually: npx agent-browser@latest install\n' +
          'Then restart the MCP server.',
      };
    }
  }
}

export function parseOutput(stdout: string): unknown {
  if (stdout.length > MAX_OUTPUT_SIZE) {
    throw new Error(`Output too large: ${stdout.length} bytes exceeds limit of ${MAX_OUTPUT_SIZE} bytes`);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error('Invalid JSON output from agent-browser');
  }
}

/**
 * Take a screenshot and return base64 encoded image
 */
export async function takeScreenshot(
  config: BrowserConfig = {},
  fullPage: boolean = false,
  timeout: number = BROWSER_TIMEOUT_MS
): Promise<string> {
  const args = ['screenshot'];
  if (fullPage) {
    args.push('--full');
  }
  const output = await runAgentBrowser(args, timeout, config);

  // Output might be base64 or a path, handle both
  // agent-browser outputs base64 when no path is specified
  return output.trim();
}

/**
 * Save page as PDF
 */
export async function savePdf(
  path: string,
  config: BrowserConfig = {},
  timeout: number = BROWSER_TIMEOUT_MS
): Promise<void> {
  await runAgentBrowser(['pdf', path], timeout, config);
}

/**
 * Wait for a selector or timeout
 */
export async function waitFor(
  selectorOrMs: string,
  config: BrowserConfig = {},
  timeout: number = BROWSER_TIMEOUT_MS
): Promise<void> {
  await runAgentBrowser(['wait', selectorOrMs], timeout, config);
}

/**
 * Evaluate JavaScript in the browser
 */
export async function evalJs<T>(
  code: string,
  config: BrowserConfig = {},
  timeout: number = BROWSER_TIMEOUT_MS
): Promise<T> {
  const output = await runAgentBrowser(['eval', code], timeout, config);
  return JSON.parse(output) as T;
}
