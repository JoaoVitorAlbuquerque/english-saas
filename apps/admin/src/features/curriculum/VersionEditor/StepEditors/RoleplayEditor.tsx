import {
  CEFR_LEVELS,
  type CefrLevel,
  type RoleplayContent,
} from '@english-saas/shared';
import { Button, Input, Select, Textarea } from '@english-saas/ui';
import { Plus } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { ListItemCard } from '../../components/ListItemCard';
import { CharacterSelect } from '../../components/ReferenceSelects';
import { SkillMultiPicker } from '../../components/SkillPicker';
import {
  insertAt,
  moveItem,
  removeAt,
  replaceAt,
  withOptional,
} from '../../lib/list-ops';
import { emptyGoal, type StepContent } from '../../lib/step-content';
import { issuesAt, issuesUnder, path } from '../../lib/validation';
import type { StepEditorProps } from './types';

type Goal = RoleplayContent['goals'][number];

/** O menor `meta-N` que ainda não existe. */
function nextGoalId(goals: readonly Goal[]): string {
  const used = new Set(goals.map((goal) => goal.id));
  let number = goals.length + 1;

  while (used.has(`meta-${String(number)}`)) {
    number += 1;
  }

  return `meta-${String(number)}`;
}

export function RoleplayEditor({
  content,
  onChange,
  issues,
  readOnly,
  characters,
}: StepEditorProps) {
  const roleplay = content as unknown as RoleplayContent;

  function update(patch: Partial<RoleplayContent>): void {
    onChange({ ...content, ...patch } as StepContent);
  }

  function updateGoal(index: number, goal: Goal): void {
    update({ goals: replaceAt(roleplay.goals, index, goal) });
  }

  return (
    <div className="space-y-5">
      <CharacterSelect
        label={t('roleplay.character')}
        value={roleplay.characterId ?? ''}
        characters={characters}
        disabled={readOnly}
        onChange={(characterId) => update({ characterId })}
        error={issuesAt(issues, 'characterId')[0]}
        fieldPath="characterId"
      />
      <Textarea
        label={t('roleplay.scenario')}
        value={roleplay.scenario ?? ''}
        readOnly={readOnly}
        rows={3}
        onChange={(event) => update({ scenario: event.target.value })}
        error={issuesAt(issues, 'scenario')[0]}
        data-field="scenario"
      />
      <Input
        label={t('roleplay.openingLine')}
        value={roleplay.openingLine ?? ''}
        readOnly={readOnly}
        onChange={(event) =>
          onChange(withOptional(content, 'openingLine', event.target.value))
        }
        error={issuesAt(issues, 'openingLine')[0]}
        data-field="openingLine"
      />

      <section className="space-y-3" data-field="goals">
        <h3 className="font-display text-lg text-ink">{t('roleplay.goals')}</h3>
        {issuesAt(issues, 'goals')[0] ? (
          <p className="text-sm text-error">{issuesAt(issues, 'goals')[0]}</p>
        ) : null}
        <ol className="space-y-3">
          {roleplay.goals.map((goal, index) => {
            const base = path('goals', index);

            return (
              <ListItemCard
                key={goal.id ?? index}
                title={`${String(index + 1)}. ${t('roleplay.goal', { n: index + 1 })}`}
                label={t('roleplay.goal', { n: index + 1 })}
                index={index}
                count={roleplay.goals.length}
                readOnly={readOnly}
                fieldPath={base}
                onMove={(delta) =>
                  update({ goals: moveItem(roleplay.goals, index, delta) })
                }
                onRemove={
                  roleplay.goals.length > 1
                    ? () => update({ goals: removeAt(roleplay.goals, index) })
                    : undefined
                }
              >
                <Textarea
                  label={t('roleplay.goal.description')}
                  value={goal.description ?? ''}
                  readOnly={readOnly}
                  rows={2}
                  onChange={(event) =>
                    updateGoal(index, {
                      ...goal,
                      description: event.target.value,
                    })
                  }
                  error={issuesAt(issues, path(base, 'description'))[0]}
                  data-field={path(base, 'description')}
                />
                <SkillMultiPicker
                  label={t('roleplay.goal.skills')}
                  value={goal.skillIds ?? []}
                  disabled={readOnly}
                  max={5}
                  fieldPath={path(base, 'skillIds')}
                  error={
                    issuesUnder(issues, path(base, 'skillIds'))[0]?.message
                  }
                  onChange={(skillIds) =>
                    updateGoal(index, { ...goal, skillIds })
                  }
                />
              </ListItemCard>
            );
          })}
        </ol>
        {readOnly || roleplay.goals.length >= 6 ? null : (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() =>
              update({
                goals: insertAt(roleplay.goals, roleplay.goals.length, {
                  ...(emptyGoal(roleplay.goals.length) as Goal),
                  id: nextGoalId(roleplay.goals),
                }),
              })
            }
          >
            {t('roleplay.goal.add')}
          </Button>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="number"
          min={2}
          max={40}
          label={t('roleplay.maxTurns')}
          value={roleplay.maxTurns ?? ''}
          readOnly={readOnly}
          onChange={(event) => update({ maxTurns: Number(event.target.value) })}
          error={issuesAt(issues, 'maxTurns')[0]}
          data-field="maxTurns"
        />
        <Select
          label={t('roleplay.level')}
          value={roleplay.allowedVocabularyLevel ?? 'A1'}
          disabled={readOnly}
          onChange={(event) =>
            update({ allowedVocabularyLevel: event.target.value as CefrLevel })
          }
          options={CEFR_LEVELS.map((level) => ({ value: level, label: level }))}
          error={issuesAt(issues, 'allowedVocabularyLevel')[0]}
          data-field="allowedVocabularyLevel"
        />
      </div>
    </div>
  );
}
