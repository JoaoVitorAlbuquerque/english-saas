import type { PlacementItem } from '@english-saas/api-client';
import { spanSchema } from '@english-saas/shared';
import type { ItemView, OptionView } from '@english-saas/ui';
import { z } from 'zod';

/**
 * `PlacementItem.content` chega solto (a forma exata depende do `type`, já
 * sem gabarito — `apps/api/.../curriculum/domain/student-view.ts`). Aqui a
 * gente estreita pro formato que o `ItemRenderer` do F2 espera, e troca
 * `audioAssetId` pela URL assinada que já vem resolvida em `item.assets`.
 */

const spansSchema = z.array(spanSchema).catch([]);

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toOptions(value: unknown): OptionView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object') {
      return [];
    }

    const option = entry as Record<string, unknown>;

    return typeof option.id === 'string' && typeof option.text === 'string'
      ? [
          {
            id: option.id,
            text: option.text,
            translation: asOptionalString(option.translation),
          },
        ]
      : [];
  });
}

function audioUrlFor(
  item: PlacementItem,
  content: Record<string, unknown>,
): string {
  const assetId = content.audioAssetId;

  return typeof assetId === 'string' ? (item.assets[assetId]?.url ?? '') : '';
}

export function toItemView(item: PlacementItem): ItemView {
  const content = item.content;

  switch (item.type) {
    case 'MULTIPLE_CHOICE':
      return {
        id: item.id,
        type: 'MULTIPLE_CHOICE',
        prompt: item.prompt,
        content: {
          options: toOptions(content.options),
          shuffle: asBoolean(content.shuffle),
        },
      };
    case 'LISTEN_CHOOSE':
      return {
        id: item.id,
        type: 'LISTEN_CHOOSE',
        prompt: item.prompt,
        content: {
          options: toOptions(content.options),
          shuffle: asBoolean(content.shuffle),
          audioUrl: audioUrlFor(item, content),
        },
      };
    case 'ORDER_WORDS':
      return {
        id: item.id,
        type: 'ORDER_WORDS',
        prompt: item.prompt,
        content: { tokens: asStringArray(content.tokens) },
      };
    case 'FILL_BLANK':
      return {
        id: item.id,
        type: 'FILL_BLANK',
        prompt: item.prompt,
        content: {
          sentence: asString(content.sentence),
          hint: asOptionalString(content.hint),
          choices: Array.isArray(content.choices)
            ? asStringArray(content.choices)
            : undefined,
        },
      };
    case 'TYPE_ANSWER':
      return {
        id: item.id,
        type: 'TYPE_ANSWER',
        prompt: item.prompt,
        content: {
          sourceText: asOptionalString(content.sourceText),
          hint: asOptionalString(content.hint),
        },
      };
    case 'MATCH':
      return {
        id: item.id,
        type: 'MATCH',
        prompt: item.prompt,
        content: {
          lefts: asStringArray(content.lefts),
          rights: asStringArray(content.rights),
        },
      };
    case 'DICTATION':
      return {
        id: item.id,
        type: 'DICTATION',
        prompt: item.prompt,
        content: {
          audioUrl: audioUrlFor(item, content),
          maxPlays: asNumber(content.maxPlays),
        },
      };
    case 'READING_COMPREHENSION':
      return {
        id: item.id,
        type: 'READING_COMPREHENSION',
        prompt: item.prompt,
        content: {
          passage: asString(content.passage),
          spans: spansSchema.parse(content.spans),
          options: toOptions(content.options),
          shuffle: asBoolean(content.shuffle),
        },
      };
    case 'REGISTER_SWAP':
      return {
        id: item.id,
        type: 'REGISTER_SWAP',
        prompt: item.prompt,
        content: {
          source: asString(content.source),
          direction:
            content.direction === 'STANDARD_TO_SPOKEN'
              ? 'STANDARD_TO_SPOKEN'
              : 'SPOKEN_TO_STANDARD',
        },
      };
  }
}
