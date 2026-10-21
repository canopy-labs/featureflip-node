import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FeatureflipClient } from '../src/client.js';

/**
 * The Node SDK names itself after the js SDK it runs on (#4145, contract in
 * #4138): `featureflip-js/<js version> featureflip-node/<node version>`. Before
 * this it sent only the js token, with the js SDK's version, so Node usage was
 * counted as js usage on a version the caller never installed.
 *
 * Runs against the REAL @featureflip/js (no module mock in this file), so it
 * proves the wrapper token reaches the wire, not merely that it was passed.
 */
const pkg = (dir: string) =>
  (JSON.parse(readFileSync(resolve(__dirname, dir, 'package.json'), 'utf-8')) as { version: string }).version;
const NODE_VERSION = pkg('..');
const JS_VERSION = pkg('../../js-sdk');

function stubFetch() {
  const agents: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      agents.push((init?.headers as Record<string, string>)['User-Agent']);
      return new Response(JSON.stringify({ environment: 'e', version: 1, flags: [], segments: [] }), { status: 200 });
    }),
  );
  return agents;
}

let n = 0;

describe('Node SDK identity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends featureflip-node/<version> after the js token', async () => {
    const agents = stubFetch();
    const client = await FeatureflipClient.create({ sdkKey: `identity-${++n}`, baseUrl: 'http://eval.test', streaming: false });
    await client.close();

    expect(agents[0]).toBe(`featureflip-js/${JS_VERSION} featureflip-node/${NODE_VERSION}`);
  });

  it('appends a caller-supplied wrapper after its own token', async () => {
    const agents = stubFetch();
    const client = await FeatureflipClient.create({
      sdkKey: `identity-${++n}`,
      baseUrl: 'http://eval.test',
      streaming: false,
      wrappers: ['featureflip-openfeature-node/1.0.0'],
    });
    await client.close();

    expect(agents[0]).toBe(
      `featureflip-js/${JS_VERSION} featureflip-node/${NODE_VERSION} featureflip-openfeature-node/1.0.0`,
    );
  });
});
