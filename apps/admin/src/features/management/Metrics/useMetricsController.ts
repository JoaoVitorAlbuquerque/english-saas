import { METRICS_MAX_DAYS, useAdminMetrics } from '@english-saas/api-client';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  PERIOD_PRESETS,
  presetOf,
  presetRange,
  rangeProblem,
  type PeriodPreset,
  type RangeProblem,
} from '../lib/period';

export const METRICS_TABS = ['engajamento', 'conteudo', 'custos'] as const;
export type MetricsTab = (typeof METRICS_TABS)[number];

/** O padrão da API: 30 dias até ontem. */
const DEFAULT_DAYS: PeriodPreset = 30;

function isTab(value: string | null): value is MetricsTab {
  return METRICS_TABS.some((tab) => tab === value);
}

export function useMetricsController() {
  const [params, setParams] = useSearchParams();
  const from = params.get('de');
  const to = params.get('ate');
  const range =
    from !== null && to !== null && rangeProblem(from, to) === null
      ? { from, to }
      : null;
  const tabParam = params.get('aba');
  const tab: MetricsTab = isTab(tabParam) ? tabParam : 'engajamento';

  // O padrão (sem `de`/`ate`) mostra, na resposta, até que dia a API foi — é a
  // âncora dos atalhos. Com o padrão ativo, as duas leituras são a mesma.
  const anchor = useAdminMetrics(null);
  const query = useAdminMetrics(range);
  const anchorTo = anchor.data?.period.to ?? null;

  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [problem, setProblem] = useState<RangeProblem | null>(null);

  function update(next: Record<string, string | null>): void {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);

        for (const [key, value] of Object.entries(next)) {
          if (value === null) {
            merged.delete(key);
          } else {
            merged.set(key, value);
          }
        }

        return merged;
      },
      { replace: true },
    );
  }

  const activePreset: PeriodPreset | null =
    range === null
      ? DEFAULT_DAYS
      : anchorTo === null
        ? null
        : presetOf(range, anchorTo);

  return {
    tab,
    setTab: (next: string) => {
      if (isTab(next)) {
        update({ aba: next });
      }
    },
    presets: PERIOD_PRESETS,
    activePreset,
    isCustom: range !== null && activePreset === null,
    canUsePresets: anchorTo !== null,
    choosePreset: (days: PeriodPreset) => {
      setCustomOpen(false);
      setProblem(null);

      if (days === DEFAULT_DAYS) {
        update({ de: null, ate: null });
      } else if (anchorTo !== null) {
        const next = presetRange(anchorTo, days);
        update({ de: next.from, ate: next.to });
      }
    },
    customOpen,
    openCustom: () => {
      const current = query.data?.period;

      setCustomFrom(current?.from ?? '');
      setCustomTo(current?.to ?? '');
      setProblem(null);
      setCustomOpen(true);
    },
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    problem,
    maxDays: METRICS_MAX_DAYS,
    applyCustom: () => {
      const found = rangeProblem(customFrom, customTo);
      setProblem(found);

      if (found === null) {
        update({ de: customFrom, ate: customTo });
      }
    },
    metrics: query.data,
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
