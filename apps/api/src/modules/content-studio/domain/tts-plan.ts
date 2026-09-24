import type { ItemType, LessonStepInput } from '@english-saas/shared';

/**
 * O que de uma versão de lição precisa de áudio.
 *
 * Três coisas falam: as falas da cena, os itens de escuta (LISTEN_CHOOSE e
 * DICTATION) e as notas de registro. Esta função olha a versão e devolve a
 * lista — quem já tem áudio e quem não tem.
 *
 * Serve para duas coisas: alimentar o job de síntese na aprovação, e barrar
 * o publish enquanto sobrar alguém sem áudio.
 */

export type AudioTargetKind = 'SCENE_LINE' | 'ITEM' | 'REGISTER_NOTE';

export type AudioTarget = {
  kind: AudioTargetKind;
  /** Identificação estável dentro da versão, para o job e para a mensagem. */
  ref: string;
  /** O texto que vai ser falado. */
  text: string;
  /** Voz pedida. Vazio = usar a voz padrão do ambiente. */
  voiceId: string;
  /** Já existe `MediaAsset` ligado? */
  hasAudio: boolean;
  /** Onde gravar o id do asset depois da síntese. */
  stepOrder?: number;
  lineIndex?: number;
  itemId?: string;
  registerNoteId?: string;
};

export type AudioPlanInput = {
  steps: readonly LessonStepInput[];
  /** Voz de cada personagem, por id. Ausente = voz padrão. */
  voiceByCharacterId: Record<string, string | null>;
  items: readonly {
    id: string;
    type: ItemType;
    content: unknown;
  }[];
  registerNotes: readonly {
    id: string;
    spokenForm: string;
    audioAssetId: string | null;
  }[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function planAudioTargets(input: AudioPlanInput): AudioTarget[] {
  const targets: AudioTarget[] = [];

  for (const [stepOrder, step] of input.steps.entries()) {
    if (step.type !== 'SCENE') {
      continue;
    }

    for (const [lineIndex, line] of step.content.lines.entries()) {
      targets.push({
        kind: 'SCENE_LINE',
        ref: `step ${String(stepOrder)} / fala ${String(lineIndex + 1)}`,
        text: line.text,
        voiceId: input.voiceByCharacterId[line.characterId] ?? '',
        hasAudio: line.audioAssetId !== undefined,
        stepOrder,
        lineIndex,
      });
    }
  }

  for (const item of input.items) {
    if (item.type !== 'LISTEN_CHOOSE' && item.type !== 'DICTATION') {
      continue;
    }

    const content = asRecord(item.content);
    const text = content['audioText'];

    if (typeof text !== 'string' || text.trim().length === 0) {
      continue;
    }

    targets.push({
      kind: 'ITEM',
      ref: `questão ${item.id}`,
      text,
      voiceId: '',
      hasAudio: typeof content['audioAssetId'] === 'string',
      itemId: item.id,
    });
  }

  for (const note of input.registerNotes) {
    targets.push({
      kind: 'REGISTER_NOTE',
      ref: `nota de registro ${note.id}`,
      text: note.spokenForm,
      voiceId: '',
      hasAudio: note.audioAssetId !== null,
      registerNoteId: note.id,
    });
  }

  return targets;
}

export function missingAudio(targets: readonly AudioTarget[]): AudioTarget[] {
  return targets.filter((target) => !target.hasAudio);
}

/** Notas de registro referenciadas pelas marcações das etapas. */
export function registerNoteIdsInSteps(
  steps: readonly LessonStepInput[],
): string[] {
  const found = new Set<string>();

  for (const step of steps) {
    if (step.type === 'SCENE') {
      for (const line of step.content.lines) {
        for (const span of line.spans) {
          if (span.registerNoteId !== undefined) {
            found.add(span.registerNoteId);
          }
        }
      }
    }

    if (step.type === 'EXPLANATION_CARDS') {
      for (const card of step.content.cards) {
        for (const example of card.examples) {
          for (const span of example.spans) {
            if (span.registerNoteId !== undefined) {
              found.add(span.registerNoteId);
            }
          }
        }
      }
    }

    if (step.type === 'SUMMARY') {
      for (const id of step.content.registerNoteIds) {
        found.add(id);
      }
    }
  }

  return [...found].sort();
}
