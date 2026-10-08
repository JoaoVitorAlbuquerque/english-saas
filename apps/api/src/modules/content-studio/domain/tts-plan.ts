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
  /**
   * Identificação estável, para o cliente apontar uma fala (marcar problema,
   * pedir nova geração): `scene:<etapa>:<fala>`, `item:<uuid>`, `note:<slug>`.
   * O `ref` é rótulo para gente ler e muda quando a ordem muda.
   */
  key: string;
  /** Mensagem legível, para o erro `MISSING_AUDIO`. */
  ref: string;
  /** Quem fala, quando é fala de cena. */
  characterId?: string;
  /** O texto que vai ser falado. */
  text: string;
  /** Voz pedida. Vazio = usar a voz padrão do ambiente. */
  voiceId: string;
  /** Já existe `MediaAsset` ligado? */
  hasAudio: boolean;
  /** O asset ligado, quando há. */
  assetId: string | null;
  /** Onde gravar o id do asset depois da síntese. */
  stepOrder?: number;
  lineIndex?: number;
  itemId?: string;
  registerNoteId?: string;
};

export function sceneLineKey(stepOrder: number, lineIndex: number): string {
  return `scene:${String(stepOrder)}:${String(lineIndex)}`;
}

export function itemAudioKey(itemId: string): string {
  return `item:${itemId}`;
}

export function noteAudioKey(registerNoteId: string): string {
  return `note:${registerNoteId}`;
}

/** A forma de uma chave: `scene:0:2`, `item:<uuid>`, `note:gonna`. */
export function isAudioKey(value: string): boolean {
  return (
    /^scene:\d+:\d+$/.test(value) ||
    /^item:[0-9a-f-]{36}$/i.test(value) ||
    /^note:[a-z0-9][a-z0-9.-]*$/.test(value)
  );
}

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
        key: sceneLineKey(stepOrder, lineIndex),
        ref: `step ${String(stepOrder)} / fala ${String(lineIndex + 1)}`,
        characterId: line.characterId,
        text: line.text,
        voiceId: input.voiceByCharacterId[line.characterId] ?? '',
        hasAudio: line.audioAssetId !== undefined,
        assetId: line.audioAssetId ?? null,
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
      key: itemAudioKey(item.id),
      ref: `questão ${item.id}`,
      text,
      voiceId: '',
      hasAudio: typeof content['audioAssetId'] === 'string',
      assetId:
        typeof content['audioAssetId'] === 'string'
          ? content['audioAssetId']
          : null,
      itemId: item.id,
    });
  }

  for (const note of input.registerNotes) {
    targets.push({
      kind: 'REGISTER_NOTE',
      key: noteAudioKey(note.id),
      ref: `nota de registro ${note.id}`,
      text: note.spokenForm,
      voiceId: '',
      hasAudio: note.audioAssetId !== null,
      assetId: note.audioAssetId,
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
