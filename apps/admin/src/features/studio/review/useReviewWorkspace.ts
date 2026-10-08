import { useVersionComments } from '@english-saas/api-client';
import type { ContentStatus } from '@english-saas/shared';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { QaStep } from '../lib/qa-path';
import type { CommentAbout, ReviewContextValue } from './ReviewContext';
import { useAudioController } from './useAudioController';
import { WHOLE_LESSON } from './useCommentsController';
import { useQaController } from './useQaController';

/** As abas do painel lateral do editor. O valor é o que vai em `?painel=`. */
export const REVIEW_TABS = [
  'preview',
  'revisao',
  'comentarios',
  'audio',
] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export type ReviewWorkspaceInput = {
  versionId: string;
  status: ContentStatus;
  /** As etapas como estão no editor agora. */
  steps: readonly QaStep[];
  /** Quando o editor salvou pela última vez (ms). */
  savedAt: number | null;
  /** Mostra o painel lateral se estiver escondido. */
  revealPanel: () => void;
};

/**
 * O estado da revisão no editor da versão: qual aba está aberta (na URL),
 * o relatório da revisão automática, os comentários abertos e o áudio. Fica
 * um nível acima das abas porque o resto do editor também precisa disso — os
 * botões "Comentar", a contagem nas etapas e as travas de aprovar e publicar.
 */
export function useReviewWorkspace({
  versionId,
  status,
  steps,
  savedAt,
  revealPanel,
}: ReviewWorkspaceInput) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('painel');
  const tab: ReviewTab =
    REVIEW_TABS.find((entry) => entry === raw) ?? 'preview';
  const [about, setAbout] = useState<CommentAbout>(WHOLE_LESSON);

  const qa = useQaController({ versionId, steps, savedAt });
  const audio = useAudioController({ versionId, status });
  const open = useVersionComments(versionId, false);

  function setTab(next: ReviewTab): void {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);

        if (next === 'preview') {
          copy.delete('painel');
        } else {
          copy.set('painel', next);
        }

        return copy;
      },
      { replace: true },
    );
  }

  const counts = useMemo(() => {
    const byStep: Record<string, number> = {};
    const byItem: Record<string, number> = {};
    let total = 0;

    for (const comment of open.data ?? []) {
      if (comment.target === 'AUDIO') {
        continue;
      }

      total += 1;

      if (comment.target === 'STEP' && comment.targetRef !== null) {
        byStep[comment.targetRef] = (byStep[comment.targetRef] ?? 0) + 1;
      }

      if (comment.target === 'ITEM' && comment.targetRef !== null) {
        byItem[comment.targetRef] = (byItem[comment.targetRef] ?? 0) + 1;
      }
    }

    return { byStep, byItem, total };
  }, [open.data]);

  const context: ReviewContextValue = {
    openByStep: counts.byStep,
    openByItem: counts.byItem,
    comment: (next) => {
      setAbout(next);
      revealPanel();
      setTab('comentarios');
    },
  };

  return {
    tab,
    setTab,
    qa,
    audio,
    about,
    setAbout,
    openComments: counts.total,
    context,
    /** Aprovar fica travado com bloqueador aberto no último relatório. */
    approveBlocked: status === 'IN_REVIEW' && qa.blockers.length > 0,
    /** Publicar fica travado enquanto falta áudio. */
    publishBlocked: status === 'APPROVED' && audio.pending > 0,
  };
}

export type ReviewWorkspace = ReturnType<typeof useReviewWorkspace>;
