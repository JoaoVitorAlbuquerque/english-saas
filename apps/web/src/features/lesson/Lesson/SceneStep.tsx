import type { CatalogLesson, ResolvedAsset } from '@english-saas/api-client';
import {
  AudioButton,
  Button,
  Card,
  CharacterAvatar,
  MarkedText,
  SpokenStandardToggle,
  type CharacterTone,
} from '@english-saas/ui';
import type { SceneContent } from '@english-saas/shared';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';

export type SceneStepProps = {
  content: SceneContent;
  characters: CatalogLesson['characters'];
  assets: Record<string, ResolvedAsset>;
  onContinue: () => void;
};

function toneFor(slug: string): CharacterTone {
  return slug === 'maya' || slug === 'lucas' ? slug : 'neutral';
}

function audioUrl(
  assetId: string | undefined,
  assets: Record<string, ResolvedAsset>,
): string | null {
  return assetId ? (assets[assetId]?.url ?? null) : null;
}

export function SceneStep({
  content,
  characters,
  assets,
  onContinue,
}: SceneStepProps) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const byId = new Map(
    characters.map((character) => [character.id, character]),
  );

  function toggleTranslation(index: number): void {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const sceneAudioUrl = audioUrl(content.audioAssetId, assets);
  const cast = content.characterIds.flatMap((id) => {
    const character = byId.get(id);
    return character ? [character] : [];
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">{content.location}</p>
        {content.summary ? (
          <p className="text-sm text-ink">{content.summary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {cast.map((character) => (
            <div key={character.id} className="flex items-center gap-2">
              <CharacterAvatar
                name={character.name}
                tone={toneFor(character.slug)}
                imageUrl={
                  character.avatarAssetId
                    ? (assets[character.avatarAssetId]?.url ?? undefined)
                    : undefined
                }
                size="sm"
              />
              <span className="text-sm text-ink">{character.name}</span>
            </div>
          ))}
        </div>
        {sceneAudioUrl ? (
          <AudioButton src={sceneAudioUrl} label={t('lesson.scene.playAll')} />
        ) : null}
      </Card>

      <div className="flex flex-col gap-3">
        {content.lines.map((line, index) => {
          const character = byId.get(line.characterId);
          const lineAudioUrl = audioUrl(line.audioAssetId, assets);
          const isRevealed = revealed.has(index);

          return (
            <div key={index} className="flex items-start gap-3">
              <CharacterAvatar
                name={character?.name ?? '?'}
                tone={character ? toneFor(character.slug) : 'neutral'}
                size="sm"
              />
              <div className="flex-1 rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3">
                {line.standardText ? (
                  <SpokenStandardToggle
                    spoken={line.text}
                    standard={line.standardText}
                  />
                ) : (
                  <MarkedText text={line.text} spans={line.spans} />
                )}
                <div className="mt-2 flex items-center gap-3">
                  {lineAudioUrl ? (
                    <AudioButton
                      src={lineAudioUrl}
                      label={`${t('lesson.scene.playLine')}: ${line.text}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleTranslation(index)}
                    className="text-xs font-medium text-accent"
                  >
                    {isRevealed
                      ? t('lesson.scene.hideTranslation')
                      : t('lesson.scene.showTranslation')}
                  </button>
                </div>
                {isRevealed ? (
                  <p className="mt-1 text-sm text-muted">{line.translation}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={onContinue} className="mt-2 self-end">
        {t('lesson.common.continue')}
      </Button>
    </div>
  );
}
