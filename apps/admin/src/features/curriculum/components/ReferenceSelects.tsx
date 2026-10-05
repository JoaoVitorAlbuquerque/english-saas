import {
  type AdminCharacter,
  useAdminCharacters,
  useErrorPatterns,
  useRegisterNotes,
} from '@english-saas/api-client';
import { Chip, Select } from '@english-saas/ui';
import { useId } from 'react';

import { t } from '../../../messages/pt-BR';

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  fieldPath?: string;
};

/** Nota de registro: "gonna → going to". */
export function RegisterNoteSelect({
  label,
  value,
  onChange,
  error,
  disabled,
  fieldPath,
}: SelectProps) {
  const notes = useRegisterNotes();
  const options = (notes.data?.data ?? []).map((note) => ({
    value: note.id,
    label: `${note.spokenForm} → ${note.standardForm}`,
  }));

  // Nota que já está escolhida mas não veio na lista (descontinuada): mantém.
  if (value !== '' && !options.some((option) => option.value === value)) {
    options.push({ value, label: value });
  }

  return (
    <Select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={options}
      placeholder={t('picker.note.placeholder')}
      error={error ?? (notes.isError ? t('picker.note.error') : undefined)}
      disabled={disabled}
      data-field={fieldPath}
    />
  );
}

/** Várias notas de registro, por clique (resumo da lição). */
export function RegisterNoteChips({
  label,
  value,
  onChange,
  disabled,
  error,
  fieldPath,
}: {
  label: string;
  value: readonly string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string | undefined;
  fieldPath?: string;
}) {
  const notes = useRegisterNotes();
  const groupId = useId();
  const all = notes.data?.data ?? [];

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
      <div className="flex flex-wrap gap-2">
        {all.map((note) => (
          <Chip
            key={note.id}
            selected={value.includes(note.id)}
            disabled={disabled}
            onClick={() =>
              onChange(
                value.includes(note.id)
                  ? value.filter((id) => id !== note.id)
                  : [...value, note.id],
              )
            }
          >
            {note.spokenForm} → {note.standardForm}
          </Chip>
        ))}
      </div>
      {notes.isError ? (
        <p className="text-sm text-error">{t('picker.note.error')}</p>
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}

/** Erro típico que a correção vigia (rubrica da produção livre). */
export function ErrorPatternSelect({
  label,
  value,
  onChange,
  disabled,
  fieldPath,
}: SelectProps) {
  const patterns = useErrorPatterns();
  const options = [
    { value: '', label: t('picker.errorPattern.placeholder') },
    ...(patterns.data?.data ?? []).map((pattern) => ({
      value: pattern.id,
      label: pattern.example
        ? `${pattern.example} → ${pattern.correction}`
        : pattern.id,
    })),
  ];

  if (value !== '' && !options.some((option) => option.value === value)) {
    options.push({ value, label: value });
  }

  return (
    <Select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={options}
      disabled={disabled}
      data-field={fieldPath}
    />
  );
}

/** Um personagem do elenco. `only` limita às pessoas da cena. */
export function CharacterSelect({
  label,
  value,
  onChange,
  error,
  disabled,
  fieldPath,
  only,
  characters,
}: SelectProps & {
  characters?: AdminCharacter[];
  only?: readonly string[];
}) {
  const fetched = useAdminCharacters();
  const all = characters ?? fetched.data ?? [];
  const list =
    only === undefined
      ? all
      : all.filter(
          (character) => only.includes(character.id) || character.id === value,
        );

  return (
    <Select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={list.map((character) => ({
        value: character.id,
        label: character.name,
      }))}
      placeholder={t('picker.character.placeholder')}
      error={error}
      disabled={disabled}
      data-field={fieldPath}
    />
  );
}
