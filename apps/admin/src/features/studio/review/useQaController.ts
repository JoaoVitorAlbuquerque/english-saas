import {
  useQaReport,
  useRunQa,
  type ApiError,
  type QaWarning,
} from '@english-saas/api-client';
import { useMemo } from 'react';

import { locateQaPath, type QaLocation, type QaStep } from '../lib/qa-path';

export type LocatedWarning = QaWarning & { location: QaLocation };

export type QaControllerInput = {
  versionId: string;
  /** As etapas como estão no editor agora: o caminho do aviso aponta para elas. */
  steps: readonly QaStep[];
  /** Quando o editor salvou pela última vez (ms): depois do relatório = desatualizado. */
  savedAt: number | null;
  enabled?: boolean;
};

/**
 * O relatório da revisão automática da versão: os avisos por gravidade, cada
 * um com o trecho a que leva, e se o relatório ainda vale (o editor salvou
 * depois dele?). Rodar de novo reavalia o conteúdo de agora.
 */
export function useQaController({
  versionId,
  steps,
  savedAt,
  enabled = true,
}: QaControllerInput) {
  const query = useQaReport(versionId, enabled);
  const run = useRunQa(versionId);
  const report = query.data ?? null;

  const warnings = useMemo<LocatedWarning[]>(
    () =>
      (report?.warnings ?? []).map((warning) => ({
        ...warning,
        location: locateQaPath(warning.path, steps),
      })),
    [report, steps],
  );

  const stale =
    report !== null && savedAt !== null && savedAt > Date.parse(report.ranAt);

  return {
    report,
    isLoading: enabled && query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    blockers: warnings.filter((warning) => warning.severity === 'BLOCKER'),
    warnings: warnings.filter((warning) => warning.severity === 'WARNING'),
    infos: warnings.filter((warning) => warning.severity === 'INFO'),
    stale,
    run: () => run.mutate(),
    isRunning: run.isPending,
    runError: run.error as ApiError | null,
  };
}

export type QaController = ReturnType<typeof useQaController>;
