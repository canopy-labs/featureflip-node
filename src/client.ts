import {
  FeatureflipClient as InnerClient,
  createNodePlatform,
} from '@featureflip/js';
import type {
  EvaluationContext,
  EvaluationDetail,
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
}

const DEFAULT_BASE_URL = 'https://eval.featureflip.io';

export class FeatureflipClient {
  private readonly inner: InnerClient;

  constructor(config: NodeFeatureflipConfig) {
    const platform = createNodePlatform();
    this.inner = new InnerClient(
      {
        ...config,
        baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      },
      platform,
    );
  }

  static async create(config: NodeFeatureflipConfig): Promise<FeatureflipClient> {
    const client = new FeatureflipClient(config);
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

  async flush(): Promise<void> {
    return this.inner.flush();
  }

  async close(): Promise<void> {
    return this.inner.close();
  }

  static forTesting(flags: Record<string, unknown>): FeatureflipClient {
    const client = Object.create(FeatureflipClient.prototype) as FeatureflipClient;
    (client as unknown as { inner: InnerClient }).inner = InnerClient.forTesting(flags);
    return client;
  }
}
