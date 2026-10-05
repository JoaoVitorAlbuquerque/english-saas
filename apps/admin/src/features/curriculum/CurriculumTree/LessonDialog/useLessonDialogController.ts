import { type ApiError, useCreateLesson } from '@english-saas/api-client';
import {
  cefrLevelSchema,
  contentSlugSchema,
  type CefrLevel,
} from '@english-saas/shared';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';

import { t } from '../../../../messages/pt-BR';
import { fieldErrors } from '../../lib/form-errors';
import { slugify } from '../../lib/slug';

const lessonFormSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: contentSlugSchema,
  objective: z.string().trim().min(4).max(500),
  cefrLevel: cefrLevelSchema,
});

export type LessonDialogControllerInput = {
  unitId: string;
  /** Posição da nova lição: no fim da unidade. */
  order: number;
  defaultLevel: CefrLevel;
  onCreated: (lessonId: string, versionId: string | null) => void;
};

export function useLessonDialogController({
  unitId,
  order,
  defaultLevel,
  onCreated,
}: LessonDialogControllerInput) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [objective, setObjective] = useState('');
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(defaultLevel);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreateLesson();

  function changeTitle(value: string): void {
    setTitle(value);

    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function changeSlug(value: string): void {
    setSlugTouched(true);
    setSlug(value);
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setFormError(null);

    const found = fieldErrors(lessonFormSchema, {
      title,
      slug,
      objective,
      cefrLevel,
    });

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    create.mutate(
      {
        unitId,
        slug,
        order,
        title: title.trim(),
        objective: objective.trim(),
        cefrLevel,
      },
      {
        onSuccess: (lesson) =>
          onCreated(lesson.id, lesson.versions[0]?.id ?? null),
        onError: (error: ApiError) => {
          if (error.code === 'SLUG_IN_USE') {
            setErrors({ slug: error.message });
          } else {
            setFormError(error.message || t('tree.lessonDialog.error'));
          }
        },
      },
    );
  }

  return {
    title,
    slug,
    objective,
    cefrLevel,
    errors,
    formError,
    isSubmitting: create.isPending,
    changeTitle,
    changeSlug,
    setObjective,
    setCefrLevel,
    handleSubmit,
  };
}
