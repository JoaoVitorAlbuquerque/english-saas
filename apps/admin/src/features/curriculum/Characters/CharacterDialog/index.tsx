import type { AdminCharacter } from '@english-saas/api-client';
import {
  Button,
  CharacterAvatar,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Textarea,
} from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import {
  AVATAR_TYPES,
  useCharacterDialogController,
} from './useCharacterDialogController';

export type CharacterDialogProps = {
  /** `undefined` fecha; `null` abre para criar; um personagem, para editar. */
  character: AdminCharacter | null | undefined;
  onClose: () => void;
};

function CharacterForm({
  character,
  onClose,
}: {
  character: AdminCharacter | null;
  onClose: () => void;
}) {
  const controller = useCharacterDialogController({
    character,
    onSaved: onClose,
  });

  return (
    <form onSubmit={controller.handleSubmit} noValidate className="space-y-4">
      <DialogTitle className="font-display text-lg text-ink">
        {character === null
          ? t('characters.dialog.createTitle')
          : t('characters.dialog.editTitle', { name: character.name })}
      </DialogTitle>

      <div className="flex items-center gap-4">
        <CharacterAvatar
          name={controller.name || '?'}
          imageUrl={controller.avatarUrl ?? undefined}
          size="lg"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            {t('characters.dialog.avatar')}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              isLoading={controller.isUploading}
              onClick={controller.chooseImage}
            >
              {controller.avatarUrl
                ? t('characters.dialog.replaceImage')
                : t('characters.dialog.chooseImage')}
            </Button>
            {controller.avatarUrl ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={controller.removeImage}
              >
                {t('characters.dialog.removeImage')}
              </Button>
            ) : null}
          </div>
          <input
            ref={controller.fileInput}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            aria-label={t('characters.dialog.avatar')}
            className="sr-only"
            tabIndex={-1}
            onChange={controller.handleFile}
          />
          {controller.isUploading ? (
            <p role="status" className="text-xs text-muted">
              {t('characters.dialog.uploading')}
            </p>
          ) : controller.imageError ? (
            <p role="alert" className="text-xs text-error">
              {controller.imageError}
            </p>
          ) : (
            <p className="text-xs text-muted">
              {t('characters.dialog.imageHint')}
            </p>
          )}
        </div>
      </div>

      <Input
        label={t('characters.dialog.name')}
        value={controller.name}
        onChange={(event) => controller.changeName(event.target.value)}
        error={controller.errors.name}
        autoFocus
      />
      <Input
        label={t('content.slug.label')}
        hint={
          controller.isEditing
            ? t('characters.dialog.slugLocked')
            : t('content.slug.hint')
        }
        value={controller.slug}
        onChange={(event) => controller.changeSlug(event.target.value)}
        error={controller.errors.slug}
        disabled={controller.isEditing}
      />
      <Textarea
        label={t('characters.dialog.bio')}
        value={controller.bio}
        onChange={(event) => controller.setBio(event.target.value)}
        rows={3}
      />
      <Input
        label={t('characters.dialog.voice')}
        hint={t('characters.dialog.voiceHint')}
        value={controller.voiceId}
        onChange={(event) => controller.setVoiceId(event.target.value)}
      />

      {controller.formError ? (
        <p role="alert" className="text-sm text-error">
          {controller.formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('content.cancel')}
        </Button>
        <Button
          type="submit"
          isLoading={controller.isSubmitting}
          disabled={controller.isUploading}
        >
          {t('content.save')}
        </Button>
      </div>
    </form>
  );
}

export function CharacterDialog({ character, onClose }: CharacterDialogProps) {
  return (
    <Dialog
      open={character !== undefined}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent>
        {character !== undefined ? (
          <CharacterForm character={character} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
