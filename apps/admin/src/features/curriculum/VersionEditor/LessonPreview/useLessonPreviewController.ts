import { useVersionPreview } from '@english-saas/api-client';
import {
  parseStep,
  type ParsedStep,
  type StepIssue,
} from '@english-saas/shared';
import { useEffect, useMemo, useState } from 'react';

export type PreviewDevice = 'phone' | 'desktop';

export type PreviewStep =
  | { ok: true; order: number; step: ParsedStep }
  | { ok: false; order: number; type: string; issues: StepIssue[] };

/**
 * O preview lê a lição **do servidor** (áudio assinado, itens sem gabarito)
 * e refaz a leitura a cada salvamento. Cada etapa passa por `parseStep`
 * antes de ser desenhada: rascunho pela metade vira um aviso naquela etapa,
 * não uma tela quebrada.
 */
export function useLessonPreviewController({
  versionId,
  savedAt,
}: {
  versionId: string;
  /** Instante do último salvamento: muda, o preview se refaz. */
  savedAt: number | null;
}) {
  const preview = useVersionPreview(versionId);
  const [device, setDevice] = useState<PreviewDevice>('phone');
  const [position, setPosition] = useState(0);

  const { refetch } = preview;

  useEffect(() => {
    if (savedAt !== null) {
      void refetch();
    }
  }, [savedAt, refetch]);

  const steps = useMemo<PreviewStep[]>(
    () =>
      (preview.data?.steps ?? []).map((raw) => {
        const result = parseStep(raw);

        return result.ok
          ? { ok: true, order: raw.order, step: result.step }
          : {
              ok: false,
              order: raw.order,
              type: raw.type,
              issues: result.issues,
            };
      }),
    [preview.data],
  );

  const current = Math.min(position, Math.max(steps.length - 1, 0));

  return {
    isLoading: preview.isPending,
    error: preview.error,
    isRefreshing: preview.isFetching && !preview.isPending,
    retry: () => void refetch(),
    data: preview.data ?? null,
    steps,
    device,
    setDevice,
    position: current,
    select: setPosition,
    next: () => setPosition(Math.min(current + 1, steps.length - 1)),
  };
}
