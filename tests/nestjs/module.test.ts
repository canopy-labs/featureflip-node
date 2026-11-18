import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { FeatureflipClient } from '../../src/client.js';
import { FEATUREFLIP_CLIENT, FeatureflipModule } from '../../src/nestjs/index.js';

const NEST_VERSION = (await import('@nestjs/common/package.json', { with: { type: 'json' } })).default.version;
const VERSION = (await import('../../package.json', { with: { type: 'json' } })).default.version;

interface Call {
  url: string;
  userAgent: string;
}

function stubFetch(): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), userAgent: (init?.headers as Record<string, string>)['User-Agent'] });
      return new Response(JSON.stringify({ environment: 'e', version: 1, flags: [], segments: [] }), { status: 200 });
    }),
  );
  return calls;
}

// Each test gets its own key: the SDK shares one core per key for the process.
let n = 0;
const nextKey = () => `sdk-nest-test-${++n}-${Math.random().toString(36).slice(2)}`;

describe('FeatureflipModule', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers one client under the class and the token', async () => {
    stubFetch();
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false })],
    }).compile();

    const byClass = mod.get(FeatureflipClient);
    expect(byClass).toBeInstanceOf(FeatureflipClient);
    expect(mod.get(FEATUREFLIP_CLIENT)).toBe(byClass);
    await mod.close();
  });

  it('is global: a module that never imports it can inject the client', async () => {
    stubFetch();
    class Feature {}
    Module({ providers: [{ provide: 'X', useFactory: (c: FeatureflipClient) => c, inject: [FeatureflipClient] }], exports: ['X'] })(Feature);
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false }), Feature],
    }).compile();

    expect(mod.get('X', { strict: false })).toBe(mod.get(FeatureflipClient));
    await mod.close();
  });

  it('waits for initialization by default', async () => {
    stubFetch();
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false })],
    }).compile();

    expect(mod.get(FeatureflipClient).isInitialized).toBe(true);
    await mod.close();
  });

  it('skips the wait with waitForInitialization: false', async () => {
    stubFetch();
    const wait = vi.spyOn(FeatureflipClient.prototype, 'waitForInitialization');
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false, waitForInitialization: false })],
    }).compile();

    expect(wait).not.toHaveBeenCalled();
    await mod.close();
  });

  it('passes options to the client and identifies the wrapper', async () => {
    const calls = stubFetch();
    const mod = await Test.createTestingModule({
      imports: [
        FeatureflipModule.forRoot({ sdkKey: nextKey(), baseUrl: 'https://flags.example.test', streaming: false }),
      ],
    }).compile();

    expect(calls[0].url).toContain('https://flags.example.test');
    expect(calls[0].userAgent).toMatch(new RegExp(`featureflip-node/${VERSION} featureflip-nestjs/${NEST_VERSION.replace(/\./g, '\\.')}$`));
    await mod.close();
  });

  it('respects a featureflip-nestjs wrapper the caller already set', async () => {
    const calls = stubFetch();
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false, wrappers: ['featureflip-nestjs/9.9.9'] })],
    }).compile();

    expect(calls[0].userAgent).toMatch(/featureflip-node\/\S+ featureflip-nestjs\/9\.9\.9$/);
    await mod.close();
  });

  it('keeps caller wrappers after its own token', async () => {
    const calls = stubFetch();
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false, wrappers: ['acme/1.2.3'] })],
    }).compile();

    expect(calls[0].userAgent).toMatch(/featureflip-nestjs\/\S+ acme\/1\.2\.3$/);
    await mod.close();
  });

  it('forRootAsync reads options from an injected provider', async () => {
    const calls = stubFetch();
    class ConfigService {
      get(k: string) {
        return { key: nextKey(), url: 'https://cfg.example.test' }[k];
      }
    }
    class ConfigModule {}
    Module({ providers: [ConfigService], exports: [ConfigService] })(ConfigModule);

    const mod = await Test.createTestingModule({
      imports: [
        FeatureflipModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (cfg: ConfigService) => ({
            sdkKey: cfg.get('key')!,
            baseUrl: cfg.get('url'),
            streaming: false,
          }),
        }),
      ],
    }).compile();

    expect(mod.get(FeatureflipClient).isInitialized).toBe(true);
    expect(calls[0].url).toContain('https://cfg.example.test');
    await mod.close();
  });

  it('closes the client when the application shuts down', async () => {
    stubFetch();
    const close = vi.spyOn(FeatureflipClient.prototype, 'close');
    const mod = await Test.createTestingModule({
      imports: [FeatureflipModule.forRoot({ sdkKey: nextKey(), streaming: false })],
    }).compile();
    await mod.init();
    expect(close).not.toHaveBeenCalled();

    await mod.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error from forRoot when the key is missing', () => {
    expect(() => FeatureflipModule.forRoot({ sdkKey: '' })).toThrow(/sdkKey is required/);
    expect(() => FeatureflipModule.forRoot({} as never)).toThrow(/sdkKey is required/);
  });

  it('rejects compile when forRootAsync resolves no key, without echoing any key', async () => {
    const secret = 'sdk-secret-should-never-appear';
    const attempt = Test.createTestingModule({
      imports: [FeatureflipModule.forRootAsync({ useFactory: () => ({ sdkKey: '', baseUrl: secret }) })],
    }).compile();

    const err = await attempt.then(
      () => undefined,
      (e: Error) => e,
    );
    expect(err?.message).toMatch(/sdkKey is required/);
    expect(err?.message).not.toContain(secret);
  });
});
