import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureflipClient } from '../src/client.js';

// Mock the JS SDK
vi.mock('@featureflip/js', () => {
  const mockClient = {
    isInitialized: false,
    waitForInitialization: vi.fn(),
    boolVariation: vi.fn(),
    stringVariation: vi.fn(),
    numberVariation: vi.fn(),
    jsonVariation: vi.fn(),
    variationDetail: vi.fn(),
    track: vi.fn(),
    identify: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
  };

  const MockInnerClient = vi.fn().mockImplementation(function () { return mockClient; });
  (MockInnerClient as unknown as Record<string, unknown>).forTesting = vi.fn().mockImplementation(function () { return mockClient; });

  return {
    FeatureflipClient: MockInnerClient,
    createNodePlatform: vi.fn().mockReturnValue({}),
    __mockClient: mockClient,
  };
});

async function getMockClient() {
  const mod = await import('@featureflip/js');
  return (mod as unknown as { __mockClient: Record<string, ReturnType<typeof vi.fn>> }).__mockClient;
}

describe('FeatureflipClient (Node SDK)', () => {
  let mockInner: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockInner = await getMockClient();
    vi.clearAllMocks();
    mockInner.isInitialized = false as unknown as ReturnType<typeof vi.fn>;
  });

  describe('constructor', () => {
    it('creates inner client with node platform and default baseUrl', async () => {
      const { FeatureflipClient: InnerClient, createNodePlatform } = await import('@featureflip/js');

      new FeatureflipClient({ sdkKey: 'test-key' });

      expect(createNodePlatform).toHaveBeenCalled();
      expect(InnerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          sdkKey: 'test-key',
          baseUrl: 'https://eval.featureflip.io',
        }),
        expect.anything(),
      );
    });

    it('respects custom baseUrl', async () => {
      const { FeatureflipClient: InnerClient } = await import('@featureflip/js');

      new FeatureflipClient({ sdkKey: 'test-key', baseUrl: 'http://localhost:5000' });

      expect(InnerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://localhost:5000',
        }),
        expect.anything(),
      );
    });
  });

  describe('create()', () => {
    it('returns initialized client', async () => {
      mockInner.waitForInitialization.mockResolvedValue(undefined);

      const client = await FeatureflipClient.create({ sdkKey: 'test-key' });

      expect(mockInner.waitForInitialization).toHaveBeenCalled();
      expect(client).toBeInstanceOf(FeatureflipClient);
    });

    it('rejects if initialization fails', async () => {
      mockInner.waitForInitialization.mockRejectedValue(new Error('timeout'));

      await expect(
        FeatureflipClient.create({ sdkKey: 'test-key' }),
      ).rejects.toThrow('timeout');
    });
  });

  describe('variation methods', () => {
    it('delegates boolVariation', () => {
      mockInner.boolVariation.mockReturnValue(true);
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      const result = client.boolVariation('flag', { user_id: '1' }, false);

      expect(result).toBe(true);
      expect(mockInner.boolVariation).toHaveBeenCalledWith('flag', { user_id: '1' }, false);
    });

    it('delegates stringVariation', () => {
      mockInner.stringVariation.mockReturnValue('value');
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      expect(client.stringVariation('flag', {}, 'default')).toBe('value');
    });

    it('delegates numberVariation', () => {
      mockInner.numberVariation.mockReturnValue(42);
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      expect(client.numberVariation('flag', {}, 0)).toBe(42);
    });

    it('delegates jsonVariation', () => {
      mockInner.jsonVariation.mockReturnValue({ a: 1 });
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      expect(client.jsonVariation('flag', {}, {})).toEqual({ a: 1 });
    });

    it('delegates variationDetail', () => {
      const detail = { value: true, reason: 'Fallthrough' };
      mockInner.variationDetail.mockReturnValue(detail);
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      expect(client.variationDetail('flag', {}, false)).toEqual(detail);
    });
  });

  describe('events', () => {
    it('delegates track', () => {
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      client.track('purchase', { user_id: '1' }, { amount: 10 });

      expect(mockInner.track).toHaveBeenCalledWith('purchase', { user_id: '1' }, { amount: 10 });
    });

    it('delegates identify', () => {
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      client.identify({ user_id: '1', plan: 'pro' });

      expect(mockInner.identify).toHaveBeenCalledWith({ user_id: '1', plan: 'pro' });
    });

    it('delegates flush', async () => {
      mockInner.flush.mockResolvedValue(undefined);
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      await client.flush();

      expect(mockInner.flush).toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('delegates close', async () => {
      mockInner.close.mockResolvedValue(undefined);
      const client = new FeatureflipClient({ sdkKey: 'test-key' });

      await client.close();

      expect(mockInner.close).toHaveBeenCalled();
    });
  });

  describe('forTesting', () => {
    it('creates a test client that evaluates flags', () => {
      // forTesting uses the real InnerClient.forTesting, but since we've mocked the module,
      // we just verify it returns a FeatureflipClient instance
      const client = FeatureflipClient.forTesting({ 'flag': true });
      expect(client).toBeInstanceOf(FeatureflipClient);
    });
  });
});
