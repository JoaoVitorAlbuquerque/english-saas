import { spanSchema } from '@english-saas/shared';
import { z } from 'zod';

import type { ItemView, OptionView } from './types';

/**
 * `item.content` chega solto do back-end (a forma exata depende do `type`,
 * já sem gabarito — `apps/api/.../curriculum/domain/student-view.ts`). Esta
 * função estreita pro formato que o `ItemRenderer` espera, trocando
 * `audioAssetId` pela URL já resolvida em `assets`.
 *
 * Usada por qualquer tela que recebe item de item de banco (nivelamento,
 * prática de lição, revisão, material gerado): o formato de saída do
 * catálogo é sempre o mesmo `{id, type, prompt, content}` + um mapa de
 * assets — só muda de onde vem o mapa (por item, ou por lição inteira).
 */

export type RawStudentItem = {
  id: string;
  type: ItemView['type'];
  prompt: string;
  content: Record<string, unknown>;
};

export type ResolvedAssetMap = Record<string, { url: string }>;

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
  content: Record<string, unknown>,
  assets: ResolvedAssetMap,
): string {
  const assetId = content.audioAssetId;

  return typeof assetId === 'string' ? (assets[assetId]?.url ?? '') : '';
}

export function toItemView(
  item: RawStudentItem,
  assets: ResolvedAssetMap,
): ItemView {
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
          audioUrl: audioUrlFor(content, assets),
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
          audioUrl: audioUrlFor(content, assets),
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
