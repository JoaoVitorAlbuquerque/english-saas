import { describe, expect, it } from 'vitest';

import { locateQaPath, practiceItemRefs, type QaStep } from './qa-path';

const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const ITEM_C = '33333333-3333-4333-8333-333333333333';

const steps: QaStep[] = [
  { type: 'SCENE', content: { lines: [] } },
  { type: 'EXPLANATION_CARDS', content: { cards: [] } },
  { type: 'PRACTICE', content: { itemIds: [ITEM_A, ITEM_B] } },
  { type: 'FREE_PRODUCTION', content: {} },
  { type: 'PRACTICE', content: { itemIds: [ITEM_C] } },
  { type: 'ROLEPLAY', content: {} },
];

describe('locateQaPath — caminhos com a posição da etapa', () => {
  it('fala da cena', () => {
    expect(locateQaPath('steps.0.lines.1', steps)).toEqual({
      kind: 'step',
      stepOrder: 0,
      fieldPath: 'lines.1.text',
      label: 'Etapa 1 · Cena › fala 2 › texto',
    });
  });

  it('forma padrão e tradução da fala vão para o próprio campo', () => {
    expect(locateQaPath('steps.0.lines.1.standardText', steps)).toMatchObject({
      kind: 'step',
      stepOrder: 0,
      fieldPath: 'lines.1.standardText',
    });
    expect(locateQaPath('steps.0.lines.3.translation', steps)).toMatchObject({
      fieldPath: 'lines.3.translation',
    });
  });

  it('exemplo de um card', () => {
    expect(locateQaPath('steps.1.cards.0.examples.2', steps)).toMatchObject({
      kind: 'step',
      stepOrder: 1,
      fieldPath: 'cards.0.examples.2.text',
    });
  });

  it('ajuda da produção livre e fala de abertura do roleplay', () => {
    expect(locateQaPath('steps.3.helpers.1', steps)).toMatchObject({
      kind: 'step',
      stepOrder: 3,
      fieldPath: 'helpers.1',
    });
    expect(locateQaPath('steps.5.openingLine', steps)).toMatchObject({
      kind: 'step',
      stepOrder: 5,
      fieldPath: 'openingLine',
    });
  });

  it('etapa que não existe mais cai na lição inteira', () => {
    expect(locateQaPath('steps.9.lines.0', steps)).toEqual({
      kind: 'version',
      label: 'Lição inteira',
    });
  });
});

describe('locateQaPath — caminhos do mapeamento da IA, sem a posição', () => {
  it('marcação da fala: a primeira cena, no texto da fala', () => {
    expect(locateQaPath('scene.lines.1.spans.0', steps)).toMatchObject({
      kind: 'step',
      stepOrder: 0,
      fieldPath: 'lines.1.text',
    });
  });

  it('marcação do exemplo: os primeiros cards', () => {
    expect(locateQaPath('cards.0.examples.1.spans.0', steps)).toMatchObject({
      kind: 'step',
      stepOrder: 1,
      fieldPath: 'cards.0.examples.1.text',
    });
  });

  it('lição sem cena: não inventa etapa', () => {
    expect(locateQaPath('scene.lines.0.spans.0', [])).toEqual({
      kind: 'version',
      label: 'Lição inteira',
    });
  });
});

describe('locateQaPath — questões', () => {
  it('conta as questões da prática inteira, não da etapa', () => {
    expect(locateQaPath('items.0', steps)).toEqual({
      kind: 'item',
      itemId: ITEM_A,
      stepOrder: 2,
      label: 'Questão 1 da prática',
    });
    // A terceira questão está na segunda etapa de prática.
    expect(locateQaPath('items.2', steps)).toEqual({
      kind: 'item',
      itemId: ITEM_C,
      stepOrder: 4,
      label: 'Questão 3 da prática',
    });
  });

  it('subcaminho da questão (alternativa, resposta) leva à mesma questão', () => {
    expect(locateQaPath('items.1.options.0', steps)).toMatchObject({
      kind: 'item',
      itemId: ITEM_B,
    });
  });

  it('questão que sumiu da prática: sem id, com o rótulo', () => {
    expect(locateQaPath('items.7', steps)).toEqual({
      kind: 'item',
      itemId: null,
      stepOrder: null,
      label: 'Questão 8 da prática',
    });
  });

  it('lista as questões na ordem da revisão', () => {
    expect(practiceItemRefs(steps).map((ref) => ref.itemId)).toEqual([
      ITEM_A,
      ITEM_B,
      ITEM_C,
    ]);
  });
});

describe('locateQaPath — dados da lição', () => {
  it('nível e skills-alvo vão para os metadados', () => {
    expect(locateQaPath('level', steps)).toEqual({
      kind: 'meta',
      field: 'cefrLevel',
      label: 'Nível da lição',
    });
    expect(locateQaPath('targetSkills', steps)).toEqual({
      kind: 'meta',
      field: 'targetSkillIds',
      label: 'Skills-alvo',
    });
  });

  it('sem caminho, ou caminho desconhecido: a lição inteira', () => {
    expect(locateQaPath(undefined, steps).kind).toBe('version');
    expect(locateQaPath('', steps).kind).toBe('version');
    expect(locateQaPath('scene.characterIds', steps).kind).toBe('step');
    expect(locateQaPath('qualquer.coisa', steps).kind).toBe('version');
  });
});
