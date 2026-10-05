import {
  type AdminCharacter,
  type ApiError,
  useCreateCharacter,
  useUpdateCharacter,
  useUploadImage,
} from '@english-saas/api-client';
import { contentSlugSchema } from '@english-saas/shared';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { z } from 'zod';

import { t } from '../../../../messages/pt-BR';
import { fieldErrors } from '../../lib/form-errors';
import { slugify } from '../../lib/slug';

/** Os mesmos limites da API (`POST media-assets/upload`). */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const characterFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: contentSlugSchema,
});

export function useCharacterDialogController({
  character,
  onSaved,
}: {
  /** `null` cria um personagem; com um personagem, edita. */
  character: AdminCharacter | null;
  onSaved: () => void;
}) {
  const isEditing = character !== null;
  const [name, setName] = useState(character?.name ?? '');
  const [slug, setSlug] = useState(character?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(false);
  const [bio, setBio] = useState(character?.bio ?? '');
  const [voiceId, setVoiceId] = useState(character?.voiceId ?? '');
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(
    character?.avatarAssetId ?? null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    character?.avatarUrl ?? null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter();
  const uploadImage = useUploadImage();

  function changeName(value: string): void {
    setName(value);

    if (!isEditing && !slugTouched) {
      setSlug(slugify(value));
    }
  }

  function changeSlug(value: string): void {
    setSlugTouched(true);
    setSlug(value);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    // Permite escolher o mesmo arquivo de novo depois de um erro.
    event.target.value = '';

    if (file === undefined) {
      return;
    }

    setImageError(null);

    if (!AVATAR_TYPES.includes(file.type)) {
      setImageError(t('characters.dialog.imageType'));
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      setImageError(t('characters.dialog.imageSize'));
      return;
    }

    uploadImage.mutate(file, {
      onSuccess: (asset) => {
        setAvatarAssetId(asset.id);
        setAvatarUrl(asset.url);
      },
      onError: (error: ApiError) =>
        setImageError(error.message || t('characters.dialog.imageError')),
    });
  }

  function removeImage(): void {
    setAvatarAssetId(null);
    setAvatarUrl(null);
    setImageError(null);
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setFormError(null);

    const found = fieldErrors(characterFormSchema, {
      name,
      // Em edição o identificador não se muda e não se confere.
      slug: isEditing ? 'ok' : slug,
    });

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    const common = {
      name: name.trim(),
      bio: bio.trim() === '' ? null : bio.trim(),
      voiceId: voiceId.trim() === '' ? null : voiceId.trim(),
      avatarAssetId,
    };
    const callbacks = {
      onSuccess: onSaved,
      onError: (error: ApiError) => {
        if (error.code === 'SLUG_IN_USE') {
          setErrors({ slug: error.message });
        } else {
          setFormError(error.message || t('characters.dialog.error'));
        }
      },
    };

    if (character === null) {
      createCharacter.mutate({ slug, ...common }, callbacks);
    } else {
      updateCharacter.mutate({ id: character.id, input: common }, callbacks);
    }
  }

  return {
    isEditing,
    name,
    slug,
    bio,
    voiceId,
    avatarUrl,
    errors,
    imageError,
    formError,
    fileInput,
    isUploading: uploadImage.isPending,
    isSubmitting: createCharacter.isPending || updateCharacter.isPending,
    changeName,
    changeSlug,
    setBio,
    setVoiceId,
    handleFile,
    removeImage,
    chooseImage: () => fileInput.current?.click(),
    handleSubmit,
  };
}
