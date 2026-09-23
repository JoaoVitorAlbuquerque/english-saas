import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // A API (NestJS) consome CJS; a web (Vite) consome ESM.
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
});
