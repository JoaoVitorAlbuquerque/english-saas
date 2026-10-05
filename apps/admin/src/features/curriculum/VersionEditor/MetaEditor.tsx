import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';
import { Input, Select, Textarea } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { SkillMultiPicker } from '../components/SkillPicker';
import type { EditorMeta } from '../lib/editor-reducer';
import type { EditorValidation } from '../lib/validation';

/** Título, objetivo (can-do), nível, tempo estimado e skills-alvo. */
export function MetaEditor({
  meta,
  errors,
  readOnly,
  onChange,
}: {
  meta: EditorMeta;
  errors: EditorValidation['meta'];
  readOnly: boolean;
  onChange: (patch: Partial<EditorMeta>) => void;
}) {
  return (
    <div className="space-y-5">
      <Input
        label={t('editor.meta.title')}
        value={meta.title}
        readOnly={readOnly}
        onChange={(event) => onChange({ title: event.target.value })}
        error={errors.title}
        data-field="meta.title"
      />
      <Textarea
        label={t('editor.meta.objective')}
        value={meta.objective}
        readOnly={readOnly}
        rows={3}
        onChange={(event) => onChange({ objective: event.target.value })}
        error={errors.objective}
        data-field="meta.objective"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('editor.meta.cefrLevel')}
          value={meta.cefrLevel}
          disabled={readOnly}
          onChange={(event) =>
            onChange({ cefrLevel: event.target.value as CefrLevel })
          }
          options={CEFR_LEVELS.map((level) => ({ value: level, label: level }))}
          error={errors.cefrLevel}
          data-field="meta.cefrLevel"
        />
        <Input
          type="number"
          min={1}
          max={180}
          label={t('editor.meta.estimatedMinutes')}
          value={
            Number.isNaN(meta.estimatedMinutes) ? '' : meta.estimatedMinutes
          }
          readOnly={readOnly}
          onChange={(event) =>
            onChange({ estimatedMinutes: Number(event.target.value) })
          }
          error={errors.estimatedMinutes}
          data-field="meta.estimatedMinutes"
        />
      </div>
      <SkillMultiPicker
        label={t('editor.meta.skills')}
        hint={t('editor.meta.skillsHint')}
        value={meta.targetSkillIds}
        disabled={readOnly}
        max={20}
        fieldPath="meta.targetSkillIds"
        error={errors.targetSkillIds}
        onChange={(targetSkillIds) => onChange({ targetSkillIds })}
      />
    </div>
  );
}
