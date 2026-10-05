import type { SceneContent } from '@english-saas/shared';
import { useState } from 'react';

import { AudioButton } from '../components/AudioButton/AudioButton';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import {
  CharacterAvatar,
  type CharacterTone,
} from '../components/CharacterAvatar/CharacterAvatar';
import { MarkedText } from '../components/MarkedText/MarkedText';
import { SpokenStandardToggle } from '../components/SpokenStandardToggle/SpokenStandardToggle';
import type { LessonAssets, LessonCharacter } from './lesson-types';

export type SceneViewProps = {
  content: SceneContent;
  characters: readonly LessonCharacter[];
  assets: LessonAssets;
  onContinue: () => void;
};

function toneFor(slug: string): CharacterTone {
  return slug === 'maya' || slug === 'lucas' ? slug : 'neutral';
}

function audioUrl(
  assetId: string | undefined,
  assets: LessonAssets,
): string | null {
  return assetId ? (assets[assetId]?.url ?? null) : null;
}

/** Etapa de cena: elenco, falas com áudio, tradução sob demanda. */
export function SceneView({
  content,
  characters,
  assets,
  onContinue,
}: SceneViewProps) {
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
          <AudioButton src={sceneAudioUrl} label="Ouvir a cena inteira" />
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
                      label={`Ouvir: ${line.text}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleTranslation(index)}
                    className="text-xs font-medium text-accent"
                  >
                    {isRevealed ? 'Esconder tradução' : 'Ver tradução'}
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
        Continuar
      </Button>
    </div>
  );
}
