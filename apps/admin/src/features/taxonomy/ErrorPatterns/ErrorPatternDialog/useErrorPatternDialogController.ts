import {
  type AdminErrorPattern,
  type ApiError,
  useCreateErrorPattern,
  useUpdateErrorPattern,
} from '@english-saas/api-client';
import { errorPatternAuthoringSchema } from '@english-saas/shared';
import { useState, type FormEvent } from 'react';

import { t } from '../../../../messages/pt-BR';
import { fieldErrors } from '../../../curriculum/lib/form-errors';

export function useErrorPatternDialogController({
  pattern,
  onSaved,
}: {
  /** `null` cria; com um erro típico, edita. */
  pattern: AdminErrorPattern | null;
  onSaved: () => void;
}) {
  const isEditing = pattern !== null;
  const [id, setId] = useState(pattern?.id ?? '');
  const [description, setDescription] = useState(pattern?.description ?? '');
  const [example, setExample] = useState(pattern?.example ?? '');
  const [correction, setCorrection] = useState(pattern?.correction ?? '');
  const [explanation, setExplanation] = useState(pattern?.explanation ?? '');
  const [skillIds, setSkillIds] = useState<string[]>(pattern?.skillIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createPattern = useCreateErrorPattern();
  const updatePattern = useUpdateErrorPattern();

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setFormError(null);

    const body = {
      id: isEditing ? pattern.id : id.trim(),
      description,
      example,
      correction,
      explanation,
      skillIds,
    };
    const found = fieldErrors(errorPatternAuthoringSchema, body);

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    const callbacks = {
      onSuccess: onSaved,
      onError: (error: ApiError) => {
        if (error.code === 'SLUG_IN_USE') {
          setErrors({ id: error.message });
        } else {
          setFormError(error.message || t('errors.dialog.error'));
        }
      },
    };

    if (pattern === null) {
      createPattern.mutate(body, callbacks);
    } else {
      const { id: _id, ...input } = body;

      updatePattern.mutate({ id: pattern.id, input }, callbacks);
    }
  }

  return {
    isEditing,
    id,
    description,
    example,
    correction,
    explanation,
    skillIds,
    errors,
    formError,
    isSubmitting: createPattern.isPending || updatePattern.isPending,
    setId,
    setDescription,
    setExample,
    setCorrection,
    setExplanation,
    setSkillIds,
    handleSubmit,
  };
}
