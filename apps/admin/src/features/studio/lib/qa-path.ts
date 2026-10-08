import {
  LESSON_STEP_TYPE_LABELS,
  type LessonStepType,
} from '@english-saas/shared';

import { describePath } from '../../curriculum/lib/validation';

/**
 * Onde, na lição, está o trecho que um aviso da revisão automática aponta.
 *
 * O servidor grava o caminho em vários formatos, porque cada checagem nasceu
 * num lugar:
 *
 * - `steps.2.lines.1`, `steps.2.lines.1.standardText`,
 *   `steps.1.cards.0.examples.2`, `steps.3.helpers.0`, `steps.4.openingLine`
 *   — a etapa pela posição (a checagem de língua);
 * - `scene.lines.1.spans.0`, `cards.0.examples.1.spans.0` — o mapeamento da
 *   IA, que ainda não sabia a posição: vale a primeira cena e os primeiros
 *   cards;
 * - `items.2` — a **questão 3 da prática inteira** (não da etapa), do
 *   `checkConsistency`;
 * - `targetSkills`, `level`, `scene.characterIds` — dado da lição.
 *
 * O resultado diz para onde levar o editor: abrir uma etapa e focar o campo,
 * abrir a questão no banco ou abrir os metadados.
 */

export type QaStep = { type: LessonStepType; content: unknown };

export type QaLocation =
  | { kind: 'step'; stepOrder: number; fieldPath: string; label: string }
  | {
      kind: 'item';
      itemId: string | null;
      /** A etapa de prática que a tem, quando se sabe. */
      stepOrder: number | null;
      label: string;
    }
  | { kind: 'meta'; field: string | null; label: string }
  | { kind: 'version'; label: string };

function firstStepOf(
  steps: readonly QaStep[],
  type: LessonStepType,
): number | null {
  const index = steps.findIndex((step) => step.type === type);

  return index === -1 ? null : index;
}

function stepLocation(
  steps: readonly QaStep[],
  order: number,
  fieldPath: string,
): QaLocation | null {
  const step = steps[order];

  if (step === undefined) {
    return null;
  }

  const where = describePath(step.type, fieldPath);

  return {
    kind: 'step',
    stepOrder: order,
    fieldPath,
    label: `Etapa ${String(order + 1)} · ${LESSON_STEP_TYPE_LABELS[step.type]}${where === 'etapa' ? '' : ` › ${where}`}`,
  };
}

/** Os ids das questões da prática, na ordem em que a revisão as numera. */
export function practiceItemRefs(
  steps: readonly QaStep[],
): { itemId: string; stepOrder: number }[] {
  return steps.flatMap((step, stepOrder) => {
    if (step.type !== 'PRACTICE') {
      return [];
    }

    const ids = (step.content as { itemIds?: unknown } | null)?.itemIds;

    return Array.isArray(ids)
      ? ids.map((itemId) => ({ itemId: String(itemId), stepOrder }))
      : [];
  });
}

/** O campo do editor (caminho do `validateSteps`) que corresponde ao resto do caminho. */
function fieldOf(rest: string): string {
  // `lines.1` → o texto da fala; `lines.1.spans.0` → a mesma fala.
  const line = /^lines\.(\d+)(?:\.(standardText|translation))?/.exec(rest);

  if (line !== null) {
    return `lines.${line[1] as string}.${line[2] ?? 'text'}`;
  }

  const example = /^cards\.(\d+)\.examples\.(\d+)/.exec(rest);

  if (example !== null) {
    return `cards.${example[1] as string}.examples.${example[2] as string}.text`;
  }

  return rest.replace(/\.spans\.\d+$/, '');
}

export function locateQaPath(
  path: string | undefined,
  steps: readonly QaStep[],
): QaLocation {
  const whole: QaLocation = { kind: 'version', label: 'Lição inteira' };

  if (path === undefined || path === '') {
    return whole;
  }

  const stepMatch = /^steps\.(\d+)(?:\.(.+))?$/.exec(path);

  if (stepMatch !== null) {
    return (
      stepLocation(steps, Number(stepMatch[1]), fieldOf(stepMatch[2] ?? '')) ??
      whole
    );
  }

  // Do mapeamento da IA: sem a posição da etapa.
  const scene = /^scene\.(.+)$/.exec(path);

  if (scene !== null) {
    const order = firstStepOf(steps, 'SCENE');

    return (
      (order === null
        ? null
        : stepLocation(steps, order, fieldOf(scene[1] as string))) ?? whole
    );
  }

  if (/^cards\./.test(path)) {
    const order = firstStepOf(steps, 'EXPLANATION_CARDS');

    return (
      (order === null ? null : stepLocation(steps, order, fieldOf(path))) ??
      whole
    );
  }

  const item = /^items\.(\d+)/.exec(path);

  if (item !== null) {
    const position = Number(item[1]);
    const ref = practiceItemRefs(steps)[position];

    return {
      kind: 'item',
      itemId: ref?.itemId ?? null,
      stepOrder: ref?.stepOrder ?? null,
      label: `Questão ${String(position + 1)} da prática`,
    };
  }

  if (path === 'level') {
    return { kind: 'meta', field: 'cefrLevel', label: 'Nível da lição' };
  }

  if (path === 'targetSkills') {
    return { kind: 'meta', field: 'targetSkillIds', label: 'Skills-alvo' };
  }

  return whole;
}
