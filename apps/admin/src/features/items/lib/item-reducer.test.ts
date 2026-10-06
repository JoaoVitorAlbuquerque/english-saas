import { describe, expect, it } from 'vitest';

import { blankItemState, newRowKey } from './item-form';
import { hasTypedContent, itemReducer } from './item-reducer';

describe('itemReducer', () => {
  it('patch muda só os campos simples', () => {
    const state = itemReducer(blankItemState(), {
      type: 'patch',
      patch: { prompt: 'I ___ Maya.', skillIds: ['grammar.be'] },
    });

    expect(state.prompt).toBe('I ___ Maya.');
    expect(state.skillIds).toEqual(['grammar.be']);
    expect(state.type).toBe('MULTIPLE_CHOICE');
  });

  it('trocar o tipo começa o conteúdo em branco e zera o mapa de erros', () => {
    const before = {
      ...blankItemState('MULTIPLE_CHOICE'),
      errorPatternMap: [
        { key: newRowKey(), wrong: 'is', patternId: 'l1.have-for-age' },
      ],
    };
    const after = itemReducer(before, {
      type: 'setType',
      itemType: 'FILL_BLANK',
    });

    expect(after.type).toBe('FILL_BLANK');
    expect(after.content).toEqual({ sentence: '' });
    // Tipo de resposta digitada nasce com um campo de resposta aceita.
    expect(after.acceptedAnswers).toEqual(['']);
    expect(after.errorPatternMap).toEqual([]);
  });

  it('trocar para o mesmo tipo não mexe em nada', () => {
    const state = blankItemState('MATCH');

    expect(itemReducer(state, { type: 'setType', itemType: 'MATCH' })).toBe(
      state,
    );
  });

  it('trocar para tipo de escolha esvazia as respostas aceitas', () => {
    const before = {
      ...blankItemState('TYPE_ANSWER'),
      acceptedAnswers: ['yes'],
    };

    expect(
      itemReducer(before, { type: 'setType', itemType: 'MULTIPLE_CHOICE' })
        .acceptedAnswers,
    ).toEqual([]);
  });

  it('mudar o texto falado solta o áudio que já estava gerado', () => {
    const before = {
      ...blankItemState('DICTATION'),
      content: {
        audioText: 'Nice to meet you.',
        audioAssetId: '11111111-1111-4111-8111-111111111111',
        maxPlays: 0,
      },
    };
    const same = itemReducer(before, {
      type: 'content',
      content: { ...before.content, maxPlays: 3 },
    });
    const changed = itemReducer(before, {
      type: 'content',
      content: { ...before.content, audioText: 'Nice to meet you, Maya.' },
    });

    expect(same.content.audioAssetId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(changed.content.audioAssetId).toBeNull();
  });

  it('o mapa de erros: adiciona, edita e remove pela chave da linha', () => {
    let state = itemReducer(blankItemState('TYPE_ANSWER'), { type: 'map/add' });
    const key = state.errorPatternMap[0]?.key ?? '';

    state = itemReducer(state, {
      type: 'map/set',
      key,
      patch: { wrong: 'She have from Austin' },
    });
    state = itemReducer(state, {
      type: 'map/set',
      key,
      patch: { patternId: 'l1.have-for-age' },
    });

    expect(state.errorPatternMap).toEqual([
      { key, wrong: 'She have from Austin', patternId: 'l1.have-for-age' },
    ]);
    expect(
      itemReducer(state, { type: 'map/remove', key }).errorPatternMap,
    ).toEqual([]);
  });

  it('reset troca o formulário inteiro', () => {
    const next = { ...blankItemState('MATCH'), prompt: 'Ligue.' };

    expect(itemReducer(blankItemState(), { type: 'reset', state: next })).toBe(
      next,
    );
  });
});

describe('hasTypedContent', () => {
  it('formulário em branco não tem o que perder', () => {
    expect(hasTypedContent(blankItemState('MULTIPLE_CHOICE'))).toBe(false);
    expect(hasTypedContent(blankItemState('FILL_BLANK'))).toBe(false);
  });

  it('enunciado, conteúdo ou resposta escritos contam', () => {
    expect(
      hasTypedContent({ ...blankItemState(), prompt: 'I ___ Maya.' }),
    ).toBe(true);
    expect(
      hasTypedContent({
        ...blankItemState('FILL_BLANK'),
        content: { sentence: 'I ___ Maya.' },
      }),
    ).toBe(true);
    expect(
      hasTypedContent({
        ...blankItemState('FILL_BLANK'),
        acceptedAnswers: ['am'],
      }),
    ).toBe(true);
  });
});
