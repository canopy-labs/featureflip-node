import {
  FeatureflipClient as InnerClient,
  createNodePlatform,
} from '@featureflip/js';
import type {
  EvaluationContext,
  EvaluationDetail,
  EvaluationInspector,
  FeatureflipEvent,
  FlagUpdateListener,
} from '@featureflip/js';

export interface NodeFeatureflipConfig {
  sdkKey: string;
  baseUrl?: string;
  streaming?: boolean;
  pollInterval?: number;
  flushInterval?: number;
  flushBatchSize?: number;
  initTimeout?: number;
  maxStreamRetries?: number;
  /** In-process observers fired on every flag evaluation. */
  inspectors?: EvaluationInspector[];
}

const DEFAULT_BASE_URL = 'https://eval.featureflip.io';

/**
 * Node.js server SDK wrapper around `@featureflip/js`. Instances are obtained
 * via the static factory `FeatureflipClient.get(config)`; direct instantiation
 * is not supported. Multiple `get` calls with the same SDK key return handles
 * sharing one underlying client (refcounted).
 */
export class FeatureflipClient {
  private readonly inner: InnerClient;

  private constructor(inner: InnerClient) {
    this.inner = inner;
  }

  /**
   * Returns a client for the given SDK key. First call constructs the shared
   * core; later calls with the same key return handles sharing the core.
   */
  static get(config: NodeFeatureflipConfig): FeatureflipClient {
    const inner = InnerClient.get(
      {
        ...config,
        baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      },
      createNodePlatform(),
    );
    return new FeatureflipClient(inner);
  }

  /**
   * Convenience: get a client and wait for initialization before returning it.
   */
  static async create(config: NodeFeatureflipConfig): Promise<FeatureflipClient> {
    const client = FeatureflipClient.get(config);
    await client.waitForInitialization();
    return client;
  }

  get isInitialized(): boolean {
    return this.inner.isInitialized;
  }

  async waitForInitialization(): Promise<void> {
    return this.inner.waitForInitialization();
  }

  boolVariation(key: string, context: EvaluationContext, defaultValue: boolean): boolean {
    return this.inner.boolVariation(key, context, defaultValue);
  }

  stringVariation(key: string, context: EvaluationContext, defaultValue: string): string {
    return this.inner.stringVariation(key, context, defaultValue);
  }

  numberVariation(key: string, context: EvaluationContext, defaultValue: number): number {
    return this.inner.numberVariation(key, context, defaultValue);
  }

  jsonVariation<T>(key: string, context: EvaluationContext, defaultValue: T): T {
    return this.inner.jsonVariation(key, context, defaultValue);
  }

  variationDetail<T>(key: string, context: EvaluationContext, defaultValue: T): EvaluationDetail<T> {
    return this.inner.variationDetail(key, context, defaultValue);
  }

  track(eventKey: string, context: EvaluationContext, metadata?: Record<string, unknown>): void {
    this.inner.track(eventKey, context, metadata);
  }

  identify(context: EvaluationContext): void {
    this.inner.identify(context);
  }

  /**
   * Subscribe to flag-configuration updates. The listener receives the keys of
   * the flags affected by each update, batched into one call. It does not fire
   * for the initial flag load. Returns an unsubscribe function; listeners are
   * also dropped when this handle is closed.
   */
  on(event: FeatureflipEvent, listener: FlagUpdateListener): () => void {
    return this.inner.on(event, listener);
  }

  /** Remove a listener previously registered with {@link on}. */
  off(event: FeatureflipEvent, listener: FlagUpdateListener): void {
    this.inner.off(event, listener);
  }

  async flush(): Promise<void> {
    return this.inner.flush();
  }

  async close(): Promise<void> {
    return this.inner.close();
  }

  static forTesting(flags: Record<string, unknown>): FeatureflipClient {
    return new FeatureflipClient(InnerClient.forTesting(flags));
  }
}
