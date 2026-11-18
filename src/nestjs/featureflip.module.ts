/// <reference types="node" />
import { createRequire } from 'node:module';
import { Global, Inject, Module } from '@nestjs/common';
import type { DynamicModule, InjectionToken, ModuleMetadata, OnApplicationShutdown } from '@nestjs/common';
import { FeatureflipClient } from '../client.js';
import type { NodeFeatureflipConfig } from '../client.js';

/** Injection token for the client. The `FeatureflipClient` class itself also works as a token. */
export const FEATUREFLIP_CLIENT = Symbol('FEATUREFLIP_CLIENT');

/** Parameter decorator: `constructor(@InjectFeatureflip() private readonly flags: FeatureflipClient)`. */
export const InjectFeatureflip = (): ParameterDecorator => Inject(FEATUREFLIP_CLIENT);

export interface FeatureflipModuleOptions extends NodeFeatureflipConfig {
  /**
   * Hold application bootstrap until the client has loaded its flags (or
   * `initTimeout` has passed). Defaults to `true`, so the first request never
   * evaluates against an empty flag store. Set `false` to start immediately and
   * serve defaults until the flags arrive.
   */
  waitForInitialization?: boolean;
}

export interface FeatureflipModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: InjectionToken[];
  useFactory: (...args: any[]) => FeatureflipModuleOptions | Promise<FeatureflipModuleOptions>;
}

/** The installed @nestjs/common version, or this package's version when it cannot be read. */
function nestVersion(): string {
  try {
    // The CJS build has no import.meta.url (the bundler rewrites it to undefined),
    // so resolve from __filename there. Don't test `typeof require`: the ESM build
    // gets a bundler shim for require that throws when called.
    const base = typeof __filename === 'string' ? __filename : import.meta.url;
    const v = (createRequire(base)('@nestjs/common/package.json') as { version?: unknown }).version;
    if (typeof v === 'string' && /^[\w.+-]+$/.test(v)) return v;
  } catch {
    // fall through
  }
  return __NODE_SDK_VERSION__;
}

/** Appended after the node SDK's own token so usage through this module is countable. */
const NESTJS_TOKEN = `featureflip-nestjs/${nestVersion()}`;
const hasNestToken = (wrappers: string[]) => wrappers.some((w) => w.startsWith('featureflip-nestjs/'));

async function createClient(options: FeatureflipModuleOptions): Promise<FeatureflipClient> {
  // Never echo the options here: they carry the SDK key.
  if (!options || typeof options.sdkKey !== 'string' || options.sdkKey.trim() === '') {
    throw new Error('FeatureflipModule: sdkKey is required');
  }
  const { waitForInitialization = true, wrappers, ...config } = options;
  const client = FeatureflipClient.get({ ...config, wrappers: hasNestToken(wrappers ?? []) ? wrappers : [NESTJS_TOKEN, ...(wrappers ?? [])] });
  if (waitForInitialization) {
    await client.waitForInitialization();
  }
  return client;
}

const OPTIONS = Symbol('FEATUREFLIP_OPTIONS');

/**
 * Registers one `FeatureflipClient` for the whole application. Global, so
 * import it once in the root module. The client is closed on application
 * shutdown (call `app.enableShutdownHooks()` to have signals trigger that).
 */
export class FeatureflipModule implements OnApplicationShutdown {
  constructor(private readonly client: FeatureflipClient) {}

  static forRoot(options: FeatureflipModuleOptions): DynamicModule {
    if (!options || typeof options.sdkKey !== 'string' || options.sdkKey.trim() === '') {
      throw new Error('FeatureflipModule: sdkKey is required');
    }
    return {
      module: FeatureflipModule,
      global: true,
      providers: clientProviders({ provide: OPTIONS, useValue: options }),
      exports: [FEATUREFLIP_CLIENT, FeatureflipClient],
    };
  }

  static forRootAsync(options: FeatureflipModuleAsyncOptions): DynamicModule {
    return {
      module: FeatureflipModule,
      global: true,
      imports: options.imports ?? [],
      providers: clientProviders({ provide: OPTIONS, useFactory: options.useFactory, inject: options.inject ?? [] }),
      exports: [FEATUREFLIP_CLIENT, FeatureflipClient],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

// Applied as plain calls, not `@` syntax: the legacy parameter decorator needs
// `experimentalDecorators`, and this keeps that out of the package's tsconfig and build.
Global()(FeatureflipModule);
Module({})(FeatureflipModule);
Inject(FEATUREFLIP_CLIENT)(FeatureflipModule, undefined, 0);

function clientProviders(options: object): NonNullable<DynamicModule['providers']> {
  return [
    options as never,
    { provide: FEATUREFLIP_CLIENT, useFactory: createClient, inject: [OPTIONS] },
    { provide: FeatureflipClient, useExisting: FEATUREFLIP_CLIENT },
  ];
}
