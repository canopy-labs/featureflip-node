import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// A consumer who never installs NestJS must be able to load @featureflip/node.
// `@nestjs/common` is an optional peer dependency, so the main entry (and any
// chunk it shares) must never reference it. The nestjs entry must keep it external.
const pkgDir = resolve(__dirname, '../..');
const dist = (f: string) => resolve(pkgDir, 'dist', f);

beforeAll(() => {
  if (!existsSync(dist('index.mjs')) || !existsSync(dist('nestjs/index.mjs'))) {
    execFileSync('npm', ['run', 'build'], {
      cwd: pkgDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  }
}, 180_000);

describe('NestJS stays optional', () => {
  it.each(['index.mjs', 'index.cjs'])('the main entry dist/%s does not mention nestjs', (file) => {
    expect(readFileSync(dist(file), 'utf8')).not.toMatch(/nestjs/);
  });

  it('every chunk the main entry loads is free of nestjs', () => {
    const main = readFileSync(dist('index.mjs'), 'utf8');
    const chunks = [...main.matchAll(/from\s+["']\.\/([^"']+)["']/g)].map((m) => m[1]);
    for (const chunk of chunks) {
      expect(readFileSync(dist(chunk), 'utf8')).not.toMatch(/nestjs/);
    }
  });

  it('the main entry loads in a process where @nestjs/common cannot be resolved', () => {
    // --import of a loader hook that rejects @nestjs/* proves nothing is pulled in.
    const out = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { register } from 'node:module';
         register('data:text/javascript,' + encodeURIComponent(
           "export async function resolve(s, c, n) { if (s.startsWith('@nestjs/')) throw new Error('nest resolved'); return n(s, c); }"
         ));
         const m = await import(${JSON.stringify(dist('index.mjs'))});
         console.log(typeof m.FeatureflipClient);`,
      ],
      { encoding: 'utf8' },
    );
    expect(out.trim()).toBe('function');
  });

  // The module tests run against src, so only these check the BUILT entries,
  // where the version lookup once silently fell back to the node SDK version:
  // `node:module` wasn't external (the bundler stubbed it empty), and the CJS
  // build has no import.meta.url. Most Nest apps load the CJS one.
  it.each(['index.cjs', 'index.mjs'])('dist/nestjs/%s reports the installed Nest version', (file) => {
    const nestVersion = JSON.parse(
      readFileSync(require.resolve('@nestjs/common/package.json', { paths: [pkgDir] }), 'utf8'),
    ).version as string;
    const out = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { createRequire } from 'node:module';
         const req = createRequire(${JSON.stringify(resolve(pkgDir, 'package.json'))});
         req('reflect-metadata');
         let ua;
         globalThis.fetch = async (url, init) => {
           ua = init.headers['User-Agent'];
           return new Response(JSON.stringify({ environment: 'e', version: 1, flags: [], segments: [] }), { status: 200 });
         };
         const { Test } = req('@nestjs/testing');
         const entry = ${JSON.stringify(dist(`nestjs/${file}`))};
         const m = entry.endsWith('.cjs') ? req(entry) : await import(entry);
         const mod = await Test.createTestingModule({
           imports: [m.FeatureflipModule.forRoot({ sdkKey: 'sdk-dist-probe-${file}', streaming: false })],
         }).compile();
         await mod.get(m.FEATUREFLIP_CLIENT).close();
         console.log(ua);`,
      ],
      { cwd: pkgDir, encoding: 'utf8' },
    );
    expect(out.trim().split(' ').at(-1)).toBe(`featureflip-nestjs/${nestVersion}`);
  });

  it('the nestjs entry keeps @nestjs/common external', () => {
    const src = readFileSync(dist('nestjs/index.mjs'), 'utf8');
    expect(src).toMatch(/from\s+["']@nestjs\/common["']/);
  });
});
