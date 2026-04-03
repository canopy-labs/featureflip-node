import { EvaluationContext } from '@featureflip/js';
import { EvaluationDetail } from '@featureflip/js';
import { EvaluationReason } from '@featureflip/js';
import { FlagType } from '@featureflip/js';

export { EvaluationContext }

export { EvaluationDetail }

export { EvaluationReason }

export declare class FeatureflipClient {
    private readonly inner;
    constructor(config: NodeFeatureflipConfig);
    static create(config: NodeFeatureflipConfig): Promise<FeatureflipClient>;
    get isInitialized(): boolean;
    waitForInitialization(): Promise<void>;
    boolVariation(key: string, context: EvaluationContext, defaultValue: boolean): boolean;
    stringVariation(key: string, context: EvaluationContext, defaultValue: string): string;
    numberVariation(key: string, context: EvaluationContext, defaultValue: number): number;
    jsonVariation<T>(key: string, context: EvaluationContext, defaultValue: T): T;
    variationDetail<T>(key: string, context: EvaluationContext, defaultValue: T): EvaluationDetail<T>;
    track(eventKey: string, context: EvaluationContext, metadata?: Record<string, unknown>): void;
    identify(context: EvaluationContext): void;
    flush(): Promise<void>;
    close(): Promise<void>;
    static forTesting(flags: Record<string, unknown>): FeatureflipClient;
}

export { FlagType }

export declare interface NodeFeatureflipConfig {
    sdkKey: string;
    baseUrl?: string;
    streaming?: boolean;
    pollInterval?: number;
    flushInterval?: number;
    flushBatchSize?: number;
    initTimeout?: number;
    maxStreamRetries?: number;
}

export { }
