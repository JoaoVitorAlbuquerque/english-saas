import {
  type AdminSkill,
  type ApiError,
  useCreateSkill,
  useUpdateSkill,
} from '@english-saas/api-client';
import {
  skillAuthoringSchema,
  type CefrLevel,
  type Competency,
  type LearningGoal,
  type SkillType,
} from '@english-saas/shared';
import { useState, type FormEvent } from 'react';

import { t } from '../../../../messages/pt-BR';
import { fieldErrors } from '../../../curriculum/lib/form-errors';

/** O que a API devolve no `details` de `INVALID_PREREQUISITES`. */
type PrerequisiteDetails = {
  reason?: string;
  cycle?: string[];
  skills?: string[];
};

function prerequisiteMessage(error: ApiError): string {
  const details = (error.details ?? {}) as PrerequisiteDetails;

  if (details.reason === 'CYCLE' && details.cycle !== undefined) {
    return `${error.message} ${details.cycle.join(' → ')}`;
  }

  if (details.reason === 'DEPRECATED' && details.skills !== undefined) {
    return `${error.message} (${details.skills.join(', ')})`;
  }

  return error.message;
}

export function useSkillDialogController({
  skill,
  onSaved,
}: {
  /** `null` cria; com uma skill, edita. */
  skill: AdminSkill | null;
  onSaved: () => void;
}) {
  const isEditing = skill !== null;
  const [id, setId] = useState(skill?.id ?? '');
  const [title, setTitle] = useState(skill?.title ?? '');
  const [type, setType] = useState<SkillType>(skill?.type ?? 'GRAMMAR');
  const [competency, setCompetency] = useState<Competency>(
    skill?.competency ?? 'GRAMMAR',
  );
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(
    skill?.cefrLevel ?? 'A1',
  );
  const [description, setDescription] = useState(skill?.description ?? '');
  const [goals, setGoals] = useState<LearningGoal[]>(skill?.goals ?? []);
  const [prerequisites, setPrerequisites] = useState<string[]>(
    skill?.prerequisites ?? [],
  );
  const [commonErrors, setCommonErrors] = useState<string[]>(
    skill?.commonErrors ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();

  function toggleGoal(goal: LearningGoal, on: boolean): void {
    setGoals((current) =>
      on ? [...current, goal] : current.filter((entry) => entry !== goal),
    );
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setFormError(null);

    const body = {
      id: isEditing ? skill.id : id.trim(),
      type,
      competency,
      cefrLevel,
      title,
      description: description.trim() === '' ? null : description.trim(),
      prerequisites,
      commonErrors,
      goals,
    };
    const found = fieldErrors(skillAuthoringSchema, body);

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    const callbacks = {
      onSuccess: onSaved,
      onError: (error: ApiError) => {
        if (error.code === 'SLUG_IN_USE') {
          setErrors({ id: error.message });
        } else if (error.code === 'INVALID_PREREQUISITES') {
          setErrors({ prerequisites: prerequisiteMessage(error) });
        } else {
          setFormError(error.message || t('skills.dialog.error'));
        }
      },
    };

    if (skill === null) {
      createSkill.mutate(body, callbacks);
    } else {
      const { id: _id, ...input } = body;

      updateSkill.mutate({ id: skill.id, input }, callbacks);
    }
  }

  return {
    isEditing,
    id,
    title,
    type,
    competency,
    cefrLevel,
    description,
    goals,
    prerequisites,
    commonErrors,
    errors,
    formError,
    isSubmitting: createSkill.isPending || updateSkill.isPending,
    setId,
    setTitle,
    setType,
    setCompetency,
    setCefrLevel,
    setDescription,
    toggleGoal,
    setPrerequisites,
    setCommonErrors,
    handleSubmit,
  };
}
