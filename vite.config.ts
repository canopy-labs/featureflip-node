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
      rollupTypes: true,
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => {
        const ext = format === 'es' ? 'mjs' : 'cjs';
        return `index.${ext}`;
      },
    },
    rolldownOptions: {
      external: [
        '@featureflip/js',
        'eventsource',
        'crypto',
        'module',
      ],
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
