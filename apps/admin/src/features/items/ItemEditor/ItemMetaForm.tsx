import {
  CEFR_LEVELS,
  INITIAL_DIFFICULTY_BY_LEVEL,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  type CefrLevel,
  type ItemType,
} from '@english-saas/shared';
import { Input, Select, Textarea } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { SkillMultiPicker } from '../../curriculum/components/SkillPicker';
import { issuesAt, type FieldIssue } from '../../curriculum/lib/validation';
import type { ItemFormState } from '../lib/item-form';

type Patch = Partial<Omit<ItemFormState, 'content' | 'type'>>;

/** Os campos comuns a todo tipo: o que a questão mede e como se descreve. */
export function ItemMetaTop({
  state,
  issues,
  frozen,
  isNew,
  onPatch,
  onType,
}: {
  state: ItemFormState;
  issues: readonly FieldIssue[];
  /** Publicado ou arquivado: tipo, enunciado e conteúdo ficam travados. */
  frozen: boolean;
  isNew: boolean;
  onPatch: (patch: Patch) => void;
  onType: (type: ItemType) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t('items.field.type')}
          value={state.type}
          disabled={frozen}
          onChange={(event) => onType(event.target.value as ItemType)}
          options={ITEM_TYPES.map((type) => ({
            value: type,
            label: ITEM_TYPE_LABELS[type],
          }))}
          data-field="type"
        />
        <Select
          label={t('content.level.label')}
          value={state.cefrLevel}
          onChange={(event) =>
            onPatch({ cefrLevel: event.target.value as CefrLevel })
          }
          options={CEFR_LEVELS.map((level) => ({ value: level, label: level }))}
          error={issuesAt(issues, 'cefrLevel')[0]}
        />
      </div>

      <SkillMultiPicker
        label={t('items.field.skills')}
        hint={t('items.field.skillsHint')}
        value={state.skillIds}
        onChange={(skillIds) => onPatch({ skillIds })}
        error={issuesAt(issues, 'skillIds')[0]}
        max={10}
        fieldPath="skillIds"
      />

      <Textarea
        label={t('items.field.prompt')}
        hint={t('items.field.promptHint')}
        value={state.prompt}
        readOnly={frozen}
        rows={2}
        onChange={(event) => onPatch({ prompt: event.target.value })}
        error={issuesAt(issues, 'prompt')[0]}
        data-field="prompt"
      />

      <Input
        label={t('items.field.slug')}
        hint={isNew ? t('items.field.slugHint') : t('items.field.slugLocked')}
        value={state.slug}
        disabled={!isNew}
        onChange={(event) => onPatch({ slug: event.target.value })}
        error={issuesAt(issues, 'slug')[0]}
        data-field="slug"
      />
    </div>
  );
}

/** Explicação, dificuldade e discriminação — o que sempre se pode corrigir. */
export function ItemMetaBottom({
  state,
  issues,
  readOnly,
  onPatch,
}: {
  state: ItemFormState;
  issues: readonly FieldIssue[];
  readOnly: boolean;
  onPatch: (patch: Patch) => void;
}) {
  return (
    <div className="space-y-4">
      <Textarea
        label={t('items.field.explanation')}
        hint={t('items.field.explanationHint')}
        value={state.explanation}
        readOnly={readOnly}
        rows={3}
        onChange={(event) => onPatch({ explanation: event.target.value })}
        error={issuesAt(issues, 'explanation')[0]}
        data-field="explanation"
      />

      <details className="rounded-lg border border-line px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          {t('items.field.advanced')}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label={t('items.field.difficulty')}
            hint={t('items.field.difficultyHint', {
              level: state.cefrLevel,
              value: String(INITIAL_DIFFICULTY_BY_LEVEL[state.cefrLevel]),
            })}
            inputMode="decimal"
            value={state.difficulty}
            readOnly={readOnly}
            onChange={(event) => onPatch({ difficulty: event.target.value })}
            error={issuesAt(issues, 'difficulty')[0]}
            data-field="difficulty"
          />
          <Input
            label={t('items.field.discrimination')}
            hint={t('items.field.discriminationHint')}
            inputMode="decimal"
            value={state.discrimination}
            readOnly={readOnly}
            onChange={(event) =>
              onPatch({ discrimination: event.target.value })
            }
            error={issuesAt(issues, 'discrimination')[0]}
            data-field="discrimination"
          />
        </div>
      </details>
    </div>
  );
}
