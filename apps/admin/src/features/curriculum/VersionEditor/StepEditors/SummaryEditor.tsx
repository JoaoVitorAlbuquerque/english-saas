import type { SummaryContent } from '@english-saas/shared';
import { Button, Input } from '@english-saas/ui';
import { Plus } from 'lucide-react';

import { t } from '../../../../messages/pt-BR';
import { ListControls } from '../../components/ListControls';
import { RegisterNoteChips } from '../../components/ReferenceSelects';
import { SkillMultiPicker } from '../../components/SkillPicker';
import { moveItem, removeAt, replaceAt } from '../../lib/list-ops';
import type { StepContent } from '../../lib/step-content';
import { issuesAt, issuesUnder, path } from '../../lib/validation';
import type { StepEditorProps } from './types';

export function SummaryEditor({
  content,
  onChange,
  issues,
  readOnly,
}: StepEditorProps) {
  const summary = content as unknown as SummaryContent;

  function update(patch: Partial<SummaryContent>): void {
    onChange({ ...content, ...patch } as StepContent);
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2" data-field="takeaways">
        <h3 className="font-display text-lg text-ink">
          {t('summary.takeaways')}
        </h3>
        {issuesAt(issues, 'takeaways')[0] ? (
          <p className="text-sm text-error">
            {issuesAt(issues, 'takeaways')[0]}
          </p>
        ) : null}
        <ul className="space-y-2">
          {summary.takeaways.map((takeaway, index) => (
            <li key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  aria-label={t('summary.takeaway.label', { n: index + 1 })}
                  value={takeaway}
                  readOnly={readOnly}
                  onChange={(event) =>
                    update({
                      takeaways: replaceAt(
                        summary.takeaways,
                        index,
                        event.target.value,
                      ),
                    })
                  }
                  error={issuesAt(issues, path('takeaways', index))[0]}
                  data-field={path('takeaways', index)}
                />
              </div>
              {readOnly ? null : (
                <ListControls
                  label={t('summary.takeaway', { n: index + 1 })}
                  index={index}
                  count={summary.takeaways.length}
                  onMove={(delta) =>
                    update({
                      takeaways: moveItem(summary.takeaways, index, delta),
                    })
                  }
                  onRemove={
                    summary.takeaways.length > 1
                      ? () =>
                          update({
                            takeaways: removeAt(summary.takeaways, index),
                          })
                      : undefined
                  }
                />
              )}
            </li>
          ))}
        </ul>
        {readOnly || summary.takeaways.length >= 10 ? null : (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => update({ takeaways: [...summary.takeaways, ''] })}
          >
            {t('summary.takeaway.add')}
          </Button>
        )}
      </section>

      <SkillMultiPicker
        label={t('summary.skills')}
        value={summary.skillIds}
        disabled={readOnly}
        max={20}
        fieldPath="skillIds"
        error={issuesUnder(issues, 'skillIds')[0]?.message}
        onChange={(skillIds) => update({ skillIds })}
      />

      <RegisterNoteChips
        label={t('summary.notes')}
        value={summary.registerNoteIds}
        disabled={readOnly}
        fieldPath="registerNoteIds"
        error={issuesUnder(issues, 'registerNoteIds')[0]?.message}
        onChange={(registerNoteIds) => update({ registerNoteIds })}
      />
    </div>
  );
}
