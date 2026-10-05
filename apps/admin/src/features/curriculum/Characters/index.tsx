import {
  Button,
  Card,
  CharacterAvatar,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@english-saas/ui';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { CharacterDialog } from './CharacterDialog';
import { useCharactersController } from './useCharactersController';

export function Characters() {
  const controller = useCharactersController();

  return (
    <div className="space-y-6">
      <Link
        to="/conteudo"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('characters.back')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">
            {t('characters.title')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('characters.subtitle')}</p>
        </div>
        <Button
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={controller.openCreate}
        >
          {t('characters.new')}
        </Button>
      </header>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.characters.length === 0 ? (
        <EmptyState
          title={t('characters.empty.title')}
          description={t('characters.empty.description')}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {controller.characters.map((character) => (
            <li key={character.id}>
              <Card className="flex items-start gap-4">
                <CharacterAvatar
                  name={character.name}
                  imageUrl={character.avatarUrl ?? undefined}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg text-ink">
                    {character.name}
                  </h2>
                  <p className="truncate font-mono text-xs text-muted">
                    {character.slug}
                  </p>
                  {character.bio ? (
                    <p className="mt-1 text-sm text-ink">{character.bio}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    {character.voiceId
                      ? t('characters.voice', { voice: character.voiceId })
                      : t('characters.noVoice')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('characters.edit', { name: character.name })}
                  onClick={() => controller.openEdit(character)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CharacterDialog
        character={controller.dialog}
        onClose={controller.closeDialog}
      />
    </div>
  );
}
