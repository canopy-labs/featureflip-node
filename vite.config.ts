import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// `npm version` (publish-npm.yml) bumps package.json only, so package.json is the
// single source of this package's version. Inlined for the featureflip-node
// identity token (#4145) so it cannot drift the way a literal would (#2141).
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string };

export default defineConfig({
  define: {
    __NODE_SDK_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    dts({
      // bundleTypes rolls the declarations up with api-extractor. unplugin-dts
      // hands it the workspace's `typescript` as its compiler, but that is TS7,
      // which ships no lib .d.ts files, so no global resolves ("Unable to follow
      // symbol for Promise"). Unsetting the folder makes api-extractor fall back
      // to the TypeScript it bundles.
      bundleTypes: { invokeOptions: { typescriptCompilerFolder: undefined } },
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      // The nestjs entry is a separate subpath (`@featureflip/node/nestjs`) so
      // the main entry never references @nestjs/common.
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'nestjs/index': resolve(__dirname, 'src/nestjs/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'mjs' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    rolldownOptions: {
      external: [
        '@featureflip/js',
        'eventsource',
        'crypto',
        'module',
        // Node built-ins by their node: name. Without this the bundler swaps in an
        // empty stub, so e.g. createRequire from 'node:module' is undefined at runtime.
        /^node:/,
        /^@nestjs\//,
        'reflect-metadata',
      ],
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
