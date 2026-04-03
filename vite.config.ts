import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
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
