import {
  runCommand,
  BROWSER_TIMEOUT_MS,
  MAX_OUTPUT_SIZE,
  type EnsureResult,
} from './utils.js';

export const AGENT_BROWSER_VERSION = 'latest';
export const INSTALL_TIMEOUT_MS = 60000;
export const CHROMIUM_INSTALL_TIMEOUT_MS = 120000;

// Stealth settings to avoid bot detection
const STEALTH_FLAGS = [
  '--headed',
  '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

export async function runAgentBrowser(args: string[], timeout: number = BROWSER_TIMEOUT_MS): Promise<string> {
  // Inject stealth flags for browser-affecting commands
  const needsStealth = ['open', 'goto', 'navigate'].includes(args[0]);
  const finalArgs = needsStealth ? [...args, ...STEALTH_FLAGS] : args;
  return runCommand('npx', ['agent-browser@latest', ...finalArgs], timeout);
}

export async function ensureAgentBrowser(): Promise<EnsureResult> {
  try {
    // Use npx which auto-installs if needed
    await runCommand('npx', ['agent-browser@latest', '--version'], 30000);
    return { ready: true };
  } catch {
    // Try to install chromium
    try {
      await runCommand('npx', ['agent-browser@latest', 'install'], CHROMIUM_INSTALL_TIMEOUT_MS);
      return { ready: true };
    } catch {
      return {
        ready: false,
        instructions: 'agent-browser setup failed. Run manually:\n' +
          '  npx agent-browser@latest install\n' +
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
