import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/** Config extra do Vite só para o Ladle enxergar o plugin do Tailwind v4. */
export default defineConfig({
  plugins: [tailwindcss()],
});
