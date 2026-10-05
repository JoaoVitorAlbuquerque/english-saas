import type { SceneContent, Span } from '@english-saas/shared';
import { Button, Chip, Input, Textarea } from '@english-saas/ui';
import { Plus } from 'lucide-react';
import { useId } from 'react';

import { t } from '../../../../messages/pt-BR';
import { ListItemCard } from '../../components/ListItemCard';
import { MarkedTextField } from '../../components/MarkedTextField';
import { CharacterSelect } from '../../components/ReferenceSelects';
import {
  insertAt,
  moveItem,
  removeAt,
  replaceAt,
  withOptional,
} from '../../lib/list-ops';
import { emptySceneLine, type StepContent } from '../../lib/step-content';
import { issuesAt, issuesUnder, path } from '../../lib/validation';
import type { StepEditorProps } from './types';

type Line = SceneContent['lines'][number];

export function SceneEditor({
  content,
  onChange,
  issues,
  readOnly,
  characters,
}: StepEditorProps) {
  const scene = content as unknown as SceneContent;
  const castId = useId();

  function update(patch: Partial<SceneContent>): void {
    onChange({ ...content, ...patch } as StepContent);
  }

  function updateLine(index: number, patch: Partial<Line>): void {
    const line = scene.lines[index];

    if (line !== undefined) {
      update({ lines: replaceAt(scene.lines, index, { ...line, ...patch }) });
    }
  }

  function toggleCast(id: string): void {
    update({
      characterIds: scene.characterIds.includes(id)
        ? scene.characterIds.filter((entry) => entry !== id)
        : [...scene.characterIds, id],
    });
  }

  return (
    <div className="space-y-5">
      <Input
        label={t('scene.location')}
        value={scene.location ?? ''}
        readOnly={readOnly}
        onChange={(event) => update({ location: event.target.value })}
        error={issuesAt(issues, 'location')[0]}
        data-field="location"
      />
      <Textarea
        label={t('scene.summary')}
        value={scene.summary ?? ''}
        readOnly={readOnly}
        rows={2}
        onChange={(event) =>
          onChange(withOptional(content, 'summary', event.target.value))
        }
        error={issuesAt(issues, 'summary')[0]}
        data-field="summary"
      />

      <div
        role="group"
        aria-labelledby={castId}
        data-field="characterIds"
        className="space-y-2"
      >
        <p id={castId} className="text-sm font-medium text-ink">
          {t('scene.cast')}
        </p>
        <div className="flex flex-wrap gap-2">
          {characters.map((character) => (
            <Chip
              key={character.id}
              selected={scene.characterIds.includes(character.id)}
              disabled={readOnly}
              onClick={() => toggleCast(character.id)}
            >
              {character.name}
            </Chip>
          ))}
        </div>
        {issuesUnder(issues, 'characterIds').length > 0 ? (
          <p className="text-sm text-error">
            {issuesUnder(issues, 'characterIds')[0]?.message}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-ink">{t('scene.lines')}</h3>
        {issuesAt(issues, 'lines').length > 0 ? (
          <p className="text-sm text-error">{issuesAt(issues, 'lines')[0]}</p>
        ) : null}
        <ol className="space-y-3">
          {scene.lines.map((line, index) => {
            const base = path('lines', index);

            return (
              <ListItemCard
                key={index}
                title={`${String(index + 1)}. ${t('scene.line', { n: index + 1 })}`}
                label={t('scene.line', { n: index + 1 })}
                index={index}
                count={scene.lines.length}
                readOnly={readOnly}
                fieldPath={base}
                onMove={(delta) =>
                  update({ lines: moveItem(scene.lines, index, delta) })
                }
                onRemove={() => update({ lines: removeAt(scene.lines, index) })}
              >
                <CharacterSelect
                  label={t('scene.line.character')}
                  value={line.characterId ?? ''}
                  only={scene.characterIds}
                  characters={characters}
                  disabled={readOnly}
                  onChange={(characterId) => updateLine(index, { characterId })}
                  error={issuesAt(issues, path(base, 'characterId'))[0]}
                  fieldPath={path(base, 'characterId')}
                />
                <MarkedTextField
                  label={t('scene.line.text')}
                  text={line.text ?? ''}
                  spans={(line.spans ?? []) as Span[]}
                  onChange={(next) => updateLine(index, next)}
                  textPath={path(base, 'text')}
                  spansPath={path(base, 'spans')}
                  issues={issues}
                  readOnly={readOnly}
                  maxLength={500}
                />
                <Input
                  label={t('scene.line.standardText')}
                  value={line.standardText ?? ''}
                  readOnly={readOnly}
                  onChange={(event) =>
                    onChange({
                      ...content,
                      lines: replaceAt(
                        scene.lines,
                        index,
                        withOptional(line, 'standardText', event.target.value),
                      ),
                    } as StepContent)
                  }
                  error={issuesAt(issues, path(base, 'standardText'))[0]}
                  data-field={path(base, 'standardText')}
                />
                <Input
                  label={t('scene.line.translation')}
                  value={line.translation ?? ''}
                  readOnly={readOnly}
                  onChange={(event) =>
                    updateLine(index, { translation: event.target.value })
                  }
                  error={issuesAt(issues, path(base, 'translation'))[0]}
                  data-field={path(base, 'translation')}
                />
              </ListItemCard>
            );
          })}
        </ol>
        {readOnly ? null : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() =>
              update({
                lines: insertAt(
                  scene.lines,
                  scene.lines.length,
                  emptySceneLine(
                    scene.characterIds.find(
                      (id) => id !== scene.lines.at(-1)?.characterId,
                    ) ??
                      scene.characterIds[0] ??
                      '',
                  ) as Line,
                ),
              })
            }
          >
            {t('scene.line.add')}
          </Button>
        )}
      </section>
    </div>
  );
}
