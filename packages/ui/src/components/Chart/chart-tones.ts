import type { CSSProperties } from 'react';

/**
 * Cores dos gráficos: só tokens do design system, então claro e escuro saem
 * de graça. A cor nunca vai sozinha — `hatched` troca o preenchimento por
 * listras, e todo valor tem rótulo de texto.
 */
export type ChartTone = 'accent' | 'chunk' | 'ok' | 'error' | 'muted';

/** Define `currentColor` para barras, legenda e marcadores. */
export const TONE_TEXT_CLASS: Record<ChartTone, string> = {
  accent: 'text-accent',
  chunk: 'text-chunk',
  ok: 'text-ok',
  error: 'text-error',
  muted: 'text-muted',
};

/** Listras a 45° na cor atual — o "listrado" que não depende de matiz. */
export const HATCH_STYLE: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, currentColor 0, currentColor 2px, transparent 2px, transparent 6px)',
};
