import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inspect } from 'node:util';
import { FeatureflipClient } from '../src/client.js';

// #5166: drives the public node entry point (real @featureflip/js, real node
// platform, stubbed global fetch) and proves the wrapper adds no key leak. The
// redactor itself lives in @featureflip/js (#5167).

const KEY = 'sdk_server_SentinelKeyMustNeverAppearInLogs-0123456789';

function leakyError(): Error {
  const err = new Error(`fetch failed: headers={"Authorization":"${KEY}"}`);
  (err as { cause?: unknown }).cause = new Error(`socket hang up (Authorization: ${KEY})`);
  return err;
}

let captured: string[];
let spies: Array<ReturnType<typeof vi.spyOn>>;

beforeEach(() => {
  captured = [];
  const sink = (...args: unknown[]) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : inspect(a, { depth: null }))).join(' '));
  };
  spies = (['log', 'info', 'debug', 'warn', 'error', 'trace'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(sink),
  );
});

afterEach(() => {
  spies.forEach((s) => s.mockRestore());
  vi.unstubAllGlobals();
});

async function drive(fetchImpl: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', fetchImpl);
  const thrown: unknown[] = [];
  const attempt = async (fn: () => unknown) => {
    try {
      await fn();
    } catch (e) {
      thrown.push(e);
    }
  };
  const client = FeatureflipClient.get({
    sdkKey: KEY,
    baseUrl: 'http://stub.invalid',
    streaming: false,
    pollInterval: 600_000,
    flushInterval: 600_000,
    initTimeout: 2000,
    // An empty store makes a failed init log its cause, so there is output to inspect.
    snapshotStore: { get: async () => undefined, put: async () => {} },
  });
  await attempt(() => client.waitForInitialization());
  await attempt(() => client.boolVariation('no-such-flag', { key: 'u' }, false));
  await attempt(() => client.track('evt', { key: 'u' }));
  await attempt(() => client.flush());
  await attempt(() => client.close());
  return thrown;
}

describe('node SDK never leaks the SDK key', () => {
  const cases: Array<[string, (url: string) => Promise<Response>]> = [
    ['401', () => Promise.resolve(new Response('{}', { status: 401 }))],
    ['500', () => Promise.resolve(new Response('{}', { status: 500 }))],
    ['transport error quoting the key', () => Promise.reject(leakyError())],
  ];

  it.each(cases)('init %s', async (_n, impl) => {
    const thrown = await drive(impl);
    expect(captured.join('\n')).not.toContain(KEY);
    for (const t of thrown) expect(inspect(t, { depth: null })).not.toContain(KEY);
  });

  it('logs the failure with the key redacted', async () => {
    await drive(() => Promise.reject(leakyError()));
    expect(captured.join('\n')).toContain('initial flag fetch failed');
  });
});
