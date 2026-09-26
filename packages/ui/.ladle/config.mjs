/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/components/**/*.stories.tsx',
  addons: {
    a11y: { enabled: true },
    theme: { enabled: true },
  },
  outDir: 'dist-ladle',
  // Caminho (string) para um vite.config — o Ladle carrega via loadConfigFromFile.
  viteConfig: 'ladle.vite.config.ts',
};
