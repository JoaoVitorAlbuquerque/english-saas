import type { FreeProductionContent } from '@english-saas/shared';
import { Button, Input, Textarea } from '@english-saas/ui';
import { Plus } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { ListItemCard } from '../../components/ListItemCard';
import { ListControls } from '../../components/ListControls';
import { ErrorPatternSelect } from '../../components/ReferenceSelects';
import { SkillMultiPicker, SkillPicker } from '../../components/SkillPicker';
import {
  insertAt,
  moveItem,
  removeAt,
  replaceAt,
  withOptional,
} from '../../lib/list-ops';
import { emptyRubricCriterion, type StepContent } from '../../lib/step-content';
import { issuesAt, issuesUnder, path } from '../../lib/validation';
import type { StepEditorProps } from './types';

type Criterion = FreeProductionContent['rubric'][number];

/** O menor `criterio-N` que ainda não existe na rubrica. */
function nextCriterionId(rubric: readonly Criterion[]): string {
  const used = new Set(rubric.map((criterion) => criterion.id));
  let number = rubric.length + 1;

  while (used.has(`criterio-${String(number)}`)) {
    number += 1;
  }

  return `criterio-${String(number)}`;
}

export function FreeProductionEditor({
  content,
  onChange,
  issues,
  readOnly,
}: StepEditorProps) {
  const production = content as unknown as FreeProductionContent;

  function update(patch: Partial<FreeProductionContent>): void {
    onChange({ ...content, ...patch } as StepContent);
  }

  function updateCriterion(index: number, criterion: Criterion): void {
    update({ rubric: replaceAt(production.rubric, index, criterion) });
  }

  return (
    <div className="space-y-5">
      <Textarea
        label={t('production.prompt')}
        value={production.prompt ?? ''}
        readOnly={readOnly}
        rows={3}
        onChange={(event) => update({ prompt: event.target.value })}
        error={issuesAt(issues, 'prompt')[0]}
        data-field="prompt"
      />

      <section className="space-y-2" data-field="helpers">
        <h3 className="text-sm font-medium text-ink">
          {t('production.helpers')}
        </h3>
        <ul className="space-y-2">
          {production.helpers.map((helper, index) => (
            <li key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  aria-label={t('production.helper.label', { n: index + 1 })}
                  value={helper}
                  readOnly={readOnly}
                  onChange={(event) =>
                    update({
                      helpers: replaceAt(
                        production.helpers,
                        index,
                        event.target.value,
                      ),
                    })
                  }
                  error={issuesAt(issues, path('helpers', index))[0]}
                  data-field={path('helpers', index)}
                />
              </div>
              {readOnly ? null : (
                <ListControls
                  label={t('production.helper', { n: index + 1 })}
                  index={index}
                  count={production.helpers.length}
                  onMove={(delta) =>
                    update({
                      helpers: moveItem(production.helpers, index, delta),
                    })
                  }
                  onRemove={() =>
                    update({ helpers: removeAt(production.helpers, index) })
                  }
                />
              )}
            </li>
          ))}
        </ul>
        {issuesAt(issues, 'helpers')[0] ? (
          <p className="text-sm text-error">{issuesAt(issues, 'helpers')[0]}</p>
        ) : null}
        {readOnly || production.helpers.length >= 12 ? null : (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => update({ helpers: [...production.helpers, ''] })}
          >
            {t('production.helper.add')}
          </Button>
        )}
      </section>

      <section className="space-y-3" data-field="rubric">
        <h3 className="font-display text-lg text-ink">
          {t('production.rubric')}
        </h3>
        {issuesAt(issues, 'rubric')[0] ? (
          <p className="text-sm text-error">{issuesAt(issues, 'rubric')[0]}</p>
        ) : null}
        <ol className="space-y-3">
          {production.rubric.map((criterion, index) => {
            const base = path('rubric', index);

            return (
              <ListItemCard
                key={criterion.id ?? index}
                title={`${String(index + 1)}. ${t('production.criterion', { n: index + 1 })}`}
                label={t('production.criterion', { n: index + 1 })}
                index={index}
                count={production.rubric.length}
                readOnly={readOnly}
                fieldPath={base}
                onMove={(delta) =>
                  update({ rubric: moveItem(production.rubric, index, delta) })
                }
                onRemove={
                  production.rubric.length > 1
                    ? () =>
                        update({ rubric: removeAt(production.rubric, index) })
                    : undefined
                }
              >
                <Textarea
                  label={t('production.criterion.description')}
                  value={criterion.description ?? ''}
                  readOnly={readOnly}
                  rows={2}
                  onChange={(event) =>
                    updateCriterion(index, {
                      ...criterion,
                      description: event.target.value,
                    })
                  }
                  error={issuesAt(issues, path(base, 'description'))[0]}
                  data-field={path(base, 'description')}
                />
                <SkillPicker
                  label={t('production.criterion.skill')}
                  value={criterion.skillId ?? null}
                  disabled={readOnly}
                  fieldPath={path(base, 'skillId')}
                  error={issuesAt(issues, path(base, 'skillId'))[0]}
                  onChange={(skillId) =>
                    updateCriterion(
                      index,
                      withOptional(criterion, 'skillId', skillId ?? undefined),
                    )
                  }
                />
                <ErrorPatternSelect
                  label={t('production.criterion.error')}
                  value={criterion.errorPatternId ?? ''}
                  disabled={readOnly}
                  fieldPath={path(base, 'errorPatternId')}
                  onChange={(errorPatternId) =>
                    updateCriterion(
                      index,
                      withOptional(criterion, 'errorPatternId', errorPatternId),
                    )
                  }
                />
              </ListItemCard>
            );
          })}
        </ol>
        {readOnly || production.rubric.length >= 10 ? null : (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() =>
              update({
                rubric: insertAt(production.rubric, production.rubric.length, {
                  ...(emptyRubricCriterion(
                    production.rubric.length,
                  ) as Criterion),
                  id: nextCriterionId(production.rubric),
                }),
              })
            }
          >
            {t('production.criterion.add')}
          </Button>
        )}
      </section>

      <SkillMultiPicker
        label={t('production.targetSkills')}
        value={production.targetSkillIds}
        disabled={readOnly}
        max={10}
        fieldPath="targetSkillIds"
        error={issuesUnder(issues, 'targetSkillIds')[0]?.message}
        onChange={(targetSkillIds) => update({ targetSkillIds })}
      />

      <Input
        type="number"
        min={1}
        max={500}
        label={t('production.minWords')}
        value={production.minWords ?? ''}
        readOnly={readOnly}
        onChange={(event) =>
          onChange(
            withOptional(
              content,
              'minWords',
              event.target.value === ''
                ? undefined
                : Number(event.target.value),
            ),
          )
        }
        error={issuesAt(issues, 'minWords')[0]}
        data-field="minWords"
      />
    </div>
  );
}
