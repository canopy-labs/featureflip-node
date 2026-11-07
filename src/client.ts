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
  SnapshotStore,
  StartupInfo,
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
  /**
   * Opt-in persistence of the last good flag config, so a process that starts
   * while the Evaluation API is unreachable serves the stored flags instead of
   * defaults. Use `new FileSnapshotStore(path)` for a file store, or supply any
   * `{ get(): Promise<string | undefined>; put(text: string): Promise<void> }`.
   * The store holds opaque text: the SDK writes and checks the envelope itself,
   * including which SDK key and base URL it belongs to.
   *
   * The snapshot contains your targeting rules, including customer attribute
   * values used in conditions. `FileSnapshotStore` writes owner-only (0600)
   * files on POSIX systems; protect any other store accordingly. Ephemeral
   * container disks lose the file on redeploy, so mount a volume if you need
   * it to survive.
   *
   * Honored only on the first `get()` per SDK key (the shared core is built
   * once, like `inspectors`); a later call with the same key logs a warning
   * and ignores it.
   */
  snapshotStore?: SnapshotStore;
  /**
   * Maximum age in seconds of a stored snapshot that may still be served.
   * Defaults to 86400. Only used with `snapshotStore`, and like it only
   * honored on the first `get()` per SDK key.
   */
  maxSnapshotAgeSeconds?: number;
  /**
   * `name/version` tokens for libraries that wrap this SDK, such as an
   * OpenFeature provider. Sent in order after this SDK's own
   * `featureflip-node/<version>` token, so usage through each can be counted.
   * An invalid token is ignored with a warning.
   */
  wrappers?: string[];
}

/**
 * Identifies this package to the Evaluation API (#4145). The js SDK sends its own
 * token first, so requests read `featureflip-js/<v> featureflip-node/<v>`.
 */
const NODE_SDK_TOKEN = `featureflip-node/${__NODE_SDK_VERSION__}`;

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
        wrappers: [NODE_SDK_TOKEN, ...(config.wrappers ?? [])],
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

  /** Where initial flag data came from: `live`, `snapshot` or `none`. */
  get startupInfo(): StartupInfo {
    return this.inner.startupInfo;
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
