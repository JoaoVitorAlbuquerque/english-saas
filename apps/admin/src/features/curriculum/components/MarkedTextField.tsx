import {
  SPAN_KINDS,
  SPAN_KIND_LABELS,
  type Span,
  type SpanKind,
} from '@english-saas/shared';
import { Button, Chip, Input, MarkedText } from '@english-saas/ui';
import { X } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { t } from '../../../messages/pt-BR';
import { rebaseSpans, renderableSpans } from '../lib/rebase-spans';
import { issuesAt, path, type FieldIssue } from '../lib/validation';
import { RegisterNoteSelect } from './ReferenceSelects';
import { SkillPicker } from './SkillPicker';

export type MarkedTextFieldProps = {
  label: string;
  text: string;
  spans: Span[];
  onChange: (next: { text: string; spans: Span[] }) => void;
  /** Caminho do texto e da lista de marcações dentro da etapa. */
  textPath: string;
  spansPath: string;
  issues: FieldIssue[];
  readOnly: boolean;
  maxLength?: number;
};

type Selection = { start: number; end: number };

/** `CHUNK` e `GRAMMAR` exigem skill; `REGISTER` exige nota; `VOCAB` aceita as duas. */
function needsSkill(kind: SpanKind): boolean {
  return kind === 'CHUNK' || kind === 'GRAMMAR';
}

/**
 * Campo de texto com marcações: o editor seleciona um trecho **no próprio
 * texto**, escolhe o tipo (expressão, estrutura, jeito de falar,
 * vocabulário) e a skill ou a nota de registro, e a marcação é criada com os
 * índices do trecho. Mudar o texto reposiciona as marcações (`rebaseSpans`):
 * as que sobrevivem acompanham o trecho, e as que foram cortadas saem com
 * aviso — nada fica apontando para o lugar errado em silêncio.
 */
export function MarkedTextField({
  label,
  text,
  spans,
  onChange,
  textPath,
  spansPath,
  issues,
  readOnly,
  maxLength,
}: MarkedTextFieldProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [kind, setKind] = useState<SpanKind | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState('');
  const [dropped, setDropped] = useState(0);

  const selectedText = selection
    ? text.slice(selection.start, selection.end)
    : '';
  const referenceOk =
    kind === null
      ? false
      : needsSkill(kind)
        ? skillId !== null
        : kind === 'REGISTER'
          ? noteId !== ''
          : true;

  function readSelection(event: SyntheticEvent<HTMLInputElement>): void {
    const { selectionStart, selectionEnd } = event.currentTarget;

    setSelection(
      selectionStart !== null &&
        selectionEnd !== null &&
        selectionEnd > selectionStart
        ? { start: selectionStart, end: selectionEnd }
        : null,
    );
  }

  function changeText(next: string): void {
    const result = rebaseSpans(text, next, spans);

    setDropped(result.dropped.length);
    setSelection(null);
    onChange({ text: next, spans: result.spans });
  }

  function addSpan(): void {
    if (selection === null || kind === null || !referenceOk) {
      return;
    }

    const span: Span = {
      start: selection.start,
      end: selection.end,
      kind,
      ...(skillId !== null && (needsSkill(kind) || kind === 'VOCAB')
        ? { skillId }
        : {}),
      ...(kind === 'REGISTER' ? { registerNoteId: noteId } : {}),
    };

    onChange({
      text,
      spans: [...spans, span].sort((a, b) => a.start - b.start),
    });
    setSelection(null);
    setKind(null);
    setSkillId(null);
    setNoteId('');
    setDropped(0);
  }

  function removeSpan(index: number): void {
    onChange({
      text,
      spans: spans.filter((_, position) => position !== index),
    });
  }

  const textErrors = issuesAt(issues, textPath);
  const listErrors = issuesAt(issues, spansPath);
  const entries = spans
    .map((span, index) => ({ span, index }))
    .sort((a, b) => a.span.start - b.span.start);

  return (
    <div className="space-y-3">
      <Input
        label={label}
        value={text}
        maxLength={maxLength}
        readOnly={readOnly}
        onChange={(event) => changeText(event.target.value)}
        onSelect={readSelection}
        onKeyUp={readSelection}
        onMouseUp={readSelection}
        error={textErrors[0]}
        data-field={textPath}
      />

      {dropped > 0 ? (
        <p role="status" className="text-sm text-error">
          {dropped === 1
            ? t('spans.dropped.one')
            : t('spans.dropped.many', { count: dropped })}
        </p>
      ) : null}

      {text !== '' && renderableSpans(text, spans).length > 0 ? (
        <div className="rounded-lg bg-ground px-3 py-2 text-sm">
          <p className="mb-1 text-xs font-medium text-muted">
            {t('spans.preview')}
          </p>
          <MarkedText text={text} spans={renderableSpans(text, spans)} />
        </div>
      ) : null}

      {readOnly ? null : (
        <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
          {selection === null ? (
            <p className="text-sm text-muted">{t('spans.selectHint')}</p>
          ) : (
            <>
              <p className="text-sm text-ink">
                {t('spans.selected', { text: selectedText })}
              </p>
              <div
                role="group"
                aria-label={t('spans.kind')}
                className="flex flex-wrap gap-2"
              >
                {SPAN_KINDS.map((option) => (
                  <Chip
                    key={option}
                    selected={kind === option}
                    onClick={() => {
                      setKind(option);
                      setSkillId(null);
                      setNoteId('');
                    }}
                  >
                    {SPAN_KIND_LABELS[option]}
                  </Chip>
                ))}
              </div>

              {kind !== null && kind !== 'REGISTER' ? (
                <SkillPicker
                  label={
                    kind === 'VOCAB'
                      ? t('spans.skillOptional')
                      : t('spans.skill')
                  }
                  value={skillId}
                  onChange={setSkillId}
                />
              ) : null}
              {kind === 'REGISTER' ? (
                <RegisterNoteSelect
                  label={t('spans.note')}
                  value={noteId}
                  onChange={setNoteId}
                />
              ) : null}

              {kind !== null && !referenceOk ? (
                <p className="text-xs text-muted">{t('spans.needReference')}</p>
              ) : null}

              <Button
                size="sm"
                disabled={kind === null || !referenceOk}
                onClick={addSpan}
              >
                {t('spans.add')}
              </Button>
            </>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted">{t('spans.list')}</p>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">{t('spans.empty')}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {entries.map(({ span, index }) => {
              const errors = issuesAt(issues, path(spansPath, index));

              return (
                <li
                  key={index}
                  data-field={path(spansPath, index)}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-ground/60 px-2 py-1 text-sm"
                >
                  <span className="text-ink">
                    {t('spans.row', {
                      text: text.slice(span.start, span.end),
                      kind: SPAN_KIND_LABELS[span.kind],
                    })}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {span.skillId ?? span.registerNoteId ?? ''}
                  </span>
                  {errors.length > 0 ? (
                    <span className="text-xs text-error">{errors[0]}</span>
                  ) : null}
                  {readOnly ? null : (
                    <button
                      type="button"
                      aria-label={t('spans.remove', { n: index + 1 })}
                      onClick={() => removeSpan(index)}
                      className="ml-auto flex size-6 items-center justify-center rounded text-muted hover:bg-line/50"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {listErrors.length > 0 ? (
          <p className="mt-1 text-sm text-error">{listErrors[0]}</p>
        ) : null}
      </div>
    </div>
  );
}
