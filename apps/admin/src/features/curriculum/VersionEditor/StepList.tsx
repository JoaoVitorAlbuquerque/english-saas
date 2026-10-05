import {
  LESSON_STEP_TYPES,
  LESSON_STEP_TYPE_LABELS,
} from '@english-saas/shared';
import { Button, Badge, cn } from '@english-saas/ui';
import { Plus } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { ListControls } from '../components/ListControls';
import type { EditorStep } from '../lib/editor-reducer';
import type { EditorValidation } from '../lib/validation';

export const META_TAB = 'meta';

/**
 * A lista de etapas da lição: escolher qual editar, ver quantos erros cada
 * uma tem, reordenar, remover e adicionar. O "Metadados" é a primeira aba.
 */
export function StepList({
  steps,
  validation,
  active,
  readOnly,
  onSelect,
  onMove,
  onRemove,
  onAdd,
}: {
  steps: readonly EditorStep[];
  validation: EditorValidation;
  active: string;
  readOnly: boolean;
  onSelect: (key: string) => void;
  onMove: (key: string, delta: -1 | 1) => void;
  onRemove: (key: string) => void;
  onAdd: (type: (typeof LESSON_STEP_TYPES)[number]) => void;
}) {
  const metaErrors = Object.keys(validation.meta).length;

  return (
    <nav
      aria-label={t('editor.stepList')}
      className="space-y-3 rounded-2xl border border-line bg-surface p-3"
    >
      <ul className="space-y-1">
        <li>
          <button
            type="button"
            aria-current={active === META_TAB ? 'true' : undefined}
            onClick={() => onSelect(META_TAB)}
            className={cn(
              'flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium',
              active === META_TAB
                ? 'bg-accent/10 text-accent'
                : 'text-ink hover:bg-ground',
            )}
          >
            <span className="flex-1">{t('editor.tab.meta')}</span>
            {metaErrors > 0 ? (
              <Badge tone="error">
                {metaErrors === 1
                  ? t('editor.step.errors.one')
                  : t('editor.step.errors.many', { count: metaErrors })}
              </Badge>
            ) : null}
          </button>
        </li>
      </ul>

      <h3 className="px-1 font-display text-sm text-muted">
        {t('editor.steps')}
      </h3>
      {steps.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t('editor.steps.empty')}</p>
      ) : (
        <ol className="space-y-1">
          {steps.map((step, index) => {
            const errors = validation.steps[step.key]?.length ?? 0;
            const typeLabel = LESSON_STEP_TYPE_LABELS[step.type];

            return (
              <li key={step.key} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-current={active === step.key ? 'true' : undefined}
                  onClick={() => onSelect(step.key)}
                  className={cn(
                    'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium',
                    active === step.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-ink hover:bg-ground',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t('editor.step.title', {
                      position: index + 1,
                      type: typeLabel,
                    })}
                  </span>
                  {errors > 0 ? (
                    <Badge tone="error">
                      {errors === 1
                        ? t('editor.step.errors.one')
                        : t('editor.step.errors.many', { count: errors })}
                    </Badge>
                  ) : null}
                </button>
                {readOnly ? null : (
                  <ListControls
                    label={t('editor.step.title', {
                      position: index + 1,
                      type: typeLabel,
                    })}
                    index={index}
                    count={steps.length}
                    onMove={(delta) => onMove(step.key, delta)}
                    onRemove={() => onRemove(step.key)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {validation.lesson.length > 0 ? (
        <p className="px-1 text-sm text-error">{validation.lesson[0]}</p>
      ) : null}

      {readOnly ? null : (
        <div className="space-y-2 border-t border-line pt-3">
          <h3 className="px-1 font-display text-sm text-muted">
            {t('editor.step.add')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {LESSON_STEP_TYPES.map((type) => (
              <Button
                key={type}
                size="sm"
                variant="ghost"
                aria-label={t('editor.step.addType', {
                  type: LESSON_STEP_TYPE_LABELS[type],
                })}
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => onAdd(type)}
              >
                {LESSON_STEP_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
