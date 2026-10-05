import { type AdminSkill, useSkillSearch } from '@english-saas/api-client';
import { Badge, Input } from '@english-saas/ui';
import { X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { t } from '../../../messages/pt-BR';
import { useDebouncedValue } from '../lib/useDebouncedValue';

/**
 * Busca de skill por texto (nome ou código). O servidor ignora acento e
 * caixa; a busca roda 250 ms depois da última tecla.
 */
function useSkillCatalog() {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim());
  const results = useSkillSearch(debounced);
  // As skills da busca vazia dão o título de quem já está escolhido.
  const base = useSkillSearch('');
  // Lembra o que já apareceu: o título da skill escolhida não some ao buscar outra.
  const known = useRef(new Map<string, AdminSkill>());

  for (const skill of [
    ...(base.data?.data ?? []),
    ...(results.data?.data ?? []),
  ]) {
    known.current.set(skill.id, skill);
  }

  return {
    query,
    setQuery,
    results,
    titleOf: (id: string): string => known.current.get(id)?.title ?? id,
  };
}

function SkillResults({
  catalog,
  chosen,
  onPick,
  disabled,
}: {
  catalog: ReturnType<typeof useSkillCatalog>;
  chosen: readonly string[];
  onPick: (skill: AdminSkill) => void;
  disabled: boolean;
}) {
  const { results } = catalog;

  if (results.isPending) {
    return <p className="text-xs text-muted">{t('picker.skill.loading')}</p>;
  }

  if (results.isError) {
    return (
      <p role="alert" className="text-xs text-error">
        {t('picker.skill.error')}
      </p>
    );
  }

  const options = results.data.data.filter(
    (skill) => !chosen.includes(skill.id),
  );

  if (options.length === 0) {
    return <p className="text-xs text-muted">{t('picker.skill.none')}</p>;
  }

  return (
    <ul
      aria-label={t('picker.skill.results')}
      className="max-h-48 overflow-y-auto rounded-lg border border-line bg-surface"
    >
      {options.map((skill) => (
        <li key={skill.id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(skill)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ground disabled:opacity-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink">{skill.title}</span>
              <span className="block truncate font-mono text-xs text-muted">
                {skill.id}
              </span>
            </span>
            <Badge tone="muted">{skill.cefrLevel}</Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SkillChip({
  id,
  title,
  disabled,
  onRemove,
}: {
  id: string;
  title: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-sm">
      <span className="text-ink">{title}</span>
      {title !== id ? (
        <span className="font-mono text-xs text-muted">{id}</span>
      ) : null}
      <button
        type="button"
        aria-label={t('picker.skill.clear', { skill: title })}
        disabled={disabled}
        onClick={onRemove}
        className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-ground disabled:opacity-50"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

export type SkillPickerProps = {
  label: string;
  value: string | null;
  onChange: (skillId: string | null) => void;
  error?: string | undefined;
  disabled?: boolean;
  fieldPath?: string;
};

/** Uma skill só (marcação, critério da rubrica). */
export function SkillPicker({
  label,
  value,
  onChange,
  error,
  disabled = false,
  fieldPath,
}: SkillPickerProps) {
  const catalog = useSkillCatalog();
  const groupId = useId();

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
      {value ? (
        <ul className="flex flex-wrap gap-2">
          <SkillChip
            id={value}
            title={catalog.titleOf(value)}
            disabled={disabled}
            onRemove={() => onChange(null)}
          />
        </ul>
      ) : null}
      {disabled ? null : (
        <>
          <Input
            aria-label={t('picker.skill.search')}
            placeholder={t('picker.skill.search')}
            value={catalog.query}
            onChange={(event) => catalog.setQuery(event.target.value)}
          />
          <SkillResults
            catalog={catalog}
            chosen={value ? [value] : []}
            disabled={disabled}
            onPick={(skill) => {
              onChange(skill.id);
              catalog.setQuery('');
            }}
          />
        </>
      )}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}

export type SkillMultiPickerProps = {
  label: string;
  hint?: string;
  value: readonly string[];
  onChange: (skillIds: string[]) => void;
  error?: string | undefined;
  disabled?: boolean;
  max?: number;
  fieldPath?: string;
};

/** Várias skills, na ordem escolhida (skills-alvo, metas, resumo). */
export function SkillMultiPicker({
  label,
  hint,
  value,
  onChange,
  error,
  disabled = false,
  max,
  fieldPath,
}: SkillMultiPickerProps) {
  const catalog = useSkillCatalog();
  const groupId = useId();
  const full = max !== undefined && value.length >= max;

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
      {value.length === 0 ? (
        <p className="text-xs text-muted">{t('picker.skill.noneSelected')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <SkillChip
              key={id}
              id={id}
              title={catalog.titleOf(id)}
              disabled={disabled}
              onRemove={() => onChange(value.filter((entry) => entry !== id))}
            />
          ))}
        </ul>
      )}
      {disabled || full ? null : (
        <>
          <Input
            aria-label={t('picker.skill.search')}
            placeholder={t('picker.skill.search')}
            value={catalog.query}
            onChange={(event) => catalog.setQuery(event.target.value)}
          />
          <SkillResults
            catalog={catalog}
            chosen={value}
            disabled={disabled}
            onPick={(skill) => onChange([...value, skill.id])}
          />
        </>
      )}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
