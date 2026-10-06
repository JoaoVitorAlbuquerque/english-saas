import { useErrorPatterns } from '@english-saas/api-client';
import { Chip } from '@english-saas/ui';
import { useId } from 'react';

import { t } from '../../../messages/pt-BR';

/** Vários erros típicos, por clique (erros comuns de uma skill). */
export function ErrorPatternChips({
  label,
  hint,
  value,
  onChange,
  disabled,
  error,
  fieldPath,
}: {
  label: string;
  hint?: string;
  value: readonly string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string | undefined;
  fieldPath?: string;
}) {
  const patterns = useErrorPatterns();
  const groupId = useId();
  const all = patterns.data?.data ?? [];
  // O que já está ligado mas saiu de circulação continua visível: sumir
  // calado faria o salvamento seguinte apagar a ligação.
  const unknown = value.filter(
    (id) => !all.some((pattern) => pattern.id === id),
  );

  return (
    <div
      role="group"
      aria-labelledby={groupId}
      data-field={fieldPath}
      className="space-y-2"
    >
      <p id={groupId} className="text-sm font-medium text-ink">
        {label}
      </p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {[
          ...all.map((pattern) => ({ id: pattern.id, text: pattern.example })),
          ...unknown.map((id) => ({ id, text: id })),
        ].map((pattern) => (
          <Chip
            key={pattern.id}
            selected={value.includes(pattern.id)}
            {...(disabled === undefined ? {} : { disabled })}
            onClick={() =>
              onChange(
                value.includes(pattern.id)
                  ? value.filter((id) => id !== pattern.id)
                  : [...value, pattern.id],
              )
            }
          >
            {pattern.text}
          </Chip>
        ))}
      </div>
      {patterns.isError ? (
        <p className="text-sm text-error">{t('taxonomy.errorsLoadFailed')}</p>
      ) : all.length === 0 && patterns.isSuccess ? (
        <p className="text-xs text-muted">{t('taxonomy.errorsNone')}</p>
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
