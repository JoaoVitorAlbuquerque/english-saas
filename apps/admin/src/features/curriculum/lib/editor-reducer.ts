import type { CefrLevel, LessonStepType } from '@english-saas/shared';

import { insertAt, moveItem, replaceAt } from './list-ops';
import {
  emptyContent,
  normalizeContent,
  type StepContent,
} from './step-content';

/**
 * Estado do editor de versão: metadados + etapas. Puro — o reducer não gera
 * chave nem lê relógio; quem chama passa o que precisa.
 */

export type EditorMeta = {
  title: string;
  objective: string;
  cefrLevel: CefrLevel;
  estimatedMinutes: number;
  targetSkillIds: string[];
};

/** `key` é só do editor: identifica a etapa enquanto ela muda de posição. */
export type EditorStep = {
  key: string;
  type: LessonStepType;
  content: StepContent;
};

export type EditorState = {
  meta: EditorMeta;
  steps: EditorStep[];
};

export type EditorAction =
  | { type: 'meta/patch'; patch: Partial<EditorMeta> }
  | { type: 'step/add'; stepType: LessonStepType; key: string; at?: number }
  | { type: 'step/remove'; key: string }
  | { type: 'step/move'; key: string; delta: -1 | 1 }
  | { type: 'step/content'; key: string; content: StepContent }
  | { type: 'reset'; state: EditorState };

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'meta/patch':
      return { ...state, meta: { ...state.meta, ...action.patch } };

    case 'step/add':
      return {
        ...state,
        steps: insertAt(state.steps, action.at ?? state.steps.length, {
          key: action.key,
          type: action.stepType,
          content: emptyContent(action.stepType),
        }),
      };

    case 'step/remove':
      return {
        ...state,
        steps: state.steps.filter((step) => step.key !== action.key),
      };

    case 'step/move': {
      const index = state.steps.findIndex((step) => step.key === action.key);

      return index === -1
        ? state
        : { ...state, steps: moveItem(state.steps, index, action.delta) };
    }

    case 'step/content': {
      const index = state.steps.findIndex((step) => step.key === action.key);
      const current = state.steps[index];

      return current === undefined
        ? state
        : {
            ...state,
            steps: replaceAt(state.steps, index, {
              ...current,
              content: action.content,
            }),
          };
    }

    case 'reset':
      return action.state;
  }
}

/** O que o servidor devolve de uma versão, no formato do editor. */
export function toEditorState(
  version: {
    title: string;
    objective: string;
    cefrLevel: CefrLevel;
    estimatedMinutes: number;
    targetSkills: { skillId: string; position: number }[];
    steps: { order: number; type: LessonStepType; content: unknown }[];
  },
  makeKey: () => string,
): EditorState {
  return {
    meta: {
      title: version.title,
      objective: version.objective,
      cefrLevel: version.cefrLevel,
      estimatedMinutes: version.estimatedMinutes,
      targetSkillIds: [...version.targetSkills]
        .sort((a, b) => a.position - b.position)
        .map((target) => target.skillId),
    },
    steps: [...version.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        key: makeKey(),
        type: step.type,
        content: normalizeContent(step.type, step.content),
      })),
  };
}

/** As etapas como o servidor recebe: `order` é a posição na lista. */
export function toStepPayload(
  steps: readonly EditorStep[],
): { order: number; type: LessonStepType; content: StepContent }[] {
  return steps.map((step, order) => ({
    order,
    type: step.type,
    content: step.content,
  }));
}

/**
 * Texto que muda quando o conteúdo muda — é como o salvamento sabe o que
 * ainda não foi para o servidor.
 */
export function stepsSnapshot(steps: readonly EditorStep[]): string {
  return JSON.stringify(toStepPayload(steps));
}

export function metaSnapshot(meta: EditorMeta): string {
  return JSON.stringify(meta);
}
