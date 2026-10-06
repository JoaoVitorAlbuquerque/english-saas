import type { AdminItemDetail } from '@english-saas/api-client';
import { Button } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { ConfirmDialog } from '../../../curriculum/components/ConfirmDialog';
import type { EditorialAction } from '../../../curriculum/lib/editorial';
import { ItemProblemPanel } from './ItemProblemPanel';
import { useItemEditorialController } from './useItemEditorialController';

const VARIANTS: Record<EditorialAction, 'primary' | 'ghost' | 'danger'> = {
  'submit-for-review': 'primary',
  approve: 'primary',
  publish: 'primary',
  reject: 'ghost',
  archive: 'ghost',
};

export type ItemEditorialProps = {
  item: AdminItemDetail;
  /** Salva o formulário antes da ação; `false` interrompe. */
  beforeAction: () => Promise<boolean>;
  onTransitioned: (item: AdminItemDetail) => void;
  onJumpToIssue: (path: string) => void;
};

/** A barra editorial do item e o painel do que a API recusou. */
export function ItemEditorial({
  item,
  beforeAction,
  onTransitioned,
  onJumpToIssue,
}: ItemEditorialProps) {
  const controller = useItemEditorialController({
    itemId: item.id,
    status: item.status,
    beforeAction,
    onTransitioned,
  });

  return (
    <div className="space-y-3">
      {controller.actions.length > 0 ? (
        <div
          role="group"
          aria-label={t('items.editorial.group')}
          className="flex flex-wrap items-center gap-2"
        >
          {controller.actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={VARIANTS[action]}
              disabled={controller.isWorking}
              isLoading={controller.pendingAction === action}
              onClick={() => controller.request(action)}
            >
              {t(`items.editorial.action.${action}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {controller.problem ? (
        <ItemProblemPanel
          problem={controller.problem}
          onJumpToIssue={onJumpToIssue}
          onDismiss={controller.dismissProblem}
        />
      ) : null}

      <ConfirmDialog
        open={controller.confirming !== null}
        title={
          controller.confirming === 'archive'
            ? t('items.editorial.confirm.archive.title')
            : t('items.editorial.confirm.publish.title')
        }
        description={
          controller.confirming === 'archive'
            ? t('items.editorial.confirm.archive.description')
            : item.replaces === null
              ? t('items.editorial.confirm.publish.description')
              : t('items.editorial.confirm.publish.descriptionReplaces')
        }
        confirmLabel={
          controller.confirming === 'archive'
            ? t('items.editorial.action.archive')
            : t('items.editorial.action.publish')
        }
        danger={controller.confirming === 'archive'}
        isLoading={controller.isWorking}
        onConfirm={controller.confirm}
        onCancel={controller.cancelConfirm}
      />
    </div>
  );
}
