import { type ApiError, useCreateUnit } from '@english-saas/api-client';
import { contentSlugSchema } from '@english-saas/shared';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';

import { t } from '../../../../messages/pt-BR';
import { fieldErrors } from '../../lib/form-errors';
import { slugify } from '../../lib/slug';

const unitFormSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: contentSlugSchema,
});

export type UnitDialogControllerInput = {
  levelId: string;
  /** Posição da nova unidade: no fim do nível. */
  order: number;
  onCreated: () => void;
};

export function useUnitDialogController({
  levelId,
  order,
  onCreated,
}: UnitDialogControllerInput) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [synopsis, setSynopsis] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreateUnit();

  function changeTitle(value: string): void {
    setTitle(value);

    // O slug acompanha o título até a pessoa mexer nele.
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

    const found = fieldErrors(unitFormSchema, { title, slug });

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    create.mutate(
      {
        levelId,
        slug,
        order,
        title: title.trim(),
        ...(synopsis.trim() === '' ? {} : { synopsis: synopsis.trim() }),
      },
      {
        onSuccess: onCreated,
        onError: (error: ApiError) => {
          if (error.code === 'SLUG_IN_USE') {
            setErrors({ slug: error.message });
          } else {
            setFormError(error.message || t('tree.unitDialog.error'));
          }
        },
      },
    );
  }

  return {
    title,
    slug,
    synopsis,
    errors,
    formError,
    isSubmitting: create.isPending,
    changeTitle,
    changeSlug,
    setSynopsis,
    handleSubmit,
  };
}
