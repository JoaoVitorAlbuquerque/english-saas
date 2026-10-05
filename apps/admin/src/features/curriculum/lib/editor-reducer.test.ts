import { describe, expect, it } from 'vitest';

import {
  editorReducer,
  metaSnapshot,
  stepsSnapshot,
  toEditorState,
  toStepPayload,
  type EditorState,
} from './editor-reducer';
import { insertAt, moveItem, removeAt, withOptional } from './list-ops';
import { emptyContent, normalizeContent } from './step-content';

const base: EditorState = {
  meta: {
    title: 'Nice to meet you',
    objective: 'Se apresentar.',
    cefrLevel: 'A1',
    estimatedMinutes: 10,
    targetSkillIds: [],
  },
  steps: [
    { key: 'a', type: 'SCENE', content: emptyContent('SCENE') },
    { key: 'b', type: 'SUMMARY', content: emptyContent('SUMMARY') },
  ],
};

describe('editorReducer', () => {
  it('altera só os metadados pedidos', () => {
    const next = editorReducer(base, {
      type: 'meta/patch',
      patch: { title: 'Meeting people', estimatedMinutes: 15 },
    });

    expect(next.meta).toMatchObject({
      title: 'Meeting people',
      estimatedMinutes: 15,
      objective: 'Se apresentar.',
    });
    expect(next.steps).toBe(base.steps);
  });

  it('adiciona etapa vazia no fim, ou na posição pedida', () => {
    const end = editorReducer(base, {
      type: 'step/add',
      stepType: 'PRACTICE',
      key: 'c',
    });

    expect(end.steps.map((step) => step.key)).toEqual(['a', 'b', 'c']);
    expect(end.steps[2]?.content).toEqual(emptyContent('PRACTICE'));

    const middle = editorReducer(base, {
      type: 'step/add',
      stepType: 'EXPLANATION_CARDS',
      key: 'c',
      at: 1,
    });

    expect(middle.steps.map((step) => step.key)).toEqual(['a', 'c', 'b']);
  });

  it('remove e move etapas pela chave, sem mexer nas outras', () => {
    const moved = editorReducer(base, {
      type: 'step/move',
      key: 'b',
      delta: -1,
    });

    expect(moved.steps.map((step) => step.key)).toEqual(['b', 'a']);

    const edge = editorReducer(base, {
      type: 'step/move',
      key: 'a',
      delta: -1,
    });

    expect(edge.steps.map((step) => step.key)).toEqual(['a', 'b']);

    const removed = editorReducer(base, { type: 'step/remove', key: 'a' });

    expect(removed.steps.map((step) => step.key)).toEqual(['b']);
  });

  it('chave que não existe não muda nada', () => {
    expect(
      editorReducer(base, { type: 'step/remove', key: 'x' }).steps,
    ).toEqual(base.steps);
    expect(editorReducer(base, { type: 'step/move', key: 'x', delta: 1 })).toBe(
      base,
    );
    expect(
      editorReducer(base, { type: 'step/content', key: 'x', content: {} }),
    ).toBe(base);
  });

  it('troca o conteúdo da etapa certa', () => {
    const next = editorReducer(base, {
      type: 'step/content',
      key: 'b',
      content: { takeaways: ['I am'], skillIds: [], registerNoteIds: [] },
    });

    expect(next.steps[1]?.content).toMatchObject({ takeaways: ['I am'] });
    expect(next.steps[0]).toBe(base.steps[0]);
  });
});

describe('conversões', () => {
  it('toEditorState ordena por order, completa o conteúdo e dá uma chave a cada etapa', () => {
    let counter = 0;
    const state = toEditorState(
      {
        title: 'T',
        objective: 'O',
        cefrLevel: 'A2',
        estimatedMinutes: 12,
        targetSkills: [
          { skillId: 'b.skill', position: 1 },
          { skillId: 'a.skill', position: 0 },
        ],
        steps: [
          { order: 1, type: 'SUMMARY', content: null },
          { order: 0, type: 'SCENE', content: { location: 'Casa' } },
        ],
      },
      () => `k${String((counter += 1))}`,
    );

    expect(state.meta.targetSkillIds).toEqual(['a.skill', 'b.skill']);
    expect(state.steps.map((step) => [step.key, step.type])).toEqual([
      ['k1', 'SCENE'],
      ['k2', 'SUMMARY'],
    ]);
    // Conteúdo pela metade ganha a forma que os editores esperam.
    expect(state.steps[0]?.content).toMatchObject({
      location: 'Casa',
      characterIds: [],
      lines: [expect.objectContaining({ text: '', spans: [] })],
    });
    expect(state.steps[1]?.content).toMatchObject({ takeaways: [''] });
  });

  it('toStepPayload numera as etapas pela posição', () => {
    expect(toStepPayload(base.steps).map((step) => step.order)).toEqual([0, 1]);
  });

  it('os snapshots mudam quando o conteúdo muda, e só então', () => {
    const same = editorReducer(base, { type: 'meta/patch', patch: {} });

    expect(metaSnapshot(same.meta)).toBe(metaSnapshot(base.meta));
    expect(stepsSnapshot(same.steps)).toBe(stepsSnapshot(base.steps));

    const moved = editorReducer(base, {
      type: 'step/move',
      key: 'a',
      delta: 1,
    });

    expect(stepsSnapshot(moved.steps)).not.toBe(stepsSnapshot(base.steps));
  });
});

describe('normalizeContent', () => {
  it('lista que veio torta vira lista, e o que existe não muda', () => {
    const content = normalizeContent('EXPLANATION_CARDS', {
      cards: [{ title: 'To be', examples: 'nope' }, 'lixo'],
    });

    expect(content).toEqual({
      cards: [
        { title: 'To be', bodyMd: '', examples: [] },
        { title: '', bodyMd: '', examples: [] },
      ],
    });
  });

  it('falas ganham spans e metas ganham skillIds', () => {
    const scene = normalizeContent('SCENE', {
      lines: [{ text: 'Hi', characterId: 'c' }],
    });
    const roleplay = normalizeContent('ROLEPLAY', {
      goals: [{ id: 'g', description: 'x' }],
    });

    expect(scene.lines).toEqual([
      { characterId: 'c', text: 'Hi', translation: '', spans: [] },
    ]);
    expect(roleplay.goals).toEqual([
      { id: 'g', description: 'x', skillIds: [] },
    ]);
  });
});

describe('list-ops', () => {
  it('insere, remove e move sem alterar a lista original', () => {
    const list = ['a', 'b', 'c'];

    expect(insertAt(list, 1, 'x')).toEqual(['a', 'x', 'b', 'c']);
    expect(insertAt(list, 99, 'x')).toEqual(['a', 'b', 'c', 'x']);
    expect(removeAt(list, 1)).toEqual(['a', 'c']);
    expect(moveItem(list, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 2, 1)).toEqual(['a', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('withOptional tira a chave quando o valor fica vazio', () => {
    expect(withOptional({ a: 1 }, 'text', 'oi')).toEqual({ a: 1, text: 'oi' });
    expect(withOptional({ a: 1, text: 'oi' }, 'text', '')).toEqual({ a: 1 });
    expect(withOptional({ a: 1, text: 'oi' }, 'text', undefined)).toEqual({
      a: 1,
    });
  });
});
