import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { FeatureflipClient, FileSnapshotStore } from '../src/index.js';

// Real @featureflip/js (built dist) against a local stub Evaluation API.
const payload = {
  environment: 'test',
  version: 1,
  segments: [],
  flags: [
    {
      key: 'greeting',
      version: 1,
      type: 'String',
      enabled: true,
      variations: [{ key: 'a', value: 'from-server' }],
      rules: [],
      fallthrough: { type: 'Fixed', variation: 'a' },
      offVariation: 'a',
    },
  ],
};

function startStub(): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith('/v1/sdk/flags')) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }),
    );
  });
}

const stop = (s: http.Server) =>
  new Promise<void>((r) => {
    s.closeAllConnections();
    s.close(() => r());
  });

async function waitFor(cond: () => boolean) {
  for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
}

const ctx = { user_id: 'u1' };

describe('snapshot store (node)', () => {
  let dir: string;
  let file: string;
  let stub: { server: http.Server; url: string };

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-snap-'));
    file = path.join(dir, 'snap.json');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stub = await startStub();
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await stop(stub.server).catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const cfg = (baseUrl: string, extra: Record<string, unknown> = {}) => ({
    sdkKey: 'sdk-key-1',
    baseUrl,
    streaming: false,
    pollInterval: 60_000,
    initTimeout: 1_000,
    snapshotStore: new FileSnapshotStore(file),
    ...extra,
  });

  async function writeSnapshot() {
    const c = await FeatureflipClient.create(cfg(stub.url));
    expect(c.stringVariation('greeting', ctx, 'dflt')).toBe('from-server');
    expect(c.startupInfo.source).toBe('live');
    await waitFor(() => fs.existsSync(file));
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    await c.close();
    await stop(stub.server);
  }

  it('serves the persisted snapshot when the API is down at startup', async () => {
    await writeSnapshot();
    const c = FeatureflipClient.get(cfg(stub.url));
    await c.waitForInitialization();
    expect(c.isInitialized).toBe(true);
    expect(c.stringVariation('greeting', ctx, 'dflt')).toBe('from-server');
    expect(c.startupInfo.source).toBe('snapshot');
    expect(c.startupInfo.reason).toBe('snapshot');
    await c.close();
  });

  it('ignores an expired snapshot and serves defaults', async () => {
    await writeSnapshot();
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 10_000 });
    const c = FeatureflipClient.get(cfg(stub.url, { maxSnapshotAgeSeconds: 1 }));
    await c.waitForInitialization();
    expect(c.stringVariation('greeting', ctx, 'dflt')).toBe('dflt');
    expect(c.startupInfo.source).toBe('none');
    expect(c.startupInfo.reason).toBe('snapshot-expired');
    await c.close();
  });

  it("does not serve another SDK key's snapshot", async () => {
    await writeSnapshot();
    const c = FeatureflipClient.get(cfg(stub.url, { sdkKey: 'other-key' }));
    await c.waitForInitialization();
    expect(c.stringVariation('greeting', ctx, 'dflt')).toBe('dflt');
    expect(c.startupInfo.source).toBe('none');
    expect(c.startupInfo.reason).toBe('snapshot-invalid');
    await c.close();
  });

  it('a custom opaque text store works with no bind', async () => {
    let stored: string | undefined;
    const textStore = {
      get: async () => stored,
      put: async (text: string) => {
        stored = text;
      },
    };
    const live = await FeatureflipClient.create(cfg(stub.url, { snapshotStore: textStore }));
    await waitFor(() => stored !== undefined);
    expect(JSON.parse(stored!).v).toBe(1);
    await live.close();
    await stop(stub.server);

    const c = FeatureflipClient.get(cfg(stub.url, { snapshotStore: textStore }));
    await c.waitForInitialization();
    expect(c.stringVariation('greeting', ctx, 'dflt')).toBe('from-server');
    expect(c.startupInfo.source).toBe('snapshot');
    await c.close();
  });

  describe('options on an existing key', () => {
    const ignoredWarnings = () =>
      (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes('is ignored because the client for this SDK key already exists'),
      );

    it('a later get() that omits maxSnapshotAgeSeconds never warns it is ignored', async () => {
      const snapshotStore = new FileSnapshotStore(file);
      const first = await FeatureflipClient.create(
        cfg(stub.url, { snapshotStore, maxSnapshotAgeSeconds: 60 }),
      );
      const { maxSnapshotAgeSeconds: _omit, ...omitted } = cfg(stub.url, {
        snapshotStore,
        maxSnapshotAgeSeconds: 60,
      });
      const second = FeatureflipClient.get(omitted);
      expect(ignoredWarnings()).toEqual([]);
      await second.close();
      await first.close();
    });

    it('a later get() with an explicit different maxSnapshotAgeSeconds still warns', async () => {
      const snapshotStore = new FileSnapshotStore(file);
      const first = await FeatureflipClient.create(
        cfg(stub.url, { snapshotStore, maxSnapshotAgeSeconds: 60 }),
      );
      const second = FeatureflipClient.get(
        cfg(stub.url, { snapshotStore, maxSnapshotAgeSeconds: 86_400 }),
      );
      expect(ignoredWarnings()).toHaveLength(1);
      await second.close();
      await first.close();
    });
  });

  it('logs the cause, not the key, when the fetch fails and nothing is stored', async () => {
    await stop(stub.server);
    const c = FeatureflipClient.get(cfg(stub.url));
    await c.waitForInitialization();
    const logged = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => call.map(String).join(' '))
      .join('\n');
    expect(logged).toContain('initial flag fetch failed (');
    expect(logged).toContain('no snapshot stored; serving defaults');
    expect(logged).not.toContain('sdk-key-1');
    await c.close();
  });
});
