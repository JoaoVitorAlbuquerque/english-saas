import {
  type AdminRegisterNote,
  type ApiError,
  useCreateRegisterNote,
  useUpdateRegisterNote,
} from '@english-saas/api-client';
import {
  registerNoteAuthoringSchema,
  type CefrLevel,
  type RegisterLevel,
} from '@english-saas/shared';
import { useState, type FormEvent } from 'react';

import { t } from '../../../../messages/pt-BR';
import { fieldErrors } from '../../../curriculum/lib/form-errors';

export function useRegisterNoteDialogController({
  note,
  onSaved,
}: {
  /** `null` cria; com uma nota, edita. */
  note: AdminRegisterNote | null;
  onSaved: () => void;
}) {
  const isEditing = note !== null;
  const [id, setId] = useState(note?.id ?? '');
  const [spokenForm, setSpokenForm] = useState(note?.spokenForm ?? '');
  const [standardForm, setStandardForm] = useState(note?.standardForm ?? '');
  const [register, setRegister] = useState<RegisterLevel>(
    note?.register ?? 'INFORMAL_SPOKEN',
  );
  const [explanation, setExplanation] = useState(note?.explanation ?? '');
  const [whenToAvoid, setWhenToAvoid] = useState(note?.whenToAvoid ?? '');
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(
    note?.cefrLevel ?? 'A1',
  );
  const [skillId, setSkillId] = useState<string | null>(note?.skillId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createNote = useCreateRegisterNote();
  const updateNote = useUpdateRegisterNote();

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setFormError(null);

    // O áudio não se edita aqui: nasce quando a lição que usa a nota é
    // aprovada (TTS), e o `audioAssetId` que já existe fica como está.
    const body = {
      id: isEditing ? note.id : id.trim(),
      spokenForm,
      standardForm,
      register,
      explanation,
      whenToAvoid: whenToAvoid.trim() === '' ? null : whenToAvoid.trim(),
      cefrLevel,
      skillId,
    };
    const found = fieldErrors(registerNoteAuthoringSchema, body);

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    const callbacks = {
      onSuccess: onSaved,
      onError: (error: ApiError) => {
        if (error.code === 'SLUG_IN_USE') {
          setErrors({ id: error.message });
        } else if (error.code === 'REGISTER_SKILL_TAKEN') {
          setErrors({ skillId: error.message });
        } else if (error.code === 'MISSING_REFERENCES') {
          setErrors({ skillId: error.message });
        } else {
          setFormError(error.message || t('notes.dialog.error'));
        }
      },
    };

    if (note === null) {
      createNote.mutate(body, callbacks);
    } else {
      const { id: _id, ...input } = body;

      updateNote.mutate({ id: note.id, input }, callbacks);
    }
  }

  return {
    isEditing,
    id,
    spokenForm,
    standardForm,
    register,
    explanation,
    whenToAvoid,
    cefrLevel,
    skillId,
    errors,
    formError,
    isSubmitting: createNote.isPending || updateNote.isPending,
    setId,
    setSpokenForm,
    setStandardForm,
    setRegister,
    setExplanation,
    setWhenToAvoid,
    setCefrLevel,
    setSkillId,
    handleSubmit,
  };
}
