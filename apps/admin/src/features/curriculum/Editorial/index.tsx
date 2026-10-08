import type { AdminVersion } from '@english-saas/api-client';
import type { ContentStatus, LessonStepType } from '@english-saas/shared';
import type { ReactNode } from 'react';
import { Button } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { EditorialAction } from '../lib/editorial';
import { ProblemPanel } from './ProblemPanel';
import { useEditorialController } from './useEditorialController';

export type EditorialActionsProps = {
  versionId: string;
  versionNumber: number;
  status: ContentStatus;
  beforeAction?: () => Promise<void>;
  onTransitioned?: (version: AdminVersion) => void;
  stepTypes?: readonly LessonStepType[];
  onJumpToIssue?: (order: number, path: string) => void;
  editorHref?: string;
  size?: 'sm' | 'md';
  /**
   * Ações travadas por algo de fora do fluxo (bloqueador da revisão
   * automática, áudio faltando): o botão fica desabilitado e o motivo — a
   * lista do que falta — aparece logo abaixo. A API continua sendo quem decide.
   */
  guards?: Partial<Record<EditorialAction, ReactNode>>;
};

/**
 * Botões do fluxo editorial de uma versão, conforme o status, com a
 * confirmação de publicar e arquivar e o painel de problemas quando a API
 * recusa (conteúdo inválido, referência faltando, bloqueio da revisão
 * automática, áudio ainda sem gerar).
 */
export function EditorialActions({
  versionId,
  versionNumber,
  status,
  beforeAction,
  onTransitioned,
  stepTypes,
  onJumpToIssue,
  editorHref,
  size = 'md',
  guards = {},
}: EditorialActionsProps) {
  const controller = useEditorialController({
    versionId,
    status,
    beforeAction,
    onTransitioned,
  });
  const confirmKey =
    controller.confirming === 'archive' ? 'archive' : 'publish';

  return (
    <div className="space-y-3">
      {controller.actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {controller.actions.map((action, index) => (
            <Button
              key={action}
              size={size}
              variant={index === 0 ? 'primary' : 'ghost'}
              disabled={controller.isRunning || guards[action] !== undefined}
              onClick={() => controller.request(action)}
            >
              {t(`editorial.action.${action}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {controller.actions.map((action) =>
        guards[action] === undefined ? null : (
          <div key={`guard-${action}`}>{guards[action]}</div>
        ),
      )}

      {controller.problem ? (
        <ProblemPanel
          problem={controller.problem}
          stepTypes={stepTypes}
          onJumpToIssue={onJumpToIssue}
          editorHref={editorHref}
          onDismiss={controller.dismissProblem}
        />
      ) : null}

      <ConfirmDialog
        open={controller.confirming !== null}
        title={t(`editorial.confirm.${confirmKey}.title`)}
        description={t(`editorial.confirm.${confirmKey}.description`, {
          version: versionNumber,
        })}
        confirmLabel={t(`editorial.action.${confirmKey}`)}
        danger={controller.confirming === 'archive'}
        isLoading={controller.isRunning}
        onConfirm={controller.confirm}
        onCancel={controller.cancelConfirm}
      />
    </div>
  );
}
